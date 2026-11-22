"use client";

import { useEffect, useState } from "react";
import { speculationRules } from "@/app/lib/navigation/speculation";

const supportsRules = () =>
	typeof HTMLScriptElement !== "undefined" &&
	HTMLScriptElement.supports?.("speculationrules") === true;

/**
 * Adds this page's speculation rules while it is open, and removes them when
 * you leave, which also cancels any prerender they started. Added from an
 * effect: a <script> React renders on a client-side visit wouldn't be picked
 * up. Shows whether this browser supports them.
 */
export const SpeculationRulesScript = () => {
	const [supported, setSupported] = useState<boolean | null>(null);

	useEffect(() => {
		const ok = supportsRules();
		setSupported(ok);
		if (!ok) return;
		const script = document.createElement("script");
		script.type = "speculationrules";
		script.textContent = JSON.stringify(speculationRules());
		document.head.appendChild(script);
		return () => {
			script.remove();
		};
	}, []);

	if (supported === null) return null;
	return (
		<p className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-800">
			{supported
				? "This browser supports speculation rules: the first link will be prerendered when you point at it."
				: "This browser ignores speculation rules, so all three links load normally."}
		</p>
	);
};
