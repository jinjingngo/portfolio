import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	hasSendQuota,
	isValidClientId,
	PUSH_LIMITS,
	parseNotification,
	rateWindowStart,
	toSameOriginPath,
} from "../../src/app/lib/push/pushPolicy.ts";

const ORIGIN = "https://site.example";

describe("toSameOriginPath", () => {
	it("keeps relative and same-origin links as a path", () => {
		assert.equal(
			toSameOriginPath("/lab/web-push", ORIGIN),
			"/lab/web-push",
		);
		assert.equal(toSameOriginPath(`${ORIGIN}/a?b=1#c`, ORIGIN), "/a?b=1#c");
	});

	it("rejects links to other sites and other schemes", () => {
		for (const url of [
			"https://evil.example/",
			"//evil.example/x",
			"javascript:alert(1)",
			"http://site.example/",
		]) {
			assert.equal(toSameOriginPath(url, ORIGIN), null, url);
		}
	});
});

describe("parseNotification", () => {
	const valid = { title: "Hi", message: "Hello", url: "/x" };

	it("returns the payload with a same-origin path", () => {
		assert.deepEqual(parseNotification(valid, ORIGIN), {
			ok: true,
			value: { title: "Hi", body: "Hello", url: "/x" },
		});
	});

	it("rejects missing or non-string fields", () => {
		for (const input of [
			{ ...valid, title: "" },
			{ ...valid, message: 1 },
			{ title: "Hi", message: "Hello" },
		]) {
			const result = parseNotification(input, ORIGIN);
			assert.equal(result.ok, false);
			assert.equal(!result.ok && result.status, 400);
		}
	});

	it("rejects text over the length limits", () => {
		const longTitle = "t".repeat(PUSH_LIMITS.maxTitleLength + 1);
		const longMessage = "m".repeat(PUSH_LIMITS.maxMessageLength + 1);
		assert.equal(
			parseNotification({ ...valid, title: longTitle }, ORIGIN).ok,
			false,
		);
		assert.equal(
			parseNotification({ ...valid, message: longMessage }, ORIGIN).ok,
			false,
		);
	});

	it("rejects off-site links", () => {
		const result = parseNotification(
			{ ...valid, url: "https://evil.example" },
			ORIGIN,
		);
		assert.deepEqual(result, {
			ok: false,
			error: "Notification links must point to this site.",
			status: 400,
		});
	});
});

describe("isValidClientId", () => {
	it("accepts non-empty strings up to the limit only", () => {
		assert.equal(isValidClientId("abc"), true);
		assert.equal(isValidClientId(""), false);
		assert.equal(isValidClientId(42), false);
		assert.equal(
			isValidClientId("x".repeat(PUSH_LIMITS.maxClientIdLength + 1)),
			false,
		);
	});
});

describe("rate limit", () => {
	it("puts times in the same minute in the same window", () => {
		const start = Date.UTC(2026, 10, 20, 12, 0, 0);
		assert.equal(rateWindowStart(start + 59_999), start);
		assert.equal(rateWindowStart(start + 60_000), start + 60_000);
	});

	it("allows sends until the per-window limit", () => {
		assert.equal(hasSendQuota(PUSH_LIMITS.sendsPerWindow - 1), true);
		assert.equal(hasSendQuota(PUSH_LIMITS.sendsPerWindow), false);
	});
});
