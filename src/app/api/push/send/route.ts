import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
	buildPushHTTPRequest,
	type PushSubscription as PushForgePushSubscription,
} from "@pushforge/builder";
import { NextResponse } from "next/server";
import { t } from "try";
import {
	deliveryStatus,
	parseNotification,
	parseVapidPrivateKey,
} from "@/app/lib/push/pushPolicy";
import { verifySendToken } from "@/app/lib/push/sendToken";
import {
	consumeSendQuota,
	deletePushSubscription,
	getPushSubscriptionByClientId,
} from "@/app/lib/server/pushKV";

type PushBody = {
	clientId: string;
	token: string;
	title: string;
	message: string;
	url: string;
};

const fail = (error: string, status: number) =>
	NextResponse.json({ ok: false, error }, { status });

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
	if (!stored || !(await verifySendToken(stored.tokenHash, body.token))) {
		return fail("Invalid clientId or token.", 401);
	}

	const notification = parseNotification(body, new URL(request.url).origin);
	if (!notification.ok) {
		return fail(notification.error, notification.status);
	}

	const { env } = await getCloudflareContext();

	const privateJWK = parseVapidPrivateKey(env.VAPID_PRIVATE_KEY);
	if (!privateJWK) {
		console.error("[ERROR] VAPID_PRIVATE_KEY is missing or not valid JSON");
		return fail("Push notifications are not configured.", 500);
	}

	if (!(await consumeSendQuota(body.clientId, Date.now()))) {
		return fail("Too many notifications. Try again in a minute.", 429);
	}

	const message = {
		adminContact: env.VAPID_SUBJECT,
		payload: notification.value,
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
		{ status: deliveryStatus(response.status) },
	);
};
