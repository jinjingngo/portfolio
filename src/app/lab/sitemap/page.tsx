import type { Metadata, MetadataRoute } from "next";
import { NavLink } from "@/app/components/navLink";
import { PageTransition } from "@/app/components/pageTransition";
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
const sectionClass = "flex max-w-2xl flex-col gap-3 text-gray-700";
const cell = "px-4 py-2";

/** Shows the sitemap this build generated, and how it is generated. */
export default function SitemapPage() {
	const entries = sitemapEntries(
		publicPaths(labExperiments(readLabFolders())),
	);
	return (
		<PageTransition>
			<div className="flex min-w-0 flex-1 flex-col gap-8">
				<Intro />
				<EntriesTable entries={entries} />
				<HowItWorks />
				<LeftOut />
			</div>
		</PageTransition>
	);
}

const Intro = () => (
	<div>
		<NavLink
			className="text-sm underline decoration-wavy underline-offset-4"
			href="/lab"
		>
			← /lab
		</NavLink>
		<h1 className="mt-5 text-4xl text-gray-900 md:text-5xl">Sitemap</h1>
		<p className="mt-3 max-w-2xl text-gray-600">
			This site&apos;s{" "}
			<a className={linkClass} href="/sitemap.xml">
				sitemap.xml
			</a>{" "}
			builds itself. A new experiment appears in it, and in the /lab list,
			as soon as its page is deployed; nothing needs to be listed by hand.
		</p>
	</div>
);

/** The entries, with each URL shown as its path on this site. */
const EntriesTable = ({ entries }: { entries: MetadataRoute.Sitemap }) => (
	<section className={sectionClass}>
		<h2 className="text-2xl text-gray-900">What this build lists</h2>
		<div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
			<table className="w-full text-left text-sm">
				<caption className="sr-only">Pages in sitemap.xml</caption>
				<thead className="bg-gray-50 text-gray-600">
					<tr>
						<th className={`${cell} font-medium`}>Page</th>
						<th className={`${cell} font-medium`}>Changes</th>
						<th className={`${cell} font-medium`}>Priority</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-gray-100">
					{entries.map((entry) => {
						const path = new URL(entry.url).pathname;
						return (
							<tr key={entry.url}>
								<td className={cell}>
									<a className={linkClass} href={path}>
										{path}
									</a>
								</td>
								<td className={cell}>
									{entry.changeFrequency}
								</td>
								<td className={cell}>{entry.priority}</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	</section>
);

const HowItWorks = () => (
	<section className={sectionClass}>
		<h2 className="text-2xl text-gray-900">How it works</h2>
		<ol className="list-decimal space-y-2 ps-5">
			<li>
				At build time, the site reads the folders in{" "}
				<code className={code}>src/app/lab</code>. Each one with its own
				page file (<code className={code}>page.tsx</code>) is an
				experiment. Folders Next.js doesn&apos;t turn into a URL
				(private <code className={code}>_x</code>, groups{" "}
				<code className={code}>(x)</code>, dynamic{" "}
				<code className={code}>[x]</code>) are skipped.
			</li>
			<li>
				The fixed pages ({FIXED_PAGES.join(", ")}) come first, then the
				experiments, minus the pages excluded on purpose.
			</li>
			<li>
				The same list feeds this sitemap and the{" "}
				<NavLink className={linkClass} href="/lab">
					/lab
				</NavLink>{" "}
				index, so the two can&apos;t disagree. Both are generated once
				per build: the deployed Worker has no file system to read.
			</li>
			<li>
				Entries carry no &ldquo;last modified&rdquo; date. The only date
				available is the build time, which would claim every page
				changed on every deploy.
			</li>
		</ol>
	</section>
);

const LeftOut = () => (
	<section className={sectionClass}>
		<h2 className="text-2xl text-gray-900">Left out on purpose</h2>
		<ul className="list-disc space-y-2 ps-5">
			{Object.entries(EXCLUDED_PAGES).map(([path, reason]) => (
				<li key={path}>
					<code className={code}>{path}</code>: {reason}
				</li>
			))}
			<li>
				APIs and the share target (<code className={code}>/api/*</code>,{" "}
				<code className={code}>/lab/camera-translate/share</code>): they
				aren&apos;t pages.
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
);
