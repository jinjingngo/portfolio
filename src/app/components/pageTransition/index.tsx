import { type ReactNode, ViewTransition } from "react";
import { NAV_BACK, NAV_FORWARD } from "@/app/lib/navigation/navDirection";

const DIRECTIONAL = {
	[NAV_FORWARD]: NAV_FORWARD,
	[NAV_BACK]: NAV_BACK,
	default: "none",
};

/**
 * Wraps a page's content so a NavLink navigation slides it forward or back
 * (CSS in globals.css). Untagged changes (browser back, refresh) don't
 * animate. It goes in each page.tsx, and around a layout's content when
 * navigation can add or remove that whole layout (lab/layout.tsx): React only
 * animates the outermost <ViewTransition> that appears or disappears.
 * See /lab/view-transitions.
 */
export const PageTransition = ({ children }: { children: ReactNode }) => (
	<ViewTransition enter={DIRECTIONAL} exit={DIRECTIONAL} default="none">
		{children}
	</ViewTransition>
);
