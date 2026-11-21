/**
 * Pure decision for the install UI: which install action, if any, to offer
 * on this device. The browser facts are read by `readDevice` and the
 * `useInstallPrompt` hook.
 */

/** Facts about how the site is open, shared by the install UI and web push. */
export type Device = {
	/** iPhone or iPad, including iPadOS reporting itself as a Mac. */
	isAppleMobile: boolean;
	/** Opened as an installed app (Home Screen / app window), not a tab. */
	isStandalone: boolean;
};

export type InstallEnvironment = Device & {
	/** The browser offered an install prompt (`beforeinstallprompt`). */
	canPrompt: boolean;
	/** The visitor closed the Add to Home Screen hint before. */
	hintDismissed: boolean;
};

/**
 * - `prompt`: an "Install app" button that opens the browser's dialog.
 * - `ios`: the "Share → Add to Home Screen" hint (Safari has no prompt).
 * - `none`: already installed, dismissed, or the browser can't install.
 */
export type InstallHint = "prompt" | "ios" | "none";

/** localStorage key remembering that the iOS hint was closed. */
export const INSTALL_HINT_DISMISSED_KEY = "JJ:INSTALL_HINT_DISMISSED";

/** Which install action to offer for this environment. */
export const installHint = (env: InstallEnvironment): InstallHint => {
	if (env.isStandalone) return "none";
	if (env.canPrompt) return "prompt";
	if (env.isAppleMobile && !env.hintDismissed) return "ios";
	return "none";
};
