/**
 * Pure rules for sharing a translation (Web Share API): the text sent to
 * other apps, and whether to share, copy, or offer nothing.
 */

import type { TranslatedBlock } from "./translatePolicy";

/** The translation, then the original, each under its language name. */
export const translationShareText = (
	blocks: readonly TranslatedBlock[],
	languages: { source: string; target: string },
) =>
	[
		`${languages.target}:`,
		...blocks.map((block) => block.translation),
		"",
		`${languages.source} (original):`,
		...blocks.map((block) => block.text),
	].join("\n");

export type ShareMethod = "share" | "copy" | null;

/** The share sheet where it exists, else the clipboard, else nothing to offer. */
export const shareMethodFor = (env: {
	canShare: boolean;
	canCopy: boolean;
}): ShareMethod => {
	if (env.canShare) return "share";
	if (env.canCopy) return "copy";
	return null;
};

/** Whether a failed `navigator.share` was the visitor closing the sheet. */
export const isShareCancelled = (error: unknown) =>
	error instanceof Error && error.name === "AbortError";
