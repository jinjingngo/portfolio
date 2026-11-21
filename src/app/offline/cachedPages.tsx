"use client";

import { useEffect, useState } from "react";
import { t } from "try";

/** Pages this device has saved for offline use (from the service worker's caches). */
export function CachedPages() {
	const [paths, setPaths] = useState<string[]>([]);

	useEffect(() => {
		const load = async () => {
			if (typeof caches === "undefined") return;
			const names = (await caches.keys()).filter((name) =>
				name.startsWith("jj-pages-"),
			);
			const urls = await Promise.all(
				names.map(async (name) =>
					(await (await caches.open(name)).keys()).map(
						(request) => new URL(request.url).pathname,
					),
				),
			);
			const unique = [...new Set(urls.flat())].filter(
				(path) => path !== "/offline",
			);
			setPaths(unique.sort());
		};
		t(load()).then(([ok, error]) => {
			if (!ok) console.warn("Couldn't list cached pages", error);
		});
	}, []);

	return (
		<div className="flex flex-col gap-3">
			{paths.length > 0 && (
				<ul className="flex flex-col gap-1">
					{paths.map((path) => (
						<li key={path}>
							<a
								className="underline underline-offset-4"
								href={path}
							>
								{path}
							</a>
						</li>
					))}
				</ul>
			)}
			<button
				type="button"
				onClick={() => window.location.reload()}
				className="w-fit rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700"
			>
				Try again
			</button>
		</div>
	);
}
