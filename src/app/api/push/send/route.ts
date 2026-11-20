import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
	buildPushHTTPRequest,
	type PushSubscription as PushForgePushSubscription,
} from "@pushforge/builder";
import { NextResponse } from "next/server";
import { t } from "try";
import {
	consumeSendQuota,
	deletePushSubscription,
	getPushSubscriptionByClientId,
	verifySendToken,
} from "@/app/lib/server/pushKV";

type PushBody = {
	clientId: string;
	token: string;
	title: string;
	message: string;
	url: string;
};

const MAX_TITLE_LENGTH = 100;
const MAX_MESSAGE_LENGTH = 300;

const fail = (error: string, status: number) =>
	NextResponse.json({ ok: false, error }, { status });

/**
 * Resolves `url` against the site's origin and returns it as a relative path,
 * or null when it points anywhere else. Keeps notifications from carrying
 * links to other sites.
 */
const toSameOriginPath = (url: string, origin: string) => {
	const [ok, , resolved] = t(() => new URL(url, origin));
	if (!ok || !resolved || resolved.origin !== origin) return null;
	return `${resolved.pathname}${resolved.search}${resolved.hash}`;
};

export const POST = async (request: Request) => {
	const [ok, error, body] = await t(request.json<PushBody>());

	if (!ok || error) {
		console.error("ERROR: parsing push payload", error);
		return fail("Invalid push payload.", 400);
	}

	if (typeof body?.clientId !== "string" || !body.clientId) {
		return fail("Missing clientId.", 400);
	}

	const stored = await getPushSubscriptionByClientId(body.clientId);

	// Same response for unknown client and wrong token, so the endpoint
	// doesn't reveal which client IDs exist.
	if (!stored || !(await verifySendToken(stored, body.token))) {
		return fail("Invalid clientId or token.", 401);
	}

	const { title, message: inMessage, url } = body;

	if (
		typeof title !== "string" ||
		typeof inMessage !== "string" ||
		typeof url !== "string" ||
		!title ||
		!inMessage ||
		!url
	) {
		return fail("Insufficient notification structure.", 400);
	}

	if (
		title.length > MAX_TITLE_LENGTH ||
		inMessage.length > MAX_MESSAGE_LENGTH
	) {
		return fail("Notification title or message is too long.", 400);
	}

	const path = toSameOriginPath(url, new URL(request.url).origin);
	if (!path) {
		return fail("Notification links must point to this site.", 400);
	}

	const { env } = await getCloudflareContext();

	const [keyOk, keyError, privateJWK] = t(
		(): JsonWebKey => JSON.parse(env.VAPID_PRIVATE_KEY ?? ""),
	);
	if (!keyOk || keyError || !privateJWK) {
		console.error(
			"[ERROR] VAPID_PRIVATE_KEY is missing or not valid JSON",
			keyError,
		);
		return fail("Push notifications are not configured.", 500);
	}

	if (!(await consumeSendQuota(body.clientId))) {
		return fail("Too many notifications. Try again in a minute.", 429);
	}

	const payload = {
		title,
		body: inMessage,
		url: path,
	};
	const message = {
		adminContact: env.VAPID_SUBJECT,
		payload,
	};

	const pushRequest = await buildPushHTTPRequest({
		privateJWK,
		subscription:
			stored.subscription as unknown as PushForgePushSubscription,
		message,
	});

	const response = await fetch(pushRequest.endpoint, {
		method: "POST",
		headers: pushRequest.headers,
		body: pushRequest.body,
	});

	if ([404, 410].includes(response.status)) {
		await deletePushSubscription(body.clientId);
	}

	if (!response.ok) {
		const responseHeaders = Object.fromEntries(response.headers.entries());
		const responseText = await response.text();

		console.error("[ERROR] Push delivery failed ", {
			endpoint: pushRequest.endpoint,
			status: response.status,
			statusText: response.statusText,
			headers: responseHeaders,
			body: responseText,
			message,
		});
	}

	return NextResponse.json(
		{
			ok: response.ok,
		},
		{ status: response.status },
	);
};
