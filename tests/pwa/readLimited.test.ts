import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readLimited } from "../../src/app/lib/pwa/readLimited.ts";

/** A stream of `count` chunks of `size` bytes that records how far it was read. */
const chunked = (count: number, size: number) => {
	const state = { pulled: 0, cancelled: false };
	const stream = new ReadableStream<Uint8Array<ArrayBuffer>>({
		pull(controller) {
			if (state.pulled === count) {
				controller.close();
				return;
			}
			state.pulled++;
			controller.enqueue(new Uint8Array(size));
		},
		cancel() {
			state.cancelled = true;
		},
	});
	return { stream, state };
};

describe("readLimited", () => {
	it("reads a body within the limit", async () => {
		const { stream } = chunked(3, 10);
		const blob = await readLimited(stream, 30);
		assert.equal(blob?.size, 30);
	});

	it("stops reading and gives null once the body passes the limit", async () => {
		const { stream, state } = chunked(1000, 10);
		assert.equal(await readLimited(stream, 25), null);
		assert.equal(state.cancelled, true);
		assert.ok(state.pulled < 10, `read ${state.pulled} chunks`);
	});

	it("reads a missing body as empty", async () => {
		assert.equal((await readLimited(null, 10))?.size, 0);
	});
});
