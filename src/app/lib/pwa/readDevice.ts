import type { Device } from "./installPolicy";

/** Media query matching an installed app's window (see `display_override`). */
const INSTALLED_DISPLAY_MODES =
	"(display-mode: standalone), (display-mode: minimal-ui)";

/** Reads how the site is open. Browser only: call from effects or handlers. */
export const readDevice = (): Device => ({
	isAppleMobile:
		/iPad|iPhone|iPod/.test(navigator.userAgent) ||
		(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
	isStandalone:
		window.matchMedia?.(INSTALLED_DISPLAY_MODES).matches === true ||
		(navigator as { standalone?: boolean }).standalone === true,
});
