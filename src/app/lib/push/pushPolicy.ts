/**
 * Pure rules for who may send which push notification. No I/O, no clock:
 * the API routes load state, call these, then write.
 */

/** Push limits; the one place these numbers live. */
export const PUSH_LIMITS = Object.freeze({
	maxClientIdLength: 128,
	maxTitleLength: 100,
	maxMessageLength: 300,
	sendsPerWindow: 5,
	/** Rate-limit window in seconds (KV's minimum TTL is 60s). */
	windowSeconds: 60,
	/** Random bytes in a send token (base64url-encoded to 43 characters). */
	sendTokenBytes: 32,
});

export type Decision<T> =
	| { ok: true; value: T }
	| { ok: false; error: string; status: number };

export type NotificationPayload = {
	title: string;
	body: string;
	/** A path on this site, never an absolute URL. */
	url: string;
};

const reject = (error: string, status: number) =>
	({ ok: false, error, status }) as const;

export const isValidClientId = (clientId: unknown): clientId is string =>
	typeof clientId === "string" &&
	clientId.length > 0 &&
	clientId.length <= PUSH_LIMITS.maxClientIdLength;

/**
 * Resolves `url` against `origin` and returns it as a relative path, or null
 * when it points anywhere else. Keeps notifications from linking off-site.
 */
export const toSameOriginPath = (url: string, origin: string) => {
	if (!URL.canParse(url, origin)) return null;
	const resolved = new URL(url, origin);
	if (resolved.origin !== origin) return null;
	return `${resolved.pathname}${resolved.search}${resolved.hash}`;
};

/** Validates a send request's notification fields for the site at `origin`. */
export const parseNotification = (
	input: { title?: unknown; message?: unknown; url?: unknown },
	origin: string,
): Decision<NotificationPayload> => {
	const { title, message, url } = input;
	if (
		typeof title !== "string" ||
		typeof message !== "string" ||
		typeof url !== "string" ||
		!title ||
		!message ||
		!url
	) {
		return reject("Insufficient notification structure.", 400);
	}

	if (
		title.length > PUSH_LIMITS.maxTitleLength ||
		message.length > PUSH_LIMITS.maxMessageLength
	) {
		return reject("Notification title or message is too long.", 400);
	}

	const path = toSameOriginPath(url, origin);
	if (!path) {
		return reject("Notification links must point to this site.", 400);
	}

	return { ok: true, value: { title, body: message, url: path } };
};

/** What a subscribe request does with the browser's send token. */
export type TokenAction = "keep" | "issue";

/**
 * Decides whether a subscribe request may save, and whether the browser keeps
 * its token or gets a new one. Replacing a stored subscription needs proof it
 * is the same browser: a valid token, or the same push endpoint (a secret URL
 * only the browser and its push service know). A valid token is kept, so
 * re-subscribing never invalidates a token the browser already holds.
 */
export const decideSubscribe = (input: {
	hasExisting: boolean;
	sameEndpoint: boolean;
	validToken: boolean;
}): Decision<TokenAction> => {
	if (!input.hasExisting) return { ok: true, value: "issue" };
	if (input.validToken) return { ok: true, value: "keep" };
	if (input.sameEndpoint) return { ok: true, value: "issue" };
	return reject("Not allowed to replace this subscription.", 403);
};

/**
 * Status the send route returns for the push service's answer. Failures become
 * 502 so a push-service 401/403 (e.g. a rejected VAPID signature) isn't read
 * by the browser as its own token being rejected.
 */
export const deliveryStatus = (pushServiceStatus: number) =>
	pushServiceStatus >= 200 && pushServiceStatus < 300
		? pushServiceStatus
		: 502;

/**
 * The push service's host, safe to log. The full endpoint URL is a secret: it
 * proves ownership when a browser replaces its subscription.
 */
export const pushServiceHost = (endpoint: string | undefined) =>
	endpoint && URL.canParse(endpoint)
		? new URL(endpoint).host
		: "invalid-endpoint";

/** Start (epoch ms) of the fixed rate-limit window containing `nowMs`. */
export const rateWindowStart = (nowMs: number) => {
	const windowMs = PUSH_LIMITS.windowSeconds * 1000;
	return Math.floor(nowMs / windowMs) * windowMs;
};

/** True when one more send fits in a window that has `sent` sends. */
export const hasSendQuota = (sent: number) => sent < PUSH_LIMITS.sendsPerWindow;
