/**
 * Pure rules for sharing a photo into Camera Translate (Web Share Target):
 * where the share arrives, which files are accepted, and where the visitor
 * is sent next. The worker and the page only carry these out.
 */

import { accept, type Decision, reject } from "../decision";

/** Where the OS posts a shared photo (the manifest's `share_target.action`). */
export const SHARE_TARGET_PATH = "/lab/camera-translate/share";
/** The multipart field holding the photo (`share_target.params.files`). */
export const SHARE_TARGET_FIELD = "photo";
/** Cache holding the shared photo until the page picks it up. */
export const SHARED_PHOTO_CACHE = "jj-share";
/** Key of the shared photo in that cache (never fetched from the network). */
export const SHARED_PHOTO_KEY = "/__shared-photo";
/** Camera Translate page, which reads `?shared=` on load. */
export const SHARE_PAGE_PATH = "/lab/camera-translate";

export const SHARE_LIMITS = Object.freeze({
	/**
	 * A full-size phone photo; the page scales it down to the translate API's
	 * limits before sending, as it does for a picked photo.
	 */
	maxPhotoBytes: 25_000_000,
});

/** What happened to a share, as passed to the page in `?shared=`. */
export type ShareOutcome = "ready" | "invalid" | "unavailable";

const OUTCOME_PARAMS: Record<ShareOutcome, string> = {
	ready: "1",
	invalid: "invalid",
	unavailable: "unavailable",
};

/** The page to open after a share. */
export const shareRedirectPath = (outcome: ShareOutcome) =>
	`${SHARE_PAGE_PATH}?shared=${OUTCOME_PARAMS[outcome]}`;

/** Reads `?shared=` from the page's query string; null when absent or unknown. */
export const shareOutcomeOf = (search: string): ShareOutcome | null => {
	const value = new URLSearchParams(search).get("shared");
	const found = Object.entries(OUTCOME_PARAMS).find(
		([, param]) => param === value,
	);
	return found ? (found[0] as ShareOutcome) : null;
};

/** What the visitor is told when a shared photo can't be used. */
export const SHARE_MESSAGES: Record<Exclude<ShareOutcome, "ready">, string> = {
	invalid:
		"That share wasn't a photo this page can translate. Try sharing a single image.",
	unavailable:
		"The shared photo didn't arrive. Open the app (and tap Reload if it offers a new version), then share again, or choose the photo here.",
};

/** Whether a request is a photo shared into the app (only the worker answers it). */
export const isShareTargetRequest = (
	request: { method: string; url: string },
	origin: string,
) => {
	if (request.method !== "POST") return false;
	const url = new URL(request.url);
	return url.origin === origin && url.pathname === SHARE_TARGET_PATH;
};

/** Accepts a shared file if it is an image within the size limit. */
export const checkSharedPhoto = (
	file: { type: string; size: number } | null,
): Decision<true> => {
	if (!file) return reject("No photo was shared.", 400);
	if (!file.type.startsWith("image/"))
		return reject("Only images can be shared here.", 415);
	if (file.size === 0) return reject("The shared photo is empty.", 400);
	if (file.size > SHARE_LIMITS.maxPhotoBytes)
		return reject("The shared photo is too large.", 413);
	return accept(true);
};
