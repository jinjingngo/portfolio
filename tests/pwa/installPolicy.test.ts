import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	type InstallEnvironment,
	installHint,
} from "../../src/app/lib/pwa/installPolicy.ts";

const desktopTab: InstallEnvironment = {
	isAppleMobile: false,
	isStandalone: false,
	canPrompt: false,
	hintDismissed: false,
};
const iosTab: InstallEnvironment = { ...desktopTab, isAppleMobile: true };

describe("installHint", () => {
	it("offers the install button when the browser can prompt", () => {
		assert.equal(installHint({ ...desktopTab, canPrompt: true }), "prompt");
	});

	it("shows the Add to Home Screen hint in an iPhone/iPad tab", () => {
		assert.equal(installHint(iosTab), "ios");
	});

	it("never shows the hint again once closed", () => {
		assert.equal(installHint({ ...iosTab, hintDismissed: true }), "none");
	});

	it("offers nothing once installed", () => {
		for (const env of [
			{ ...desktopTab, canPrompt: true },
			iosTab,
		] satisfies InstallEnvironment[]) {
			assert.equal(installHint({ ...env, isStandalone: true }), "none");
		}
	});

	it("offers nothing where the browser can't install", () => {
		assert.equal(installHint(desktopTab), "none");
	});
});
