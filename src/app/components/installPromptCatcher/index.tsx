import { CATCH_INSTALL_PROMPT } from "@/app/lib/pwa/installPromptScript";

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
