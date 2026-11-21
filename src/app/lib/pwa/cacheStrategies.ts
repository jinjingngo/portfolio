import { isCacheable } from "./cachePolicy";

/**
 * Cache strategies over small ports, so they run in Node tests with fakes.
 * The worker passes real `caches.open(...)` caches and `fetch`.
 */

/** The part of the Cache API the strategies use. */
export type CacheStore = {
	match(request: Request): Promise<Response | undefined>;
	put(request: Request, response: Response): Promise<void>;
	keys(): Promise<readonly Request[]>;
	delete(request: Request): Promise<boolean>;
};

export type Fetcher = (request: Request) => Promise<Response>;

const storable = (response: Response) =>
	isCacheable({
		status: response.status,
		type: response.type,
		cacheControl: response.headers.get("cache-control"),
		redirected: response.redirected,
	});

/** Stores a copy of `response` if it may be cached; returns the original. */
const remember = async (
	cache: CacheStore,
	request: Request,
	response: Response,
) => {
	if (storable(response)) await cache.put(request, response.clone());
	return response;
};

/** Drops the oldest entries (Cache keys are in insertion order) beyond `max`. */
export const trimCache = async (cache: CacheStore, max: number) => {
	const keys = await cache.keys();
	for (const key of keys.slice(0, Math.max(0, keys.length - max))) {
		await cache.delete(key);
	}
};

/** Cached copy if there is one, else the network (and keep it). */
export const cacheFirst = async (
	request: Request,
	cache: CacheStore,
	fetcher: Fetcher,
) =>
	(await cache.match(request)) ??
	remember(cache, request, await fetcher(request));

/**
 * The network, unless it fails or takes longer than `timeoutMs`; then the
 * cached copy, then `fallback()` (e.g. the offline page).
 */
export const networkFirst = async (
	request: Request,
	cache: CacheStore,
	fetcher: Fetcher,
	options: {
		timeoutMs: number;
		fallback: () => Promise<Response | undefined>;
		/** Lets a slow network response still update the cache after the timeout. */
		waitUntil: (work: Promise<unknown>) => void;
	},
) => {
	const network = fetcher(request).then((response) =>
		remember(cache, request, response),
	);
	options.waitUntil(network.catch(() => undefined));

	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<undefined>((resolve) => {
		timer = setTimeout(() => resolve(undefined), options.timeoutMs);
	});
	const fresh = await Promise.race([network.catch(() => undefined), timeout]);
	clearTimeout(timer);
	if (fresh) return fresh;

	const cached = await cache.match(request);
	if (cached) return cached;
	// Timed out with nothing cached: keep waiting for the network after all.
	const late = await network.catch(() => undefined);
	return late ?? (await options.fallback()) ?? offlineResponse();
};

/** Cached copy at once while a fresh copy is fetched in the background. */
export const staleWhileRevalidate = async (
	request: Request,
	cache: CacheStore,
	fetcher: Fetcher,
	waitUntil: (work: Promise<unknown>) => void,
) => {
	const cached = await cache.match(request);
	const network = fetcher(request).then((response) =>
		remember(cache, request, response),
	);
	if (cached) {
		waitUntil(network.catch(() => undefined));
		return cached;
	}
	return network;
};

/** Last resort when offline and nothing is cached. */
export const offlineResponse = () =>
	new Response("You're offline.", {
		status: 503,
		headers: { "content-type": "text/plain; charset=utf-8" },
	});
