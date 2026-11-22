import fs from "node:fs";
import path from "node:path";
import type { LabFolder } from "../site/routes";

const LAB_DIR = path.join(process.cwd(), "src/app/lab");
/** The file names Next.js accepts for a page. */
const PAGE_FILES = ["page.tsx", "page.ts", "page.jsx", "page.js"];

/**
 * The folders directly under src/app/lab and whether each has a page file.
 * Build time only: /lab and sitemap.xml are prerendered, and the deployed
 * Worker has no file system.
 */
export const readLabFolders = (): LabFolder[] =>
	fs
		.readdirSync(LAB_DIR, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => ({
			name: entry.name,
			hasPage: PAGE_FILES.some((file) =>
				fs.existsSync(path.join(LAB_DIR, entry.name, file)),
			),
		}));
