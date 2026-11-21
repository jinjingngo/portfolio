/**
 * Pure rules shared by the service worker and the page: the messages they
 * exchange, and how a push payload becomes a notification. No worker or DOM
 * APIs here, so both sides and the tests can import it.
 */

import { safeSitePath } from "./cachePolicy";

/** Page → worker: activate the waiting worker now (the user chose Reload). */
export const SKIP_WAITING = "SKIP_WAITING";
/** Page → worker: reply with the build version (for debugging). */
export const GET_VERSION = "GET_VERSION";

export type WorkerMessage =
	| { type: typeof SKIP_WAITING }
	| { type: typeof GET_VERSION };

/** Reads a message posted to the worker; anything unknown is null. */
export const parseWorkerMessage = (data: unknown): WorkerMessage | null => {
	if (typeof data !== "object" || data === null) return null;
	const { type } = data as { type?: unknown };
	return type === SKIP_WAITING || type === GET_VERSION ? { type } : null;
};

/**
 * A path on this site to open from a notification. Anything that isn't a
 * plain same-site path ("//evil", "https://…", "javascript:…") becomes "/".
 */
export const safeNotificationPath = (url: unknown) => safeSitePath(url);

export type NotificationSpec = {
	title: string;
	body: string;
	url: string;
};

/** Turns a push payload into the notification to show, with safe defaults. */
export const notificationFromPush = (payload: unknown): NotificationSpec => {
	const data =
		typeof payload === "object" && payload !== null
			? (payload as Record<string, unknown>)
			: {};
	return {
		title:
			typeof data.title === "string" && data.title
				? data.title
				: "New notification",
		body: typeof data.body === "string" ? data.body : "",
		url: safeNotificationPath(data.url),
	};
};

/** Icon shown on notifications (and the badge on Android). */
export const NOTIFICATION_ICON = "/icon-192.png";
