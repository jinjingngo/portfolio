"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { WARM_PAGE } from "@/app/lib/pwa/swProtocol";

/**
 * Asks the service worker to save each page you navigate to for offline
 * use. Client-side navigations fetch RSC payloads (often prefetched), not
 * HTML, so the worker can't see them; the worker skips pages it already has.
 */
export const OfflinePageSaver = () => {
	const pathname = usePathname();

	useEffect(() => {
		const worker = navigator.serviceWorker?.controller;
		if (!worker) return;
		worker.postMessage({ type: WARM_PAGE, path: pathname });
	}, [pathname]);

	return null;
};
