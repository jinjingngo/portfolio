"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
	LOAD_KIND_TEXT,
	type LoadKind,
	loadKind,
} from "@/app/lib/navigation/speculation";

type Report = { kind: LoadKind; via: string | null; shownAfterMs: number };

const noSubscription = () => () => {};

/** Reads how this page was reached from the browser's navigation timing. */
const readReport = (loadedWithDocument: boolean): Report | null => {
	const [entry] = performance.getEntriesByType("navigation") as
		| PerformanceNavigationTiming[]
		| [];
	if (!entry) return null;
	const activationStart =
		(entry as PerformanceNavigationTiming & { activationStart?: number })
			.activationStart ?? 0;
	const kind = loadKind({
		activationStart,
		type: entry.type,
		loadedWithDocument,
	});
	return {
		kind,
		via: new URLSearchParams(location.search).get("via"),
		// A prerendered page is shown at activation; others when the response ends.
		shownAfterMs: Math.round(
			kind === "prerendered" ? 0 : entry.responseEnd - entry.startTime,
		),
	};
};

/**
 * Says how you reached this page. A prerendered page runs before it is shown,
 * so the report waits until it is actually displayed (`prerenderingchange`).
 */
export const LoadReport = () => {
	const [report, setReport] = useState<Report | null>(null);
	// True only while hydrating the server HTML, i.e. when this page came with
	// a newly loaded document; false for any client-side render (Link, Back).
	// Limits: a hydration error re-renders on the client (reads client-side),
	// and with cacheComponents a revisited page keeps this state.
	const hydrating = useSyncExternalStore(
		noSubscription,
		() => false,
		() => true,
	);
	const [loadedWithDocument] = useState(hydrating);

	useEffect(() => {
		const read = () => setReport(readReport(loadedWithDocument));
		const prerendering = (document as { prerendering?: boolean })
			.prerendering;
		if (!prerendering) {
			read();
			return;
		}
		document.addEventListener("prerenderingchange", read, { once: true });
		return () => document.removeEventListener("prerenderingchange", read);
	}, [loadedWithDocument]);

	// Back from another site can restore this page from the bfcache as it was,
	// without running React again: say so instead of showing the old report.
	useEffect(() => {
		const onShow = (event: PageTransitionEvent) => {
			if (!event.persisted) return;
			setReport((current) => current && { ...current, kind: "history" });
		};
		window.addEventListener("pageshow", onShow);
		return () => window.removeEventListener("pageshow", onShow);
	}, []);

	if (!report) return null;
	return (
		<div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-5">
			<p
				className="font-medium text-gray-900"
				data-load-kind={report.kind}
			>
				{LOAD_KIND_TEXT[report.kind]}
			</p>
			{report.kind === "full-load" && (
				<p className="text-sm text-gray-600">
					The page arrived {report.shownAfterMs} ms after the click.
				</p>
			)}
			{report.via && (
				<p className="text-sm text-gray-600">
					You used the “{report.via}” link.
				</p>
			)}
		</div>
	);
};
