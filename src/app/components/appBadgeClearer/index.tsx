"use client";

import { useEffect } from "react";
import { applyBadge, type BadgeNavigator } from "@/app/lib/pwa/appBadge";

const clear = () => {
	if (document.visibilityState !== "visible") return;
	applyBadge(navigator as BadgeNavigator, { kind: "clear" });
};

/** Clears the app icon badge whenever the app is opened or brought back. */
export const AppBadgeClearer = () => {
	useEffect(() => {
		clear();
		document.addEventListener("visibilitychange", clear);
		return () => document.removeEventListener("visibilitychange", clear);
	}, []);
	return null;
};
