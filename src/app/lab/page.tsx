import Link from "next/link";
import { readLabFolders } from "@/app/lib/server/labFolders";
import { experimentTitle, labExperiments } from "@/app/lib/site/routes";

/** Lists every experiment folder (read at build time; see lib/site/routes). */
export default function LabPage() {
	const experiments = labExperiments(readLabFolders());
	return (
		<div className="flex flex-col items-start gap-4">
			<h1 className={"text-4xl md:text-5xl text-gray-900"}>/lab</h1>
			<p className={"text-gray-700"}>
				Welcome to my lab! Where I experiment with things that I find
				interesting and challenging.
			</p>
			<ul className={"list-disc list-inside"}>
				{experiments.map((experiment) => (
					<li key={experiment}>
						<Link
							className={
								"cursor-pointer underline underline-offset-2 decoration-wavy hover:decoration-solid hover:underline-offset-4"
							}
							href={`/lab/${experiment}`}
						>
							{experimentTitle(experiment)}
						</Link>
					</li>
				))}
			</ul>
		</div>
	);
}
