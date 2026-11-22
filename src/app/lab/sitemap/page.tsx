import type { Metadata } from "next";
import Link from "next/link";
import { readLabFolders } from "@/app/lib/server/labFolders";
import {
	EXCLUDED_PAGES,
	FIXED_PAGES,
	labExperiments,
	publicPaths,
	sitemapEntries,
} from "@/app/lib/site/routes";

export const metadata: Metadata = {
	title: "Sitemap · Jinjing Wu",
	description:
		"How this site's sitemap.xml is generated from its pages at build time.",
};

const linkClass =
	"underline decoration-wavy underline-offset-4 hover:decoration-solid";
const code = "rounded bg-gray-100 px-1 py-0.5 text-sm text-gray-900";

/** Shows the sitemap this build generated, and how it is generated. */
export default function SitemapPage() {
	const entries = sitemapEntries(
		publicPaths(labExperiments(readLabFolders())),
	);

	return (
		<div className="flex min-w-0 flex-1 flex-col gap-8">
			<div>
				<Link
					className="text-sm underline decoration-wavy underline-offset-4"
					href="/lab"
				>
					← /lab
				</Link>
				<h1 className="mt-5 text-4xl text-gray-900 md:text-5xl">
					Sitemap
				</h1>
				<p className="mt-3 max-w-2xl text-gray-600">
					This site&apos;s{" "}
					<a className={linkClass} href="/sitemap.xml">
						sitemap.xml
					</a>{" "}
					builds itself. A new experiment appears in it, and in the
					/lab list, as soon as its page is deployed; nothing needs to
					be listed by hand.
				</p>
			</div>

			<section className="flex max-w-2xl flex-col gap-3">
				<h2 className="text-2xl text-gray-900">
					What this build lists
				</h2>
				<div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
					<table className="w-full text-left text-sm">
						<thead className="bg-gray-50 text-gray-600">
							<tr>
								<th className="px-4 py-2 font-medium">Page</th>
								<th className="px-4 py-2 font-medium">
									Changes
								</th>
								<th className="px-4 py-2 font-medium">
									Priority
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-100">
							{entries.map((entry) => (
								<tr key={entry.url}>
									<td className="px-4 py-2">
										<a
											className={linkClass}
											href={new URL(entry.url).pathname}
										>
											{new URL(entry.url).pathname}
										</a>
									</td>
									<td className="px-4 py-2 text-gray-700">
										{entry.changeFrequency}
									</td>
									<td className="px-4 py-2 text-gray-700">
										{entry.priority}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>

			<section className="flex max-w-2xl flex-col gap-3 text-gray-700">
				<h2 className="text-2xl text-gray-900">How it works</h2>
				<ol className="list-decimal space-y-2 ps-5">
					<li>
						At build time, the site reads the folders in{" "}
						<code className={code}>src/app/lab</code>. Each one with
						its own <code className={code}>page.tsx</code> is an
						experiment. Folders Next.js doesn&apos;t turn into a URL
						(private <code className={code}>_x</code>, groups{" "}
						<code className={code}>(x)</code>, dynamic{" "}
						<code className={code}>[x]</code>) are skipped.
					</li>
					<li>
						The fixed pages ({FIXED_PAGES.join(", ")}) come first,
						then the experiments, minus the pages excluded on
						purpose.
					</li>
					<li>
						The same list feeds this sitemap and the{" "}
						<Link className={linkClass} href="/lab">
							/lab
						</Link>{" "}
						index, so the two can&apos;t disagree. Both are
						generated once per build: the deployed Worker has no
						file system to read.
					</li>
					<li>
						Entries carry no &ldquo;last modified&rdquo; date. The
						only date available is the build time, which would claim
						every page changed on every deploy.
					</li>
				</ol>
			</section>

			<section className="flex max-w-2xl flex-col gap-3 text-gray-700">
				<h2 className="text-2xl text-gray-900">Left out on purpose</h2>
				<ul className="list-disc space-y-2 ps-5">
					{Object.entries(EXCLUDED_PAGES).map(([path, reason]) => (
						<li key={path}>
							<code className={code}>{path}</code>: {reason}
						</li>
					))}
					<li>
						APIs and the share target (
						<code className={code}>/api/*</code>,{" "}
						<code className={code}>
							/lab/camera-translate/share
						</code>
						): they aren&apos;t pages.
					</li>
				</ul>
				<p>
					<a className={linkClass} href="/robots.txt">
						robots.txt
					</a>{" "}
					points search engines at the sitemap. The source of truth is{" "}
					<code className={code}>src/app/lib/site/routes.ts</code>.
				</p>
			</section>
		</div>
	);
}
