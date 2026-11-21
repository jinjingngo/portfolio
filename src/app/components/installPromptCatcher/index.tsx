import { INSTALL_PROMPT_STASH } from "@/app/lib/pwa/installPolicy";

const KEY = JSON.stringify(INSTALL_PROMPT_STASH);

/** Keeps the event for the navbar's button instead of Chrome's mini-infobar. */
const CATCH_INSTALL_PROMPT = `
window.addEventListener("beforeinstallprompt", function (event) {
	event.preventDefault();
	window[${KEY}] = event;
});
window.addEventListener("appinstalled", function () {
	window[${KEY}] = null;
});
`;

/**
 * Catches `beforeinstallprompt` before hydration: Chrome fires it once per
 * page load and doesn't replay it for listeners added later.
 * `useInstallPrompt` picks the stashed event up. A plain inline script in
 * <head> runs while the HTML is parsed; next/script's `beforeInteractive`
 * would wait for Next's runtime to load.
 */
export const InstallPromptCatcher = () => (
	<script
		id="install-prompt-catcher"
		// biome-ignore lint/security/noDangerouslySetInnerHtml: constant script, no user input
		dangerouslySetInnerHTML={{ __html: CATCH_INSTALL_PROMPT }}
	/>
);
