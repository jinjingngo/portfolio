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

/** Start (epoch ms) of the fixed rate-limit window containing `nowMs`. */
export const rateWindowStart = (nowMs: number) => {
	const windowMs = PUSH_LIMITS.windowSeconds * 1000;
	return Math.floor(nowMs / windowMs) * windowMs;
};

/** True when one more send fits in a window that has `sent` sends. */
export const hasSendQuota = (sent: number) => sent < PUSH_LIMITS.sendsPerWindow;
