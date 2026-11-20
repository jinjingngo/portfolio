/**
 * Per-subscriber send tokens. The browser keeps the plain token; the server
 * stores only its SHA-256 hash. Randomness is passed in as bytes.
 */

const toHex = (buffer: ArrayBuffer) =>
	[...new Uint8Array(buffer)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");

/** Encodes random bytes as a URL-safe token. */
export const encodeSendToken = (bytes: Uint8Array) =>
	btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");

export const hashSendToken = async (token: string) =>
	toHex(
		await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
	);

/** Compares equal-length strings without exiting early on a mismatch. */
export const timingSafeEqual = (a: string, b: string) => {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
};

/** True when `token` matches `tokenHash`; false when either is missing. */
export const verifySendToken = async (
	tokenHash: string | undefined,
	token: unknown,
) => {
	if (!tokenHash || typeof token !== "string" || !token) return false;
	return timingSafeEqual(await hashSendToken(token), tokenHash);
};
