import type { Metadata } from "next";
import { NavLink } from "@/app/components/navLink";
import { PageTransition } from "@/app/components/pageTransition";
import { CrossfadeDemo } from "./crossfadeDemo";

export const metadata: Metadata = {
	title: "View Transitions · Jinjing Wu",
	description:
		"How page changes on this site slide forward and back with the View Transitions API.",
};

const linkClass =
	"underline decoration-wavy underline-offset-4 hover:decoration-solid";
const code = "rounded bg-gray-100 px-1 py-0.5 text-sm text-gray-900";
const sectionClass = "flex max-w-2xl flex-col gap-3 text-gray-700";

/** Explains the site's page transitions, with a same-page demo. */
export default function ViewTransitionsPage() {
	return (
		<PageTransition>
			<div className="flex min-w-0 flex-1 flex-col gap-8">
				<Intro />
				<TryIt />
				<HowItWorks />
				<BeforeAndAfter />
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
			View Transitions
		</h1>
		<p className="mt-3 max-w-2xl text-gray-600">
			Moving around this site now has a direction. Going deeper slides the
			page in from the right, going back up slides it in from the left,
			and the navbar stays still. It uses the browser&apos;s View
			Transitions API through React&apos;s{" "}
			<code className={code}>&lt;ViewTransition&gt;</code>, with no
			animation library.
		</p>
	</div>
);

const TryIt = () => (
	<section className={sectionClass}>
		<h2 className="text-2xl text-gray-900">Try it</h2>
		<p>
			Go back to{" "}
			<NavLink className={linkClass} href="/lab">
				/lab
			</NavLink>{" "}
			(the page slides right), then open any experiment (it slides left).
			The <code className={code}>~</code> and{" "}
			<code className={code}>/lab</code> links in the corner work the same
			way.
		</p>
		<p>
			Inside a page, a change can crossfade instead of jumping. Each card
			below is swapped inside a React transition:
		</p>
		<CrossfadeDemo />
	</section>
);

const HowItWorks = () => (
	<section className={sectionClass}>
		<h2 className="text-2xl text-gray-900">How it works</h2>
		<ol className="list-decimal space-y-2 ps-5">
			<li>
				Every link inside the site is a{" "}
				<code className={code}>NavLink</code>. It compares where you are
				with where the link goes: a deeper path (
				<code className={code}>/</code> →{" "}
				<code className={code}>/lab</code> →{" "}
				<code className={code}>/lab/x</code>) tags the navigation{" "}
				<code className={code}>nav-forward</code>, a shallower one{" "}
				<code className={code}>nav-back</code>. The rule is a small
				tested function, <code className={code}>navDirection</code>.
			</li>
			<li>
				Each page wraps its content in{" "}
				<code className={code}>PageTransition</code>, which maps those
				two tags to a slide and fade. Next.js runs route changes as
				React transitions, so the browser snapshots the old page, React
				renders the new one, and CSS animates between them.
			</li>
			<li>
				The navbar has its own transition name and no animation, so it
				stays put while only the content moves.
			</li>
			<li>
				With &ldquo;reduce motion&rdquo; turned on in your system
				settings, pages swap at once, without sliding.
			</li>
		</ol>
	</section>
);

const BeforeAndAfter = () => (
	<section className={sectionClass}>
		<h2 className="text-2xl text-gray-900">Before and after</h2>
		<ul className="list-disc space-y-2 ps-5">
			<li>
				Before, a page change swapped everything at once: nothing showed
				whether you went deeper or back.
			</li>
			<li>
				Now the old page leaves in 150 ms and the new one arrives over
				400 ms. Navigation itself isn&apos;t slower: the new page is
				rendered first, then animated, and clicks still reach it during
				the animation.
			</li>
		</ul>
	</section>
);

const Support = () => (
	<section className={sectionClass}>
		<h2 className="text-2xl text-gray-900">Browser support and limits</h2>
		<ul className="list-disc space-y-2 ps-5">
			<li>
				The directional slides need View Transition types and classes:
				Chrome and Edge 125+, and recent Safari and Firefox. Elsewhere
				pages change exactly as before, without animation.
			</li>
			<li>
				The browser&apos;s own back and forward buttons (and swipe
				gestures) carry no direction, so those changes don&apos;t slide.
			</li>
			<li>
				Moving between two experiments at the same depth doesn&apos;t
				slide either: neither is &ldquo;deeper&rdquo;.
			</li>
		</ul>
	</section>
);
