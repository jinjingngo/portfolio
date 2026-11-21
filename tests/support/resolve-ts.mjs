/**
 * Test-only module resolution, so `node --test` can load app modules the way
 * the bundler does: `@/x` means `src/x`, and relative imports may omit `.ts`.
 * Loaded with `node --import`; the app code itself is unchanged.
 */
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const srcUrl = pathToFileURL(`${process.cwd()}/src/`).href;
const candidates = (specifier) => [
	specifier,
	`${specifier}.ts`,
	`${specifier}/index.ts`,
];

registerHooks({
	resolve(specifier, context, nextResolve) {
		const mapped = specifier.startsWith("@/")
			? `${srcUrl}${specifier.slice(2)}`
			: specifier;
		const isPath = mapped !== specifier || specifier.startsWith(".");
		if (!isPath) return nextResolve(specifier, context);

		for (const candidate of candidates(mapped)) {
			try {
				return nextResolve(candidate, context);
			} catch {}
		}
		return nextResolve(mapped, context);
	},
});
