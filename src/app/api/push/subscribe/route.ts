import { NextResponse } from "next/server";
import { t } from "try";
import {
	decideSubscribe,
	isValidClientId,
	PUSH_LIMITS,
} from "@/app/lib/push/pushPolicy";
import { encodeSendToken, verifySendToken } from "@/app/lib/push/sendToken";
import {
	getPushSubscriptionByClientId,
	putPushSubscription,
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
		!isValidClientId(body?.clientId) ||
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
	const validToken = await verifySendToken(existing?.tokenHash, body.token);

	const decision = decideSubscribe({
		hasExisting: Boolean(existing),
		sameEndpoint:
			existing?.subscription.endpoint === body.subscription.endpoint,
		validToken,
	});
	if (!decision.ok) {
		return NextResponse.json(
			{ ok: false, error: decision.error },
			{ status: decision.status },
		);
	}

	const { saved, token } = await putPushSubscription(
		body.clientId,
		body.subscription,
		existing,
		new Date(),
		decision.value === "keep" && body.token
			? body.token
			: encodeSendToken(
					crypto.getRandomValues(
						new Uint8Array(PUSH_LIMITS.sendTokenBytes),
					),
				),
	);

	return NextResponse.json({
		ok: true,
		clientId: saved.clientId,
		updatedAt: saved.updatedAt,
		token,
	});
};
