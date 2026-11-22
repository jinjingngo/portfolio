/**
 * Speculation Rules experiment (/lab/speculation-rules): the rules the demo
 * adds, and how a page tells which way it was loaded. Pure: the browser's
 * navigation timing is read by the page and passed in.
 */

/** Links opted in to prerendering carry this attribute. */
export const SPECULATE_ATTRIBUTE = "data-speculate";

/** The demo's target page, reached three different ways. */
export const TARGET_PATH = "/lab/speculation-rules/target";

/** How each demo link reaches the target (also its `?via=` value). */
export const VIA = Object.freeze({
	prerender: "prerender",
	plain: "plain",
	link: "link",
});

/**
 * The rules: prerender only links marked with SPECULATE_ATTRIBUTE, once the
 * pointer rests on one (`moderate`), so nothing is fetched for links nobody
 * points at and nothing outside this page is affected.
 */
export const speculationRules = () => ({
	prerender: [
		{
			where: { selector_matches: `a[${SPECULATE_ATTRIBUTE}]` },
			eagerness: "moderate",
		},
	],
});

/** What the browser reports about how the current document was loaded. */
export type NavigationFacts = {
	/** PerformanceNavigationTiming.activationStart: > 0 for a prerendered page. */
	activationStart: number;
	/** PerformanceNavigationTiming.type: "navigate", "reload", "back_forward"… */
	type: string;
	/**
	 * Whether the page was first rendered together with its document (by
	 * hydrating the server HTML). False when Next.js rendered it client-side,
	 * including a Back to the document's own URL.
	 */
	loadedWithDocument: boolean;
};

export type LoadKind = "prerendered" | "full-load" | "client-side" | "history";

/**
 * How the current page was reached. A Next.js <Link> or Back swaps the page
 * without loading a new document, so the document's timing says nothing
 * about this visit.
 */
export const loadKind = (facts: NavigationFacts): LoadKind => {
	if (!facts.loadedWithDocument) return "client-side";
	if (facts.activationStart > 0) return "prerendered";
	if (facts.type === "back_forward") return "history";
	return "full-load";
};

export const LOAD_KIND_TEXT: Record<LoadKind, string> = {
	prerendered:
		"Prerendered: the browser loaded this page in the background while you pointed at the link, then showed it instantly.",
	"full-load":
		"Full page load: the browser fetched and rendered this page after you clicked.",
	"client-side":
		"Client-side navigation: Next.js had prefetched the page data and swapped it in without loading a new document.",
	history: "Back/forward: the browser restored this page from history.",
};
