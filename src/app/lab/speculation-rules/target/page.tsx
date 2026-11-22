import type { Metadata } from "next";
import { NavLink } from "@/app/components/navLink";
import { PageTransition } from "@/app/components/pageTransition";
import { LoadReport } from "./loadReport";

export const metadata: Metadata = {
	title: "Speculation Rules target · Jinjing Wu",
	// Only the demo's destination: not a page of its own.
	robots: { index: false },
};

/** Where the speculation rules demo links lead; reports how you got here. */
export default function SpeculationTargetPage() {
	return (
		<PageTransition>
			<div className="flex min-w-0 max-w-2xl flex-1 flex-col gap-6">
				<NavLink
					className="text-sm underline decoration-wavy underline-offset-4"
					href="/lab/speculation-rules"
				>
					← Speculation Rules
				</NavLink>
				<h1 className="text-4xl text-gray-900 md:text-5xl">
					You&apos;re here
				</h1>
				<LoadReport />
			</div>
		</PageTransition>
	);
}
