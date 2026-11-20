import { NextResponse } from "next/server";
import { t } from "try";
import {
	getPushSubscriptionByClientId,
	putPushSubscription,
	verifySendToken,
} from "@/app/lib/server/pushKV";

export type SubscribeBody = {
	clientId: string;
	subscription: PushSubscriptionJSON;
	/** Current send token, if this browser already has one. */
	token?: string;
};

export const POST = async (request: Request) => {
	const [ok, error, body] = await t(request.json<SubscribeBody>());

	if (!ok || error) {
		console.error("ERROR: parsing subscription payload", error);
		return NextResponse.json(
			{
				ok: false,
				error: "Invalid subscription payload.",
			},
			{ status: 400 },
		);
	}

	if (
		typeof body?.clientId !== "string" ||
		!body.clientId ||
		body.clientId.length > 128 ||
		typeof body.subscription?.endpoint !== "string"
	) {
		return NextResponse.json(
			{
				ok: false,
				error: "Invalid subscription payload.",
			},
			{ status: 400 },
		);
	}

	const existing = await getPushSubscriptionByClientId(body.clientId);

	// Re-subscribing an existing client must prove it is the same browser:
	// either the current token, or the same push endpoint (a secret URL only
	// the browser and its push service know). Otherwise knowing a clientId
	// would be enough to hijack someone's subscription.
	if (existing) {
		const sameEndpoint =
			existing.subscription.endpoint === body.subscription.endpoint;
		const validToken = await verifySendToken(existing, body.token);
		if (!sameEndpoint && !validToken) {
			return NextResponse.json(
				{
					ok: false,
					error: "Not allowed to replace this subscription.",
				},
				{ status: 403 },
			);
		}
	}

	const { saved, token } = await putPushSubscription(
		body.clientId,
		body.subscription,
		existing,
	);

	return NextResponse.json({
		ok: true,
		clientId: saved.clientId,
		updatedAt: saved.updatedAt,
		token,
	});
};
