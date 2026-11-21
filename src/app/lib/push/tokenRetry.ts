/**
 * Recovery for a stale send token. The browser's token can stop matching the
 * server's (e.g. a subscription saved before tokens existed); a 401 then means
 * "get a fresh token", which the caller does by re-saving its subscription.
 * Effects are passed in, so this decides only when to retry.
 */
export const requestWithTokenRetry = async (
	token: string,
	request: (token: string) => Promise<Response>,
	refreshToken: (staleToken: string) => Promise<string | null>,
): Promise<Response> => {
	const response = await request(token);
	if (response.status !== 401) return response;

	const freshToken = await refreshToken(token);
	if (!freshToken) return response;

	return request(freshToken);
};

/**
 * The token another tab already refreshed, if any: the stored token when it
 * differs from the one the server just rejected. Reusing it keeps two tabs
 * from re-saving at once and invalidating each other's fresh token.
 */
export const tokenRefreshedElsewhere = (
	storedToken: string | null,
	staleToken: string,
) => (storedToken && storedToken !== staleToken ? storedToken : null);
