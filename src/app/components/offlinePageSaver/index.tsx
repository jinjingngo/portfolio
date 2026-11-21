"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { WARM_PAGE } from "@/app/lib/pwa/swProtocol";

const warm = (path: string) => {
	const worker = navigator.serviceWorker?.controller;
	if (!worker) return;
	worker.postMessage({ type: WARM_PAGE, path });
};

/**
 * Asks the service worker to save each page you navigate to for offline
 * use. Client-side navigations fetch RSC payloads (often prefetched), not
 * HTML, so the worker can't see them; the worker skips pages it already has.
 * On a first visit the worker takes control only after the page loaded, so
 * the current page is also sent when a controller arrives.
 */
export const OfflinePageSaver = () => {
	const pathname = usePathname();
	const pathRef = useRef(pathname);
	pathRef.current = pathname;

	useEffect(() => {
		warm(pathname);
	}, [pathname]);

	useEffect(() => {
		const container = navigator.serviceWorker;
		if (!container) return;
		const onControllerChange = () => warm(pathRef.current);
		container.addEventListener("controllerchange", onControllerChange);
		return () =>
			container.removeEventListener(
				"controllerchange",
				onControllerChange,
			);
	}, []);

	return null;
};
