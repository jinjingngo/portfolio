/**
 * The site's service worker, built to public/sw.js by scripts/build-sw.mjs.
 * A thin shell: decisions live in src/app/lib/pwa/ (swProtocol, cachePolicy,
 * cacheStrategies).
 */

import {
	CACHE_LIMITS,
	cacheNames,
	OFFLINE_PATH,
	obsoleteCaches,
	PRECACHE_PATHS,
	type Strategy,
	strategyFor,
} from "../app/lib/pwa/cachePolicy";
import {
	cacheFirst,
	networkFirst,
	offlineResponse,
	staleWhileRevalidate,
	trimCache,
} from "../app/lib/pwa/cacheStrategies";
import {
	GET_VERSION,
	NOTIFICATION_ICON,
	notificationFromPush,
	parseWorkerMessage,
	SKIP_WAITING,
	safeNotificationPath,
} from "../app/lib/pwa/swProtocol";

declare const self: ServiceWorkerGlobalScope;
/** Build version (commit), injected at build time; also makes each deploy's worker byte-different. */
declare const __SW_VERSION__: string;

const VERSION = __SW_VERSION__;
const CACHES = cacheNames(VERSION);

// Precache the basics. A new worker then waits until the page asks it to
// take over (see SKIP_WAITING), so open pages never switch code mid-session.
self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(CACHES.precache)
			.then((cache) => cache.addAll([...PRECACHE_PATHS])),
	);
});

// Drop older versions' pages and precache; shared static/asset caches stay,
// so a tab still on the previous version keeps finding its files.
self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			const obsolete = obsoleteCaches(await caches.keys(), VERSION);
			await Promise.all(obsolete.map((name) => caches.delete(name)));
			await self.clients.claim();
		})(),
	);
});

const network = (request: Request) => fetch(request);

/** Runs the chosen strategy for one request and keeps its cache bounded. */
const respond = async (
	strategy: Exclude<Strategy, { kind: "network-only" }>,
	event: FetchEvent,
) => {
	const { request } = event;
	const waitUntil = (work: Promise<unknown>) => event.waitUntil(work);
	const cache = await caches.open(CACHES[strategy.cache]);
	try {
		if (strategy.kind === "cache-first") {
			const response = await cacheFirst(request, cache, network);
			waitUntil(trimCache(cache, CACHE_LIMITS.maxStatic));
			return response;
		}
		if (strategy.kind === "stale-while-revalidate") {
			const response = await staleWhileRevalidate(
				request,
				cache,
				network,
				waitUntil,
			);
			waitUntil(trimCache(cache, CACHE_LIMITS.maxAssets));
			return response;
		}
		const response = await networkFirst(request, cache, network, {
			timeoutMs: CACHE_LIMITS.navigationTimeoutMs,
			waitUntil,
			// A precached copy of this page (e.g. "/"), else the offline page.
			fallback: async () =>
				(await caches.match(request)) ??
				(await caches.match(OFFLINE_PATH)),
		});
		waitUntil(trimCache(cache, CACHE_LIMITS.maxPages));
		return response;
	} catch {
		return offlineResponse();
	}
};

self.addEventListener("fetch", (event) => {
	const { request } = event;
	const strategy = strategyFor(
		{
			method: request.method,
			url: request.url,
			mode: request.mode,
			destination: request.destination,
			isRsc: request.headers.has("RSC"),
		},
		self.location.origin,
	);
	// Network-only: don't intervene at all; the browser handles it as usual.
	if (strategy.kind === "network-only") return;
	event.respondWith(respond(strategy, event));
});

self.addEventListener("message", (event) => {
	const message = parseWorkerMessage(event.data);
	if (message?.type === SKIP_WAITING) {
		event.waitUntil(self.skipWaiting());
		return;
	}
	if (message?.type === GET_VERSION) {
		event.ports[0]?.postMessage({ version: VERSION });
	}
});

self.addEventListener("push", (event) => {
	const payload = (() => {
		try {
			return event.data?.json();
		} catch {
			return undefined;
		}
	})();
	const { title, body, url } = notificationFromPush(payload);
	event.waitUntil(
		self.registration.showNotification(title, {
			body,
			data: { url },
			icon: NOTIFICATION_ICON,
			badge: NOTIFICATION_ICON,
		}),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const url = safeNotificationPath(event.notification.data?.url);
	event.waitUntil(
		(async () => {
			// Only windows this worker controls can be navigated; focus first,
			// while the click still counts as a user action.
			const [existing] = await self.clients.matchAll({ type: "window" });
			if (!existing) {
				await self.clients.openWindow(url);
				return;
			}
			try {
				const focused = await existing.focus();
				await focused.navigate(url);
			} catch {
				await self.clients.openWindow(url);
			}
		})(),
	);
});
