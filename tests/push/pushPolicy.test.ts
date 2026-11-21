import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	decideSubscribe,
	deliveryStatus,
	hasSendQuota,
	isValidClientId,
	PUSH_LIMITS,
	parseNotification,
	parseVapidPrivateKey,
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

describe("decideSubscribe", () => {
	const decide = (
		hasExisting: boolean,
		sameEndpoint: boolean,
		validToken: boolean,
	) => decideSubscribe({ hasExisting, sameEndpoint, validToken });

	it("issues a token to a new subscriber", () => {
		assert.deepEqual(decide(false, false, false), {
			ok: true,
			value: "issue",
		});
	});

	it("keeps a valid token, so re-subscribing never invalidates it", () => {
		assert.deepEqual(decide(true, true, true), { ok: true, value: "keep" });
		assert.deepEqual(decide(true, false, true), {
			ok: true,
			value: "keep",
		});
	});

	it("issues a fresh token to the same browser with a stale or missing token", () => {
		assert.deepEqual(decide(true, true, false), {
			ok: true,
			value: "issue",
		});
	});

	it("rejects a different browser without a valid token", () => {
		const decision = decide(true, false, false);
		assert.equal(decision.ok, false);
		assert.equal(!decision.ok && decision.status, 403);
	});
});

describe("deliveryStatus", () => {
	it("passes push-service successes through", () => {
		assert.equal(deliveryStatus(201), 201);
		assert.equal(deliveryStatus(200), 200);
	});

	it("maps push-service failures to 502, never to our own 401", () => {
		for (const status of [400, 401, 403, 404, 410, 413, 429, 500, 503]) {
			assert.equal(deliveryStatus(status), 502);
		}
	});
});

describe("parseVapidPrivateKey", () => {
	it("parses a JWK stored as JSON", () => {
		const jwk = { kty: "EC", crv: "P-256", x: "x", y: "y", d: "d" };
		assert.deepEqual(parseVapidPrivateKey(JSON.stringify(jwk)), jwk);
	});

	it("returns null, never an error quoting the secret, for invalid values", () => {
		for (const raw of [
			undefined,
			"",
			"SECRETKEYNOTJSON",
			"null",
			"42",
			'"text"',
		]) {
			assert.equal(parseVapidPrivateKey(raw), null);
		}
	});
});
