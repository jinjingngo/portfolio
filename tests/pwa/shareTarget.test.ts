import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	checkSharedPhoto,
	isShareTargetRequest,
	SHARE_LIMITS,
	SHARE_TARGET_PATH,
	type ShareOutcome,
	shareOutcomeOf,
	shareRedirectPath,
} from "../../src/app/lib/pwa/shareTarget.ts";

const origin = "https://wujinjing.com";

describe("isShareTargetRequest", () => {
	it("matches a POST to the share target on this site", () => {
		assert.equal(
			isShareTargetRequest(
				{ method: "POST", url: `${origin}${SHARE_TARGET_PATH}` },
				origin,
			),
			true,
		);
	});

	it("ignores other methods, paths and origins", () => {
		for (const request of [
			{ method: "GET", url: `${origin}${SHARE_TARGET_PATH}` },
			{ method: "POST", url: `${origin}/api/translate/image` },
			{ method: "POST", url: `${origin}${SHARE_TARGET_PATH}/x` },
			{ method: "POST", url: `https://evil.example${SHARE_TARGET_PATH}` },
		]) {
			assert.equal(isShareTargetRequest(request, origin), false);
		}
	});
});

describe("checkSharedPhoto", () => {
	it("accepts an image within the limit", () => {
		assert.deepEqual(checkSharedPhoto({ type: "image/jpeg", size: 4e6 }), {
			ok: true,
			value: true,
		});
	});

	it("rejects missing, non-image, empty and oversized files", () => {
		const cases: [{ type: string; size: number } | null, number][] = [
			[null, 400],
			[{ type: "application/pdf", size: 1000 }, 415],
			[{ type: "", size: 1000 }, 415],
			[{ type: "image/png", size: 0 }, 400],
			[{ type: "image/heic", size: SHARE_LIMITS.maxPhotoBytes + 1 }, 413],
		];
		for (const [file, status] of cases) {
			const decision = checkSharedPhoto(file);
			assert.equal(decision.ok, false);
			assert.equal(!decision.ok && decision.status, status);
		}
	});
});

describe("shareRedirectPath and shareOutcomeOf", () => {
	it("round-trips every outcome through the page's query string", () => {
		for (const outcome of [
			"ready",
			"invalid",
			"unavailable",
		] satisfies ShareOutcome[]) {
			const path = shareRedirectPath(outcome);
			assert.ok(path.startsWith("/lab/camera-translate?shared="));
			assert.equal(shareOutcomeOf(new URL(path, origin).search), outcome);
		}
	});

	it("ignores pages without a known share outcome", () => {
		for (const search of ["", "?shared=", "?shared=evil", "?other=1"]) {
			assert.equal(shareOutcomeOf(search), null);
		}
	});
});
