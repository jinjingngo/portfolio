import { useEffect, useRef, useState } from "react";
import {
	activateWaitingWorker,
	registerServiceWorker,
	serviceWorkerSupported,
} from "@/app/lib/pwa/registerServiceWorker";

/** Calls `onInstalled` when `worker` finishes installing (it then waits). */
const whenInstalled = (
	worker: ServiceWorker | null,
	onInstalled: () => void,
) => {
	worker?.addEventListener("statechange", () => {
		if (worker.state !== "installed") return;
		onInstalled();
	});
};

/**
 * Reports a waiting update for `registration` through `onWaiting`, now and
 * later, and checks for a new deploy whenever the app returns to the
 * foreground. Returns a function that stops watching.
 */
const watchForUpdates = (
	registration: ServiceWorkerRegistration,
	onWaiting: (registration: ServiceWorkerRegistration) => void,
) => {
	// Only an update replaces something: on the first install nothing controls the page.
	const offer = () => {
		if (!registration.waiting || !navigator.serviceWorker.controller)
			return;
		onWaiting(registration);
	};
	offer();
	// An update may already be installing (the browser checks after navigation).
	whenInstalled(registration.installing, offer);
	const onUpdateFound = () => whenInstalled(registration.installing, offer);
	registration.addEventListener("updatefound", onUpdateFound);

	const onVisible = () => {
		if (document.visibilityState !== "visible") return;
		registration
			.update()
			.catch((error) =>
				console.warn("Service worker update check failed", error),
			);
	};
	document.addEventListener("visibilitychange", onVisible);

	return () => {
		registration.removeEventListener("updatefound", onUpdateFound);
		document.removeEventListener("visibilitychange", onVisible);
	};
};

/**
 * Registers the service worker (production builds only) and reports when a
 * newly deployed version is waiting. `update()` switches to it and reloads
 * once; nothing takes over mid-session without the user choosing it.
 */
export const usePwaUpdate = () => {
	const [waiting, setWaiting] = useState<ServiceWorkerRegistration | null>(
		null,
	);
	const requestedRef = useRef(false);

	useEffect(() => {
		if (
			process.env.NODE_ENV !== "production" ||
			!serviceWorkerSupported()
		) {
			return;
		}
		let active = true;
		let unwatch: (() => void) | undefined;
		const container = navigator.serviceWorker;

		// The controller also changes on the first install (clients.claim) and
		// when another tab took the update; only a Reload chosen here reloads.
		const onControllerChange = () => {
			if (!requestedRef.current) {
				setWaiting(null);
				return;
			}
			requestedRef.current = false;
			window.location.reload();
		};
		container.addEventListener("controllerchange", onControllerChange);

		registerServiceWorker()
			.then((registration) => {
				if (!registration || !active) return;
				unwatch = watchForUpdates(registration, (ready) => {
					if (active) setWaiting(ready);
				});
			})
			.catch((error) =>
				console.error("Service worker registration failed", error),
			);

		return () => {
			active = false;
			unwatch?.();
			container.removeEventListener(
				"controllerchange",
				onControllerChange,
			);
		};
	}, []);

	const update = () => {
		if (!waiting) return;
		requestedRef.current = true;
		activateWaitingWorker(waiting);
	};

	const dismiss = () => setWaiting(null);

	return { updateReady: waiting !== null, update, dismiss };
};
