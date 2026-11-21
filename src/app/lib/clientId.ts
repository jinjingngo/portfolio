/** The browser's random client id, shared by push and translate. */

/** Longest client id accepted; ids are UUIDs, so this is generous. */
export const MAX_CLIENT_ID_LENGTH = 128;

export const isValidClientId = (clientId: unknown): clientId is string =>
	typeof clientId === "string" &&
	clientId.length > 0 &&
	clientId.length <= MAX_CLIENT_ID_LENGTH;
