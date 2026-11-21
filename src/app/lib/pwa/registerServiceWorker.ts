import { SKIP_WAITING } from "./swProtocol";

/** The site's one service worker (built from src/sw/sw.ts). */
export const SERVICE_WORKER_URL = "/sw.js";

export const serviceWorkerSupported = () =>
	typeof navigator !== "undefined" && "serviceWorker" in navigator;

/**
 * Registers the site's worker for the whole site, or null where service
 * workers aren't supported. Safe to call repeatedly: the browser reuses the
 * registration, and replaces the old push-only worker at the same scope.
 */
export const registerServiceWorker = async () => {
	if (!serviceWorkerSupported()) return null;
	return navigator.serviceWorker.register(SERVICE_WORKER_URL, {
		scope: "/",
		updateViaCache: "none",
	});
};

/** Asks a waiting (newly deployed) worker to take over now. */
export const activateWaitingWorker = (
	registration: ServiceWorkerRegistration,
) => registration.waiting?.postMessage({ type: SKIP_WAITING });
