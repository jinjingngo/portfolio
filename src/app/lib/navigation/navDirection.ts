/**
 * Which way a navigation moves through the site, for view transitions:
 * deeper in the URL tree (/ → /lab → /lab/x) is forward, up is back.
 * Pure: the current and target paths are passed in.
 */

/** View transition types, tagged on links and matched in CSS (globals.css). */
export const NAV_FORWARD = "nav-forward";
export const NAV_BACK = "nav-back";

export type NavDirection = typeof NAV_FORWARD | typeof NAV_BACK;

/** Path segments, ignoring query, hash and trailing slashes: "/lab/x?y" → 2. */
const depth = (path: string) =>
	new URL(path, "https://site.invalid").pathname.split("/").filter(Boolean)
		.length;

const pathOf = (path: string) =>
	new URL(path, "https://site.invalid").pathname.replace(/\/+$/, "") || "/";

/**
 * The direction from `from` to `to`, or null for no directional animation
 * (same page, or a sibling at the same depth).
 */
export const navDirection = (from: string, to: string): NavDirection | null => {
	if (pathOf(from) === pathOf(to)) return null;
	const change = depth(to) - depth(from);
	if (change > 0) return NAV_FORWARD;
	if (change < 0) return NAV_BACK;
	return null;
};

/** The `transitionTypes` for a <Link> from `from` to `to`. */
export const transitionTypesFor = (from: string, to: string) => {
	const direction = navDirection(from, to);
	return direction ? [direction] : [];
};
