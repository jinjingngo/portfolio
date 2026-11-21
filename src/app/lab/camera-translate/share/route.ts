import { shareRedirectPath } from "@/app/lib/pwa/shareTarget";

/**
 * Share target fallback. The service worker normally answers this POST and
 * keeps the photo; it only reaches the server when no worker controls the app
 * (e.g. its first launch, or storage was cleared). The photo isn't read or kept
 * here: the page explains that the share didn't arrive.
 */
export const POST = (request: Request) =>
	Response.redirect(
		new URL(shareRedirectPath("unavailable"), request.url),
		303,
	);
