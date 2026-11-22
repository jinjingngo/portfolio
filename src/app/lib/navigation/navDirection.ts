/**
 * Which way a navigation moves through the site, for view transitions:
 * deeper in the URL tree (/ → /lab → /lab/x) is forward, up is back.
 * Pure: the current and target paths are passed in.
 */

/** View transition types, tagged on links and matched in CSS (globals.css). */
export const NAV_FORWARD = "nav-forward";
export const NAV_BACK = "nav-back";

export type NavDirection = typeof NAV_FORWARD | typeof NAV_BACK;

/** Any origin works: only the path matters here. */
const BASE = "https://site.invalid";

/** A path's segments, ignoring query, hash and trailing slashes: "/lab/x?y" → ["lab", "x"]. */
const segments = (url: URL) => url.pathname.split("/").filter(Boolean);

/**
 * The direction from `from` to `to`, or null for no directional animation
 * (same page, or a sibling at the same depth).
 */
export const navDirection = (from: string, to: string): NavDirection | null => {
	// A relative `to` ("#top", "?tab=2", "x") is relative to the current page.
	const current = new URL(from, BASE);
	const target = new URL(to, current);
	const fromPath = segments(current);
	const toPath = segments(target);
	if (fromPath.join("/") === toPath.join("/")) return null;
	const change = toPath.length - fromPath.length;
	if (change > 0) return NAV_FORWARD;
	if (change < 0) return NAV_BACK;
	return null;
};

/** The `transitionTypes` for a <Link> from `from` to `to`. */
export const transitionTypesFor = (from: string, to: string) => {
	const direction = navDirection(from, to);
	return direction ? [direction] : [];
};
