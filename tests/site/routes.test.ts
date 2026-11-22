import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	experimentTitle,
	labExperiments,
	publicPaths,
	SITE_ORIGIN,
	sitemapEntries,
} from "../../src/app/lib/site/routes.ts";

describe("labExperiments", () => {
	it("lists folders with a page, sorted", () => {
		assert.deepEqual(
			labExperiments([
				{ name: "web-push", hasPage: true },
				{ name: "camera-translate", hasPage: true },
			]),
			["camera-translate", "web-push"],
		);
	});

	it("skips folders without a page and ones Next.js doesn't route", () => {
		assert.deepEqual(
			labExperiments([
				{ name: "shared-components", hasPage: false },
				{ name: "_draft", hasPage: true },
				{ name: "(group)", hasPage: true },
				{ name: "[slug]", hasPage: true },
				{ name: "@modal", hasPage: true },
				{ name: "sitemap", hasPage: true },
			]),
			["sitemap"],
		);
	});
});

describe("labExperiments slugs", () => {
	it("fails the build for a routable folder that isn't a slug", () => {
		for (const name of [
			"My Thing",
			"Camera-Translate",
			"a<b",
			"trailing-",
		]) {
			assert.throws(
				() => labExperiments([{ name, hasPage: true }]),
				/lowercase slugs/,
				name,
			);
		}
	});

	it("ignores odd names on folders without a page", () => {
		assert.deepEqual(
			labExperiments([{ name: "My Notes", hasPage: false }]),
			[],
		);
	});
});

describe("experimentTitle", () => {
	it("turns a folder name into a title", () => {
		assert.equal(experimentTitle("camera-translate"), "Camera Translate");
		assert.equal(experimentTitle("sitemap"), "Sitemap");
	});
});

describe("publicPaths", () => {
	it("puts the fixed pages first, then the experiments", () => {
		assert.deepEqual(publicPaths(["camera-translate", "web-push"]), [
			"/",
			"/lab",
			"/lab/camera-translate",
			"/lab/web-push",
		]);
	});
});

describe("publicPaths exclusions", () => {
	it("leaves out excluded pages, including a lab experiment", () => {
		assert.deepEqual(
			publicPaths(["draft-idea", "web-push"], {
				"/lab/draft-idea": "Not ready yet.",
			}),
			["/", "/lab", "/lab/web-push"],
		);
	});
});

describe("sitemapEntries", () => {
	it("builds absolute URLs on the site's origin, without dates", () => {
		const entries = sitemapEntries(["/", "/lab", "/lab/web-push"]);
		assert.deepEqual(
			entries.map((entry) => entry.url),
			[
				`${SITE_ORIGIN}/`,
				`${SITE_ORIGIN}/lab`,
				`${SITE_ORIGIN}/lab/web-push`,
			],
		);
		assert.ok(entries.every((entry) => !("lastModified" in entry)));
		assert.deepEqual(
			entries.map((entry) => entry.priority),
			[1, 0.8, 0.6],
		);
	});
});
