import { getCloudflareContext } from "@opennextjs/cloudflare";
import { t } from "try";
import { hasSendQuota, PUSH_LIMITS, rateWindowStart } from "../push/pushPolicy";
import { hashSendToken } from "../push/sendToken";

const getClientKey = (clientId: string) => `PUSH:CLIENT:${clientId}`;
const getRateKey = (clientId: string, windowStart: number) =>
	`PUSH:RATE:${clientId}:${windowStart}`;

export type StoredPushSubscription = {
	clientId: string;
	subscription: PushSubscriptionJSON;
	/** SHA-256 (hex) of the token handed to the subscribing browser. */
	tokenHash?: string;
	createdAt: string;
	updatedAt: string;
};

export const getPushSubscriptionByClientId = async (
	clientId: string,
): Promise<StoredPushSubscription | null> => {
	const key = getClientKey(clientId);
	const { env } = await getCloudflareContext();
	const raw = await env.PUSH_SUBSCRIPTIONS.get(key);
	if (!raw) {
		return null;
	}
	const [ok, error, subscription] = t(
		(): StoredPushSubscription => JSON.parse(raw),
	);

	if (!ok || error) {
		console.error("[ERROR] Parsing StoredPushSubscription error ", error);
		return null;
	}

	return subscription;
};

/**
 * Saves the subscription with `token` as its send token. Only the token's hash
 * is stored; the plain token is returned so the browser can keep it.
 */
export const putPushSubscription = async (
	clientId: string,
	subscription: PushSubscriptionJSON,
	existing: StoredPushSubscription | null,
	now: Date,
	token: string,
) => {
	const { env } = await getCloudflareContext();
	const timestamp = now.toUTCString();

	const value: StoredPushSubscription = {
		clientId,
		subscription,
		tokenHash: await hashSendToken(token),
		createdAt: existing?.createdAt ?? timestamp,
		updatedAt: timestamp,
	};

	await env.PUSH_SUBSCRIPTIONS.put(
		getClientKey(clientId),
		JSON.stringify(value),
	);

	return { saved: value, token };
};

export const deletePushSubscription = async (clientId: string) => {
	const { env } = await getCloudflareContext();
	const key = getClientKey(clientId);
	return await env.PUSH_SUBSCRIPTIONS.delete(key);
};

/**
 * Fixed-window counter in KV. KV is eventually consistent, so the cap is
 * approximate, which is fine for keeping a demo from being abused.
 * Returns true when the send is allowed.
 */
export const consumeSendQuota = async (clientId: string, nowMs: number) => {
	const { env } = await getCloudflareContext();
	const key = getRateKey(clientId, rateWindowStart(nowMs));

	const sent = Number((await env.PUSH_SUBSCRIPTIONS.get(key)) ?? 0) || 0;
	if (!hasSendQuota(sent)) return false;

	await env.PUSH_SUBSCRIPTIONS.put(key, String(sent + 1), {
		expirationTtl: PUSH_LIMITS.windowSeconds * 2,
	});
	return true;
};
