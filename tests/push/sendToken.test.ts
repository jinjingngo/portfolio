import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	encodeSendToken,
	hashSendToken,
	timingSafeEqual,
	verifySendToken,
} from "../../src/app/lib/push/sendToken.ts";

describe("encodeSendToken", () => {
	it("encodes bytes as unpadded base64url", () => {
		assert.equal(encodeSendToken(new Uint8Array([251, 255, 191])), "-_-_");
		assert.equal(encodeSendToken(new Uint8Array(32)).length, 43);
	});
});

describe("hashSendToken", () => {
	it("returns the SHA-256 hex digest", async () => {
		assert.equal(
			await hashSendToken("abc"),
			"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		);
	});
});

describe("timingSafeEqual", () => {
	it("compares strings exactly", () => {
		assert.equal(timingSafeEqual("abc", "abc"), true);
		assert.equal(timingSafeEqual("abc", "abd"), false);
		assert.equal(timingSafeEqual("abc", "abcd"), false);
	});
});

describe("verifySendToken", () => {
	it("accepts only the token whose hash is stored", async () => {
		const hash = await hashSendToken("secret");
		assert.equal(await verifySendToken(hash, "secret"), true);
		assert.equal(await verifySendToken(hash, "other"), false);
	});

	it("rejects missing hashes and non-string tokens", async () => {
		const hash = await hashSendToken("secret");
		assert.equal(await verifySendToken(undefined, "secret"), false);
		assert.equal(await verifySendToken(hash, undefined), false);
		assert.equal(await verifySendToken(hash, ""), false);
		assert.equal(await verifySendToken(hash, 123), false);
	});
});
