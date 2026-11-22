import { NavLink } from "@/app/components/navLink";
import { PageTransition } from "@/app/components/pageTransition";
import { readLabFolders } from "@/app/lib/server/labFolders";
import {
	experimentTitle,
	labExperiments,
	listedExperiments,
} from "@/app/lib/site/routes";

/** Lists every experiment folder (read at build time; see lib/site/routes). */
export default function LabPage() {
	const experiments = listedExperiments(labExperiments(readLabFolders()));
	return (
		<PageTransition>
			<div className="flex flex-col items-start gap-4">
				<h1 className={"text-4xl md:text-5xl text-gray-900"}>/lab</h1>
				<p className={"text-gray-700"}>
					Welcome to my lab! Where I experiment with things that I
					find interesting and challenging.
				</p>
				<ul className={"list-disc list-inside"}>
					{experiments.map((experiment) => (
						<li key={experiment}>
							<NavLink
								className={
									"cursor-pointer underline underline-offset-2 decoration-wavy hover:decoration-solid hover:underline-offset-4"
								}
								href={`/lab/${encodeURIComponent(experiment)}`}
							>
								{experimentTitle(experiment)}
							</NavLink>
						</li>
					))}
				</ul>
			</div>
		</PageTransition>
	);
}
