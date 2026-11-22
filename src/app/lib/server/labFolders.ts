import fs from "node:fs";
import path from "node:path";
import type { LabFolder } from "../site/routes";

const LAB_DIR = path.join(process.cwd(), "src/app/lab");

/**
 * The folders directly under src/app/lab and whether each has a page.tsx.
 * Build time only: /lab and sitemap.xml are prerendered, and the deployed
 * Worker has no file system.
 */
export const readLabFolders = (): LabFolder[] =>
	fs
		.readdirSync(LAB_DIR, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => ({
			name: entry.name,
			hasPage: fs.existsSync(path.join(LAB_DIR, entry.name, "page.tsx")),
		}));
