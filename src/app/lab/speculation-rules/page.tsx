import type { Metadata } from "next";
import { NavLink } from "@/app/components/navLink";
import { PageTransition } from "@/app/components/pageTransition";
import {
	SPECULATE_ATTRIBUTE,
	TARGET_PATH,
	VIA,
} from "@/app/lib/navigation/speculation";
import { SpeculationRulesScript } from "./speculationRulesScript";

export const metadata: Metadata = {
	title: "Speculation Rules · Jinjing Wu",
	description:
		"Trying the Speculation Rules API on this site: prerendered, plain and Next.js links side by side.",
};

const linkClass =
	"underline decoration-wavy underline-offset-4 hover:decoration-solid";
const code = "rounded bg-gray-100 px-1 py-0.5 text-sm text-gray-900";
const sectionClass = "flex max-w-2xl flex-col gap-3 text-gray-700";
const target = (via: string) => `${TARGET_PATH}?via=${via}`;

/** The experiment: three ways to the same page, and what was learned. */
export default function SpeculationRulesPage() {
	return (
		<PageTransition>
			<div className="flex min-w-0 flex-1 flex-col gap-8">
				<Intro />
				<TryIt />
				<Findings />
				<Support />
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
		<h1 className="mt-5 text-4xl text-gray-900 md:text-5xl">
			Speculation Rules
		</h1>
		<p className="mt-3 max-w-2xl text-gray-600">
			Speculation Rules let a page tell the browser which link you&apos;ll
			probably open next, so it can load (and even render) that page
			before you click. This experiment checks whether that makes this
			site faster.
		</p>
	</div>
);

const TryIt = () => (
	<section className={sectionClass}>
		<h2 className="text-2xl text-gray-900">Try it</h2>
		<SpeculationRulesScript />
		<p>
			Each link opens the same page, which tells you how it was loaded.
			Rest the pointer on a link for a moment before clicking.
		</p>
		<ol className="list-decimal space-y-2 ps-5">
			<li>
				<a
					className={linkClass}
					href={target(VIA.prerender)}
					{...{ [SPECULATE_ATTRIBUTE]: "" }}
				>
					Prerendered link
				</a>
				: a plain link this page&apos;s rules prerender when you point
				at it.
			</li>
			<li>
				<a className={linkClass} href={target(VIA.plain)}>
					Plain link
				</a>
				: a normal full page load, for comparison.
			</li>
			<li>
				<NavLink className={linkClass} href={target(VIA.link)}>
					Next.js link
				</NavLink>
				: how every other link on this site works.
			</li>
		</ol>
	</section>
);

const Findings = () => (
	<section className={sectionClass}>
		<h2 className="text-2xl text-gray-900">What I found</h2>
		<ul className="list-disc space-y-2 ps-5">
			<li>
				Chrome accepts the rules: pointing at the first link makes it
				start loading the target. The target page then tells you whether
				it was prerendered. Chrome turns prerendering off while DevTools
				is open, so try it with DevTools closed.
			</li>
			<li>
				The Next.js link is fast without any of this. Next.js fetches
				the data of every page a link shows as soon as the link is on
				screen, then swaps the page in without loading a new document.
				In my tests it was as quick as the plain link.
			</li>
			<li>
				Every link on this site is a Next.js link. Its click never uses
				a prerendered document, so a site-wide rule would download and
				render pages a second time for nothing: more data and battery,
				no gain.
			</li>
			<li>
				So the rules stay on this page only. They cover just the links
				marked <code className={code}>{SPECULATE_ATTRIBUTE}</code>, only
				start when you point at one, and are removed when you leave, so
				Chrome can drop a prerender nobody used.
			</li>
			<li>
				They&apos;d be worth it for plain links to static pages, for
				example links inside long written posts, if the site gets those.
			</li>
		</ul>
	</section>
);

const Support = () => (
	<section className={sectionClass}>
		<h2 className="text-2xl text-gray-900">Browser support and fallback</h2>
		<ul className="list-disc space-y-2 ps-5">
			<li>
				Chrome and Edge run these rules. Safari and Firefox ignore them,
				and every link simply loads normally.
			</li>
			<li>
				Chrome also skips speculation when Data Saver or Energy Saver is
				on, or memory is low, and limits how many pages it prerenders at
				once.
			</li>
			<li>
				A prerendered page runs its code before you see it. The target
				waits until it is shown before it reports anything (
				<code className={code}>prerenderingchange</code>).
			</li>
		</ul>
	</section>
);
