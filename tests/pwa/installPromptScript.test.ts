import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { INSTALL_PROMPT_STASH } from "../../src/app/lib/pwa/installPolicy.ts";
import { CATCH_INSTALL_PROMPT } from "../../src/app/lib/pwa/installPromptScript.ts";

/** Runs the inline script against a fake window that records listeners. */
const runScript = () => {
	const target = new EventTarget();
	const fakeWindow = Object.assign(target, {
		addEventListener: target.addEventListener.bind(target),
	}) as EventTarget & Record<string, unknown>;
	new Function("window", CATCH_INSTALL_PROMPT)(fakeWindow);
	return fakeWindow;
};

describe("CATCH_INSTALL_PROMPT", () => {
	it("stashes the install prompt and stops the browser's own infobar", () => {
		const window = runScript();
		const event = new Event("beforeinstallprompt", { cancelable: true });
		window.dispatchEvent(event);
		assert.equal(event.defaultPrevented, true);
		assert.equal(window[INSTALL_PROMPT_STASH], event);
	});

	it("clears the stash once the app is installed", () => {
		const window = runScript();
		window.dispatchEvent(
			new Event("beforeinstallprompt", { cancelable: true }),
		);
		window.dispatchEvent(new Event("appinstalled"));
		assert.equal(window[INSTALL_PROMPT_STASH], null);
	});
});
