"use client";

import { useEffect } from "react";
import { applyBadge, type BadgeNavigator } from "@/app/lib/pwa/appBadge";

const clear = () => {
	if (document.visibilityState !== "visible") return;
	applyBadge(navigator as BadgeNavigator, { kind: "clear" });
};

/** Clears the app icon badge whenever the app is opened, brought back or focused. */
export const AppBadgeClearer = () => {
	useEffect(() => {
		clear();
		// focus: a visible window brought to the front (e.g. by a notification click).
		document.addEventListener("visibilitychange", clear);
		window.addEventListener("focus", clear);
		return () => {
			document.removeEventListener("visibilitychange", clear);
			window.removeEventListener("focus", clear);
		};
	}, []);
	return null;
};
