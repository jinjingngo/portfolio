/**
 * The site's service worker, built to public/sw.js by scripts/build-sw.mjs.
 * A thin shell: decisions live in src/app/lib/pwa/ (swProtocol, cachePolicy,
 * cacheStrategies).
 */

import { t } from "try";
import {
	applyBadge,
	type BadgeNavigator,
	badgeFor,
} from "../app/lib/pwa/appBadge";
import {
	CACHE_LIMITS,
	cacheNames,
	isCacheable,
	isOfflinePage,
	OFFLINE_PATH,
	obsoleteCaches,
	offlineUrl,
	PRECACHE_PATHS,
	type Strategy,
	staticAssetsIn,
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
	checkSharedPhoto,
	isShareTargetRequest,
	SHARE_TARGET_FIELD,
	SHARED_PHOTO_KEY,
	type ShareOutcome,
	shareRedirectPath,
} from "../app/lib/pwa/shareTarget";
import {
	GET_VERSION,
	NOTIFICATION_ICON,
	notificationFromPush,
	parseWorkerMessage,
	SKIP_WAITING,
	safeNotificationPath,
	WARM_PAGE,
} from "../app/lib/pwa/swProtocol";

declare const self: ServiceWorkerGlobalScope;
/** Build version (commit), injected at build time; also makes each deploy's worker byte-different. */
declare const __SW_VERSION__: string;

const VERSION = __SW_VERSION__;
const CACHES = cacheNames(VERSION);

// Precache the basics. A new worker then waits until the page asks it to
// take over (see SKIP_WAITING), so open pages never switch code mid-session.
self.addEventListener("install", (event) => {
	event.waitUntil(precache());
});

/** Caches the precache pages, plus the scripts and styles they load. */
const precache = async () => {
	const pages = await caches.open(CACHES.precache);
	await pages.addAll(
		PRECACHE_PATHS.map((path) => new Request(path, { cache: "reload" })),
	);
	const assets = new Set<string>();
	for (const path of PRECACHE_PATHS) {
		const response = await pages.match(path);
		if (!response?.headers.get("content-type")?.includes("text/html"))
			continue;
		for (const asset of staticAssetsIn(await response.text()))
			assets.add(asset);
	}
	// Best effort: a missing chunk must not stop the worker from installing.
	const statics = await caches.open(CACHES.static);
	await Promise.all(
		[...assets].map((asset) => statics.add(asset).catch(() => undefined)),
	);
};

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
			const response = await cacheFirst(
				request,
				cache,
				network,
				waitUntil,
			);
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
			// A precached copy (e.g. "/"), else the offline page: served directly
			// for /offline itself, otherwise via a redirect so the URL matches it.
			fallback: async () => {
				if (new URL(request.url).pathname === OFFLINE_PATH) {
					return caches.match(OFFLINE_PATH);
				}
				return (
					(await caches.match(request)) ??
					// e.g. "/?utm=x" offline: the saved "/" is better than the offline page.
					(await caches.match(request, { ignoreSearch: true })) ??
					Response.redirect(
						new URL(offlineUrl(request.url), self.location.origin),
						302,
					)
				);
			},
		});
		waitUntil(trimCache(cache, CACHE_LIMITS.maxPages));
		return response;
	} catch {
		return offlineResponse();
	}
};

/**
 * Saves a page's HTML for offline use after a client-side navigation to it (WARM_PAGE),
 * unless this version already has it. Background work: failures only log.
 */
const warmPage = async (path: string) => {
	const cache = await caches.open(CACHES.pages);
	const request = new Request(path, { credentials: "same-origin" });
	if (await cache.match(request)) return;
	const response = await fetch(request);
	const html = response.headers.get("content-type")?.includes("text/html");
	if (!html || !isCacheable(responseInfo(response))) return;
	await cache.put(request, response);
	await trimCache(cache, CACHE_LIMITS.maxPages);
};

const responseInfo = (response: Response) => ({
	status: response.status,
	type: response.type,
	cacheControl: response.headers.get("cache-control"),
	redirected: response.redirected,
});

/**
 * A photo shared into the app (Web Share Target): kept in its own cache
 * until Camera Translate picks it up, then the visitor is sent there.
 */
const receiveShare = async (request: Request) => {
	const [read, , form] = await t(request.formData());
	const entry = read ? form.get(SHARE_TARGET_FIELD) : null;
	const photo = entry instanceof File ? entry : null;
	const check = checkSharedPhoto(photo);
	if (!check.ok || !photo) return shareRedirect("invalid");
	const [saved, error] = await t(async () => {
		const cache = await caches.open(CACHES.share);
		await cache.put(
			SHARED_PHOTO_KEY,
			new Response(photo, { headers: { "content-type": photo.type } }),
		);
	});
	if (!saved) console.warn("Couldn't keep the shared photo", error);
	return shareRedirect(saved ? "ready" : "unavailable");
};

/** 303: the browser follows the POST with a GET of the page. */
const shareRedirect = (outcome: ShareOutcome) =>
	Response.redirect(
		new URL(shareRedirectPath(outcome), self.location.origin),
		303,
	);

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (isShareTargetRequest(request, self.location.origin)) {
		event.respondWith(receiveShare(request));
		return;
	}
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
	if (message?.type === WARM_PAGE) {
		if (!isOfflinePage(message.path, self.location.origin)) return;
		event.waitUntil(
			warmPage(message.path).catch((error) =>
				console.warn("Couldn't save page for offline use", error),
			),
		);
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
		(async () => {
			await self.registration.showNotification(title, {
				body,
				data: { url },
				icon: NOTIFICATION_ICON,
				badge: NOTIFICATION_ICON,
			});
			await updateBadge();
		})(),
	);
});

/** Badges the app icon with the number of notifications still showing. */
const updateBadge = async () => {
	const [listed, , shown] = await t(self.registration.getNotifications());
	if (!listed) return;
	await applyBadge(self.navigator as BadgeNavigator, badgeFor(shown.length));
};

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const url = safeNotificationPath(event.notification.data?.url);
	// Separate from opening the window, which must not wait behind it.
	event.waitUntil(updateBadge());
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
