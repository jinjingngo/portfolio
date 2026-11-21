"use client";

import { useEffect, useState } from "react";
import { t } from "try";
import {
	isPagesCache,
	OFFLINE_PATH,
	safeSitePath,
} from "@/app/lib/pwa/cachePolicy";

/**
 * "Try again" back to the page that was asked for, and the pages this device
 * has saved for offline use. Without JavaScript, Try again still goes home.
 */
export function CachedPages() {
	const [from, setFrom] = useState("/");
	const [paths, setPaths] = useState<string[]>([]);

	useEffect(() => {
		setFrom(
			safeSitePath(
				new URLSearchParams(window.location.search).get("from"),
			),
		);
		const load = async () => {
			if (typeof caches === "undefined") return;
			const names = (await caches.keys()).filter(isPagesCache);
			const urls = await Promise.all(
				names.map(async (name) =>
					(await (await caches.open(name)).keys()).map(
						(request) => new URL(request.url).pathname,
					),
				),
			);
			setPaths(
				[...new Set(urls.flat())]
					.filter((path) => path !== OFFLINE_PATH)
					.sort(),
			);
		};
		t(load()).then(([ok, error]) => {
			if (!ok) console.warn("Couldn't list cached pages", error);
		});
	}, []);

	return (
		<div className="flex flex-col gap-3">
			<a
				href={from}
				className="w-fit rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700"
			>
				Try again
			</a>
			{paths.length > 0 && (
				<>
					<p className="text-sm text-gray-600">
						Saved on this device:
					</p>
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
				</>
			)}
		</div>
	);
}
