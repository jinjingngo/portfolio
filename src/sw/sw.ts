/**
 * The site's service worker, built to public/sw.js by scripts/build-sw.mjs.
 * A thin shell: decisions live in src/app/lib/pwa/swProtocol.ts.
 */
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

// A new worker waits until the page asks it to take over (see SKIP_WAITING).
self.addEventListener("install", () => {});

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
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
			const windows = await self.clients.matchAll({
				type: "window",
				includeUncontrolled: true,
			});
			const existing = windows[0];
			if (existing) {
				await existing.navigate(url);
				await existing.focus();
				return;
			}
			await self.clients.openWindow(url);
		})(),
	);
});
