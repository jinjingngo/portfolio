import { useEffect, useRef, useState } from "react";
import {
	activateWaitingWorker,
	registerServiceWorker,
	serviceWorkerSupported,
} from "@/app/lib/pwa/registerServiceWorker";

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
		if (process.env.NODE_ENV !== "production" || !serviceWorkerSupported())
			return;
		let active = true;
		const container = navigator.serviceWorker;

		// The first install also changes the controller (clients.claim); only an
		// update the user asked for reloads the page.
		const onControllerChange = () => {
			if (!requestedRef.current) return;
			requestedRef.current = false;
			window.location.reload();
		};
		container.addEventListener("controllerchange", onControllerChange);

		const watch = (registration: ServiceWorkerRegistration) => {
			const offer = () => {
				if (active && registration.waiting && container.controller) {
					setWaiting(registration);
				}
			};
			offer();
			registration.addEventListener("updatefound", () => {
				const worker = registration.installing;
				worker?.addEventListener("statechange", () => {
					if (worker.state === "installed") offer();
				});
			});
			// Look for a new deploy whenever the app comes back to the foreground.
			const onVisible = () => {
				if (document.visibilityState === "visible") {
					registration.update().catch(() => {});
				}
			};
			document.addEventListener("visibilitychange", onVisible);
			return () =>
				document.removeEventListener("visibilitychange", onVisible);
		};

		let unwatch: (() => void) | undefined;
		registerServiceWorker()
			.then((registration) => {
				if (registration && active) unwatch = watch(registration);
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
