import { getCloudflareContext } from "@opennextjs/cloudflare";
import { t } from "try";

const getClientKey = (clientId: string) => `PUSH:CLIENT:${clientId}`;
const getRateKey = (clientId: string, windowStart: number) =>
	`PUSH:RATE:${clientId}:${windowStart}`;

/** Max sends per subscriber per rate-limit window. */
export const SEND_RATE_LIMIT = 5;
/** Rate-limit window in seconds (KV's minimum TTL is 60s). */
export const SEND_RATE_WINDOW_SECONDS = 60;

export type StoredPushSubscription = {
	clientId: string;
	subscription: PushSubscriptionJSON;
	/** SHA-256 (hex) of the token handed to the subscribing browser. */
	tokenHash?: string;
	createdAt: string;
	updatedAt: string;
};

const toHex = (buffer: ArrayBuffer) =>
	[...new Uint8Array(buffer)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");

const toBase64Url = (bytes: Uint8Array) =>
	btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");

export const generateSendToken = () =>
	toBase64Url(crypto.getRandomValues(new Uint8Array(32)));

export const hashSendToken = async (token: string) =>
	toHex(
		await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
	);

const timingSafeEqual = (a: string, b: string) => {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
};

/** True when `token` matches the hash stored for this subscription. */
export const verifySendToken = async (
	stored: StoredPushSubscription,
	token: unknown,
) => {
	if (!stored.tokenHash || typeof token !== "string" || !token) return false;
	return timingSafeEqual(await hashSendToken(token), stored.tokenHash);
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
 * Saves the subscription and issues a fresh send token. Only the token's hash
 * is stored; the plain token is returned once so the browser can keep it.
 */
export const putPushSubscription = async (
	clientId: string,
	subscription: PushSubscriptionJSON,
	existing: StoredPushSubscription | null,
) => {
	const { env } = await getCloudflareContext();
	const now = new Date().toUTCString();
	const token = generateSendToken();

	const value: StoredPushSubscription = {
		clientId,
		subscription,
		tokenHash: await hashSendToken(token),
		createdAt: existing?.createdAt ?? now,
		updatedAt: now,
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
export const consumeSendQuota = async (clientId: string) => {
	const { env } = await getCloudflareContext();
	const windowMs = SEND_RATE_WINDOW_SECONDS * 1000;
	const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
	const key = getRateKey(clientId, windowStart);

	const count = Number((await env.PUSH_SUBSCRIPTIONS.get(key)) ?? 0) || 0;
	if (count >= SEND_RATE_LIMIT) return false;

	await env.PUSH_SUBSCRIPTIONS.put(key, String(count + 1), {
		expirationTtl: SEND_RATE_WINDOW_SECONDS * 2,
	});
	return true;
};
