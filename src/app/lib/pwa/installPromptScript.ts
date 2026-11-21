import { INSTALL_PROMPT_STASH } from "./installPolicy";

const KEY = JSON.stringify(INSTALL_PROMPT_STASH);

/**
 * Inline <head> script: keeps `beforeinstallprompt` for the navbar's button
 * (instead of Chrome's mini-infobar) in `window[INSTALL_PROMPT_STASH]`, and
 * clears it once the app is installed. Plain ES5: it runs unbundled.
 */
export const CATCH_INSTALL_PROMPT = `
window.addEventListener("beforeinstallprompt", function (event) {
	event.preventDefault();
	window[${KEY}] = event;
});
window.addEventListener("appinstalled", function () {
	window[${KEY}] = null;
});
`;
