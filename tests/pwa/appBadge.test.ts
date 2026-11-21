import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	applyBadge,
	type BadgeNavigator,
	badgeFor,
} from "../../src/app/lib/pwa/appBadge.ts";

describe("badgeFor", () => {
	it("counts the notifications still showing", () => {
		assert.deepEqual(badgeFor(3), { kind: "set", count: 3 });
	});

	it("clears the badge when none are showing", () => {
		assert.deepEqual(badgeFor(0), { kind: "clear" });
	});
});

/** A navigator that records badge calls, checking `this` like the real one. */
const fakeNavigator = (fail = false) => {
	const calls: string[] = [];
	const nav: BadgeNavigator = {
		setAppBadge(this: unknown, count?: number) {
			// applyBadge swallows errors, so record a wrong `this` instead of asserting.
			calls.push(`${this === nav ? "" : "unbound "}set ${count}`);
			return fail
				? Promise.reject(new Error("denied"))
				: Promise.resolve();
		},
		clearAppBadge(this: unknown) {
			calls.push(`${this === nav ? "" : "unbound "}clear`);
			return Promise.resolve();
		},
	};
	return { nav, calls };
};

describe("applyBadge", () => {
	it("sets and clears the badge", async () => {
		const { nav, calls } = fakeNavigator();
		await applyBadge(nav, badgeFor(2));
		await applyBadge(nav, badgeFor(0));
		assert.deepEqual(calls, ["set 2", "clear"]);
	});

	it("does nothing where the Badging API is missing", async () => {
		await applyBadge({}, badgeFor(2));
		await applyBadge({}, badgeFor(0));
	});

	it("never throws when the badge is refused", async () => {
		const { nav, calls } = fakeNavigator(true);
		await applyBadge(nav, badgeFor(1));
		assert.deepEqual(calls, ["set 1"]);
	});
});
