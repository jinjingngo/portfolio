// Bundles the service worker (src/sw/sw.ts) to public/sw.js before Next builds.
// The build version is the commit: WORKERS_CI_COMMIT_SHA on Cloudflare builds,
// otherwise the local git commit, otherwise "dev".
import { execSync } from "node:child_process";
import { build } from "esbuild";

const gitCommit = () => {
	try {
		return execSync("git rev-parse --short=12 HEAD", {
			encoding: "utf8",
		}).trim();
	} catch {
		return "dev";
	}
};

const version = (process.env.WORKERS_CI_COMMIT_SHA ?? gitCommit()).slice(0, 12);

await build({
	entryPoints: ["src/sw/sw.ts"],
	outfile: "public/sw.js",
	bundle: true,
	format: "iife",
	target: "es2020",
	minify: true,
	legalComments: "none",
	define: { __SW_VERSION__: JSON.stringify(version) },
	banner: {
		js: `// Generated from src/sw/sw.ts (version ${version}). Do not edit.`,
	},
});

console.log(`Built public/sw.js (version ${version})`);
