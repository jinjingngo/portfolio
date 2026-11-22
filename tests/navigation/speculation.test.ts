import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	loadKind,
	SPECULATE_ATTRIBUTE,
	speculationRules,
} from "../../src/app/lib/navigation/speculation.ts";

describe("speculationRules", () => {
	it("prerenders only opted-in links, on hover", () => {
		assert.deepEqual(speculationRules(), {
			prerender: [
				{
					where: { selector_matches: `a[${SPECULATE_ATTRIBUTE}]` },
					eagerness: "moderate",
				},
			],
		});
	});

	it("has no prefetch or document-wide rules", () => {
		const rules = speculationRules();
		assert.deepEqual(Object.keys(rules), ["prerender"]);
		assert.ok(
			rules.prerender.every((rule) => "selector_matches" in rule.where),
		);
	});
});

describe("loadKind", () => {
	const base = {
		activationStart: 0,
		type: "navigate",
		loadedWithDocument: true,
	};

	it("spots a prerendered page by its activation time", () => {
		assert.equal(
			loadKind({ ...base, activationStart: 812.4 }),
			"prerendered",
		);
	});

	it("is a full load for a normal navigation or reload", () => {
		assert.equal(loadKind(base), "full-load");
		assert.equal(loadKind({ ...base, type: "reload" }), "full-load");
	});

	it("is client-side when the document was loaded for another URL", () => {
		assert.equal(
			loadKind({
				...base,
				activationStart: 500,
				loadedWithDocument: false,
			}),
			"client-side",
		);
	});

	it("is history for back and forward", () => {
		assert.equal(loadKind({ ...base, type: "back_forward" }), "history");
	});
});
