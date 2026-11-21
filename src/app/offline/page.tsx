import type { Metadata } from "next";
import Link from "next/link";
import { CachedPages } from "./cachedPages";

export const metadata: Metadata = {
	title: "Offline · Jinjing Wu",
	robots: { index: false },
};

/** Shown by the service worker when offline and the page isn't cached. */
export default function OfflinePage() {
	return (
		<div className="flex min-h-full w-full max-w-2xl flex-col justify-center gap-6 px-4 py-12">
			<h1 className="text-4xl text-gray-900 md:text-5xl">
				You&apos;re offline
			</h1>
			<p className="text-gray-700">
				This page isn&apos;t saved on this device yet. Check your
				connection and try again, or open a page you&apos;ve visited
				before.
			</p>
			<CachedPages />
			<Link
				className="w-fit underline decoration-wavy underline-offset-4"
				href="/"
			>
				← Home
			</Link>
		</div>
	);
}
