import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	isShareCancelled,
	shareMethodFor,
	translationShareText,
} from "../../src/app/lib/translate/shareTranslation.ts";

describe("translationShareText", () => {
	it("sends the translation, then the original, under language names", () => {
		const text = translationShareText(
			[
				{ text: "Utgång", translation: "Exit" },
				{ text: "Öppet 9–17", translation: "Open 9–5" },
			],
			{ source: "Swedish", target: "English" },
		);
		assert.equal(
			text,
			[
				"English:",
				"Exit",
				"Open 9–5",
				"",
				"Swedish (original):",
				"Utgång",
				"Öppet 9–17",
			].join("\n"),
		);
	});
});

describe("shareMethodFor", () => {
	it("prefers the share sheet, then the clipboard, else nothing", () => {
		assert.equal(
			shareMethodFor({ canShare: true, canCopy: true }),
			"share",
		);
		assert.equal(
			shareMethodFor({ canShare: false, canCopy: true }),
			"copy",
		);
		assert.equal(shareMethodFor({ canShare: false, canCopy: false }), null);
	});
});

describe("isShareCancelled", () => {
	it("is true when the sheet was closed or is already open", () => {
		assert.equal(
			isShareCancelled(new DOMException("closed", "AbortError")),
			true,
		);
		assert.equal(
			isShareCancelled(new DOMException("busy", "InvalidStateError")),
			true,
		);
		assert.equal(
			isShareCancelled(new DOMException("no", "NotAllowedError")),
			false,
		);
		assert.equal(isShareCancelled("AbortError"), false);
	});
});
