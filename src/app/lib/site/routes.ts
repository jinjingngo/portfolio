/**
 * The site's public pages: the one source of truth for /lab's list and
 * sitemap.xml. Pure: the lab folders are read at build time by
 * `lib/server/labFolders.ts` and passed in.
 */

import type { MetadataRoute } from "next";

export const SITE_ORIGIN = "https://wujinjing.com";

/** Pages outside /lab/<experiment> that are always public. */
export const FIXED_PAGES = Object.freeze(["/", "/lab"]);

/**
 * Pages that exist but are never listed, with why. Everything else under
 * src/app/lab/<folder>/page.tsx is listed automatically. `/offline` is outside
 * /lab, so it is never a candidate; it is here so the list of unlisted pages
 * is complete (and shown on /lab/sitemap). A lab experiment added here is
 * left out of /lab and the sitemap.
 */
export const EXCLUDED_PAGES: Readonly<Record<string, string>> = Object.freeze({
	"/offline": "Shown by the service worker when offline; marked noindex.",
});

/** A folder directly under src/app/lab, as read at build time. */
export type LabFolder = { name: string; hasPage: boolean };

/**
 * Folder names Next.js doesn't turn into a plain URL segment: private
 * (`_x`), route groups (`(x)`), dynamic (`[x]`) and parallel routes (`@x`).
 */
const NOT_A_PAGE_NAME = /^[_(@[]/;

/** What an experiment's folder (and URL) name must look like: "camera-translate". */
const EXPERIMENT_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The experiments: lab folders with their own page, sorted by name. A
 * routable folder whose name isn't a slug fails the build, rather than being
 * left out quietly or put into links and the sitemap as is.
 */
export const labExperiments = (folders: readonly LabFolder[]) => {
	const names = folders
		.filter(
			(folder) => folder.hasPage && !NOT_A_PAGE_NAME.test(folder.name),
		)
		.map((folder) => folder.name);
	const invalid = names.filter((name) => !EXPERIMENT_SLUG.test(name));
	if (invalid.length > 0) {
		throw new Error(
			`Lab folder names must be lowercase slugs (a-z, 0-9, "-"): ${invalid.join(", ")}`,
		);
	}
	return names.sort();
};

/** "camera-translate" → "Camera Translate". */
export const experimentTitle = (slug: string) =>
	slug
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");

type Exclusions = Readonly<Record<string, string>>;

const isListed = (path: string, excluded: Exclusions) =>
	!Object.hasOwn(excluded, path);

/** The experiments the /lab index links to: all but the excluded ones. */
export const listedExperiments = (
	experiments: readonly string[],
	excluded: Exclusions = EXCLUDED_PAGES,
) => experiments.filter((slug) => isListed(`/lab/${slug}`, excluded));

/** Every public page path, fixed pages first, minus the exclusions. */
export const publicPaths = (
	experiments: readonly string[],
	excluded: Exclusions = EXCLUDED_PAGES,
) => [
	...FIXED_PAGES.filter((path) => isListed(path, excluded)),
	...listedExperiments(experiments, excluded).map((slug) => `/lab/${slug}`),
];

/**
 * sitemap.xml entries. No `lastModified`: the build time would claim every
 * page changed on each deploy, and search engines learn to ignore it.
 */
export const sitemapEntries = (
	paths: readonly string[],
	origin: string = SITE_ORIGIN,
): MetadataRoute.Sitemap =>
	paths.map((path) => ({
		url: new URL(path, origin).toString(),
		changeFrequency: path === "/" ? "weekly" : "monthly",
		priority: path === "/" ? 1 : path === "/lab" ? 0.8 : 0.6,
	}));
