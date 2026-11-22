"use client";

import { useEffect, useState } from "react";
import {
	LOAD_KIND_TEXT,
	type LoadKind,
	loadKind,
} from "@/app/lib/navigation/speculation";

type Report = { kind: LoadKind; via: string | null; shownAfterMs: number };

/** Reads how this document was loaded from the browser's navigation timing. */
const readReport = (): Report | null => {
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
		sameDocumentUrl: entry.name === location.href,
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

	useEffect(() => {
		const read = () => setReport(readReport());
		const prerendering = (document as { prerendering?: boolean })
			.prerendering;
		if (!prerendering) {
			read();
			return;
		}
		document.addEventListener("prerenderingchange", read, { once: true });
		return () => document.removeEventListener("prerenderingchange", read);
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
