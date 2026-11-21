import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { requestWithTokenRetry } from "../../src/app/lib/push/tokenRetry.ts";

/** A fake request that answers each token with the given status, recording calls. */
const fakeRequest = (statusByToken: Record<string, number>) => {
	const calls: string[] = [];
	const request = async (token: string) => {
		calls.push(token);
		return new Response(null, { status: statusByToken[token] ?? 500 });
	};
	return { calls, request };
};

describe("requestWithTokenRetry", () => {
	it("does not refresh when the token is accepted", async () => {
		const { calls, request } = fakeRequest({ good: 200 });
		let refreshed = false;
		const response = await requestWithTokenRetry(
			"good",
			request,
			async () => {
				refreshed = true;
				return "fresh";
			},
		);
		assert.equal(response.status, 200);
		assert.deepEqual(calls, ["good"]);
		assert.equal(refreshed, false);
	});

	it("refreshes once and retries with the fresh token after a 401", async () => {
		const { calls, request } = fakeRequest({ stale: 401, fresh: 200 });
		const response = await requestWithTokenRetry(
			"stale",
			request,
			async () => "fresh",
		);
		assert.equal(response.status, 200);
		assert.deepEqual(calls, ["stale", "fresh"]);
	});

	it("retries only once, returning the second 401", async () => {
		const { calls, request } = fakeRequest({ stale: 401, fresh: 401 });
		const response = await requestWithTokenRetry(
			"stale",
			request,
			async () => "fresh",
		);
		assert.equal(response.status, 401);
		assert.deepEqual(calls, ["stale", "fresh"]);
	});

	it("returns the original 401 when no fresh token is available", async () => {
		const { calls, request } = fakeRequest({ stale: 401 });
		const response = await requestWithTokenRetry(
			"stale",
			request,
			async () => null,
		);
		assert.equal(response.status, 401);
		assert.deepEqual(calls, ["stale"]);
	});

	it("does not retry other errors", async () => {
		const { calls, request } = fakeRequest({ limited: 429 });
		const response = await requestWithTokenRetry(
			"limited",
			request,
			async () => "fresh",
		);
		assert.equal(response.status, 429);
		assert.deepEqual(calls, ["limited"]);
	});
});
