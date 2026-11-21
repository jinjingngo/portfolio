/**
 * Reads a request body up to `maxBytes`, or returns null as soon as it is
 * larger (and stops reading), so an oversized upload never sits in memory.
 * A missing body reads as empty.
 */
export const readLimited = async (
	body: ReadableStream<Uint8Array<ArrayBuffer>> | null,
	maxBytes: number,
): Promise<Blob | null> => {
	if (!body) return new Blob([]);
	const reader = body.getReader();
	const chunks: Uint8Array<ArrayBuffer>[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) return new Blob(chunks);
		total += value.byteLength;
		if (total > maxBytes) {
			await reader.cancel();
			return null;
		}
		chunks.push(value);
	}
};
