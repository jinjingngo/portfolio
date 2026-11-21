/**
 * Pure caching rules for the service worker: which strategy and cache each
 * request gets, the cache names per version, and which caches are obsolete.
 * No worker APIs here; the worker only executes these decisions.
 */

/** Caching limits; the one place these numbers live. */
export const CACHE_LIMITS = Object.freeze({
	/** How long a page waits for the network before using its cached copy. */
	navigationTimeoutMs: 3000,
	/** Pages kept for offline use (per version). */
	maxPages: 30,
	/** Images, icons and other public files. */
	maxAssets: 120,
	/** Hashed /_next/static files (scripts, styles, fonts). */
	maxStatic: 250,
});

/** Page served when offline and the page isn't cached. */
export const OFFLINE_PATH = "/offline";

/** Fetched at install so the basics work offline from the first visit on. */
export const PRECACHE_PATHS = Object.freeze([
	OFFLINE_PATH,
	"/",
	"/icon-192.png",
	"/icon-512.png",
]);

const PREFIX = "jj";

/**
 * Cache names. Pages and the precache are per version, so cached HTML always
 * matches its scripts; hashed static files and public assets are shared
 * across versions (their URLs change when their content does), so a tab still
 * running the previous version keeps finding its files.
 */
export const cacheNames = (version: string) =>
	Object.freeze({
		precache: `${PREFIX}-precache-${version}`,
		pages: `${PREFIX}-pages-${version}`,
		static: `${PREFIX}-static`,
		assets: `${PREFIX}-assets`,
	});

/** Caches from older versions of this site's worker; others are left alone. */
export const obsoleteCaches = (
	existing: readonly string[],
	version: string,
) => {
	const current = new Set<string>(Object.values(cacheNames(version)));
	return existing.filter(
		(name) => name.startsWith(`${PREFIX}-`) && !current.has(name),
	);
};

export type Strategy =
	| { kind: "network-only" }
	| { kind: "cache-first"; cache: "static" }
	| { kind: "network-first"; cache: "pages" }
	| { kind: "stale-while-revalidate"; cache: "assets" };

/** What the worker needs to know about a request. */
export type RequestInfo = {
	method: string;
	url: string;
	/** `request.mode`: "navigate" for page loads. */
	mode: string;
	/** `request.destination`, e.g. "image", "font", "document". */
	destination: string;
	/** Next.js client navigations and prefetches carry an `RSC` header. */
	isRsc: boolean;
};

const NETWORK_ONLY: Strategy = { kind: "network-only" };

const ALWAYS_FRESH = new Set([
	"/sw.js",
	"/webPushServiceWorker.js",
	"/manifest.webmanifest",
	"/robots.txt",
	"/sitemap.xml",
]);

const ASSET_DESTINATIONS = new Set(["image", "font"]);
const ASSET_EXTENSION = /\.(png|jpe?g|gif|webp|avif|svg|ico|woff2?|pdf)$/i;

/**
 * The strategy for a request to the site at `origin`. Anything not clearly
 * safe to cache goes to the network: APIs, non-GET, other origins, the
 * worker and manifest, and Next.js RSC fetches (their cached copies would
 * need header-exact matching; offline, Next falls back to a page load).
 */
export const strategyFor = (request: RequestInfo, origin: string): Strategy => {
	if (request.method !== "GET") return NETWORK_ONLY;
	const url = new URL(request.url);
	if (url.origin !== origin) return NETWORK_ONLY;

	const path = url.pathname;
	if (path.startsWith("/api/") || path.startsWith("/cdn-cgi/"))
		return NETWORK_ONLY;
	if (
		ALWAYS_FRESH.has(path) ||
		request.isRsc ||
		url.searchParams.has("_rsc")
	) {
		return NETWORK_ONLY;
	}
	if (path.startsWith("/_next/static/"))
		return { kind: "cache-first", cache: "static" };
	if (request.mode === "navigate")
		return { kind: "network-first", cache: "pages" };
	if (
		path.startsWith("/_next/image") ||
		ASSET_DESTINATIONS.has(request.destination) ||
		ASSET_EXTENSION.test(path)
	) {
		return { kind: "stale-while-revalidate", cache: "assets" };
	}
	return NETWORK_ONLY;
};

/** What the worker knows about a response when deciding to store it. */
export type ResponseInfo = {
	status: number;
	/** `response.type`: "basic" for same-origin, "opaque" for no-cors. */
	type: string;
	cacheControl: string | null;
	/** Redirected responses can't be served for navigations. */
	redirected: boolean;
};

/** Only complete, same-origin, storable successes are cached. */
export const isCacheable = (response: ResponseInfo) =>
	response.status === 200 &&
	response.type === "basic" &&
	!response.redirected &&
	!/\bno-store\b/i.test(response.cacheControl ?? "");

/**
 * A path on this site, or "/" for anything that could leave it
 * ("//evil", "https://…", "javascript:…", missing).
 */
export const safeSitePath = (value: unknown) =>
	typeof value === "string" &&
	value.startsWith("/") &&
	!value.startsWith("//")
		? value
		: "/";

/**
 * Where to send a navigation that's offline and not cached: the offline page,
 * remembering the page that was asked for so "Try again" can return to it.
 * (Serving the offline page's HTML under another URL breaks Next's router.)
 */
export const offlineUrl = (requestUrl: string) => {
	const url = new URL(requestUrl);
	const from = `${url.pathname}${url.search}`;
	return `${OFFLINE_PATH}?${new URLSearchParams({ from })}`;
};

const STATIC_ASSET = /(?:src|href)="(\/_next\/static\/[^"?#]+)"/g;

/**
 * The hashed /_next/static files a page's HTML loads, so the worker can
 * cache them with the page and it still works (hydrates) offline.
 */
export const staticAssetsIn = (html: string) => [
	...new Set([...html.matchAll(STATIC_ASSET)].map((match) => match[1])),
];
