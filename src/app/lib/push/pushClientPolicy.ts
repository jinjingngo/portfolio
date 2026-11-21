/**
 * Pure decisions for the browser side of web push: what a send response means
 * for the visitor, and why push is unavailable on this device.
 */

/** What the browser does with a /api/push/send response. */
export type SendOutcome = "sent" | "throttled" | "expired" | "failed";

/** Classifies a /api/push/send status for the browser. */
export const classifySendStatus = (status: number): SendOutcome => {
	if (status >= 200 && status < 300) return "sent";
	if (status === 429) return "throttled";
	if (status === 410) return "expired";
	return "failed";
};

/** Browser capabilities that decide whether web push can be used. */
export type PushEnvironment = {
	hasNotification: boolean;
	hasServiceWorker: boolean;
	hasPushManager: boolean;
	/** iPhone or iPad, including iPadOS reporting itself as a Mac. */
	isAppleMobile: boolean;
	/** Opened from the Home Screen (standalone display mode). */
	isStandalone: boolean;
};

/**
 * Why web push can't be used here, or null when it can. On iPhone and iPad,
 * Safari exposes push only to sites added to the Home Screen, so a plain tab
 * gets instructions instead of a generic "not supported".
 */
export const pushUnavailableReason = (env: PushEnvironment) => {
	if (env.hasNotification && env.hasServiceWorker && env.hasPushManager) {
		return null;
	}
	if (env.isAppleMobile && !env.isStandalone) {
		return "On iPhone and iPad, add this site to your Home Screen (Share → Add to Home Screen), then open it from there to turn on notifications.";
	}
	return "Push notifications are not supported in this browser.";
};
