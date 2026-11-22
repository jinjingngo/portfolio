import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	NAV_BACK,
	NAV_FORWARD,
	navDirection,
	transitionTypesFor,
} from "../../src/app/lib/navigation/navDirection.ts";

describe("navDirection", () => {
	it("is forward when going deeper", () => {
		assert.equal(navDirection("/", "/lab"), NAV_FORWARD);
		assert.equal(
			navDirection("/lab", "/lab/camera-translate"),
			NAV_FORWARD,
		);
		assert.equal(navDirection("/", "/lab/web-push"), NAV_FORWARD);
	});

	it("is back when going up", () => {
		assert.equal(navDirection("/lab/web-push", "/lab"), NAV_BACK);
		assert.equal(navDirection("/lab", "/"), NAV_BACK);
		assert.equal(navDirection("/lab/sitemap", "/"), NAV_BACK);
	});

	it("doesn't animate the same page or a sibling", () => {
		assert.equal(navDirection("/lab", "/lab"), null);
		assert.equal(navDirection("/lab/", "/lab?x=1#top"), null);
		assert.equal(navDirection("/lab/a", "/lab/b"), null);
	});

	it("ignores query, hash and trailing slashes when counting depth", () => {
		assert.equal(navDirection("/lab/", "/lab/x?shared=1"), NAV_FORWARD);
		assert.equal(navDirection("/lab/x#y", "/lab/"), NAV_BACK);
	});
});

describe("navDirection with relative links", () => {
	it("resolves them against the current page", () => {
		assert.equal(navDirection("/lab/x", "#top"), null);
		assert.equal(navDirection("/lab/x", "?tab=2"), null);
		assert.equal(navDirection("/lab/", "x"), NAV_FORWARD);
		assert.equal(navDirection("/lab/x", ".."), NAV_BACK);
	});
});

describe("transitionTypesFor", () => {
	it("gives Link's transitionTypes, empty when nothing should animate", () => {
		assert.deepEqual(transitionTypesFor("/", "/lab"), [NAV_FORWARD]);
		assert.deepEqual(transitionTypesFor("/lab", "/lab"), []);
	});
});
