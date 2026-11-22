import type { MetadataRoute } from "next";
import { readLabFolders } from "./lib/server/labFolders";
import { labExperiments, publicPaths, sitemapEntries } from "./lib/site/routes";

/** Built once at build time from the same page list as /lab (see lib/site/routes). */
export default function sitemap(): MetadataRoute.Sitemap {
	return sitemapEntries(publicPaths(labExperiments(readLabFolders())));
}
