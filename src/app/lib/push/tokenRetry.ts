/**
 * Recovery for a stale send token. The browser's token can stop matching the
 * server's (e.g. a subscription saved before tokens existed); a 401 then means
 * "get a fresh token", which the caller does by re-saving its subscription.
 * Effects are passed in, so this decides only when to retry.
 */
export const requestWithTokenRetry = async (
	token: string,
	request: (token: string) => Promise<Response>,
	refreshToken: () => Promise<string | null>,
): Promise<Response> => {
	const response = await request(token);
	if (response.status !== 401) return response;

	const freshToken = await refreshToken();
	if (!freshToken) return response;

	return request(freshToken);
};
