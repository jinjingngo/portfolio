import { NextResponse } from "next/server";
import { t } from "try";
import { verifySendToken } from "@/app/lib/push/sendToken";
import {
	deletePushSubscription,
	getPushSubscriptionByClientId,
} from "@/app/lib/server/pushKV";
import type { SubscribeBody } from "../subscribe/route";

type UnsubscribeBody = Pick<SubscribeBody, "clientId" | "token">;

export const POST = async (request: Request) => {
	const [ok, error, body] = await t(request.json<UnsubscribeBody>());

	if (!ok || error) {
		console.error("ERROR: parsing unsubscribe payload", error);
		return NextResponse.json(
			{
				ok: false,
				error: "Invalid unsubscribe payload.",
			},
			{ status: 400 },
		);
	}
	if (typeof body?.clientId !== "string" || !body.clientId) {
		return NextResponse.json(
			{
				ok: false,
				error: "Missing clientId.",
			},
			{ status: 400 },
		);
	}

	const stored = await getPushSubscriptionByClientId(body.clientId);

	// Nothing stored means there is nothing to remove; report success.
	if (!stored) {
		return NextResponse.json({ ok: true });
	}

	if (!(await verifySendToken(stored.tokenHash, body.token))) {
		return NextResponse.json(
			{
				ok: false,
				error: "Invalid token.",
			},
			{ status: 401 },
		);
	}

	await deletePushSubscription(body.clientId);

	return NextResponse.json({ ok: true });
};
