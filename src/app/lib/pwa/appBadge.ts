import { t } from "try";

/**
 * The app icon badge (Badging API): the number of this site's notifications
 * still showing, cleared when the app is opened. Used by the worker (after a
 * push or a notification click) and the page (on open).
 */

/** The Badging API, on `navigator` in pages and in the worker; often missing. */
export type BadgeNavigator = {
	setAppBadge?: (count?: number) => Promise<void>;
	clearAppBadge?: () => Promise<void>;
};

export type BadgeAction = { kind: "set"; count: number } | { kind: "clear" };

/** The badge for this many notifications still showing. */
export const badgeFor = (openNotifications: number): BadgeAction =>
	openNotifications > 0
		? { kind: "set", count: Math.floor(openNotifications) }
		: { kind: "clear" };

/**
 * Shows `action` on the app icon where the Badging API exists (installed
 * apps; iOS 16.4+ with notification permission). Elsewhere it does nothing.
 * A refused badge only logs: it must never break a push or a page load.
 */
export const applyBadge = async (nav: BadgeNavigator, action: BadgeAction) => {
	const [ok, error] = await t(async () => {
		if (action.kind === "set") await nav.setAppBadge?.(action.count);
		else await nav.clearAppBadge?.();
	});
	if (!ok) console.warn("Couldn't update the app badge", error);
};
