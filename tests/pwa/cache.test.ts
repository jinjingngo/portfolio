import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	cacheNames,
	isCacheable,
	obsoleteCaches,
	type RequestInfo,
	strategyFor,
} from "../../src/app/lib/pwa/cachePolicy.ts";
import {
	type CacheStore,
	cacheFirst,
	networkFirst,
	staleWhileRevalidate,
	trimCache,
} from "../../src/app/lib/pwa/cacheStrategies.ts";

const ORIGIN = "https://wujinjing.com";

const request = (
	path: string,
	overrides: Partial<RequestInfo> = {},
): RequestInfo => ({
	method: "GET",
	url: path.startsWith("http") ? path : `${ORIGIN}${path}`,
	mode: "no-cors",
	destination: "",
	isRsc: false,
	...overrides,
});

describe("strategyFor", () => {
	const kind = (info: RequestInfo) => strategyFor(info, ORIGIN).kind;

	it("caches hashed Next.js files first, pages network-first, assets stale-while-revalidate", () => {
		assert.deepEqual(
			strategyFor(request("/_next/static/chunks/a1b2.js"), ORIGIN),
			{
				kind: "cache-first",
				cache: "static",
			},
		);
		assert.deepEqual(
			strategyFor(request("/lab", { mode: "navigate" }), ORIGIN),
			{
				kind: "network-first",
				cache: "pages",
			},
		);
		for (const info of [
			request("/icon-192.png"),
			request("/images/projects/x.webp"),
			request("/_next/image?url=%2Fa.png&w=640&q=75"),
			request("/fonts/f", { destination: "font" }),
			request("/resumes/cv.pdf"),
		]) {
			assert.deepEqual(strategyFor(info, ORIGIN), {
				kind: "stale-while-revalidate",
				cache: "assets",
			});
		}
	});

	it("never caches APIs, non-GET, other origins, the worker, manifest or RSC fetches", () => {
		for (const info of [
			request("/api/push/public_key"),
			request("/api/translate/image", { method: "POST" }),
			request("/lab", { method: "POST", mode: "navigate" }),
			request("https://fonts.gstatic.com/a.woff2", {
				destination: "font",
			}),
			request("/sw.js"),
			request("/webPushServiceWorker.js"),
			request("/manifest.webmanifest"),
			request("/sitemap.xml"),
			request("/lab", { isRsc: true }),
			request("/lab?_rsc=abc"),
			request("/cdn-cgi/access/login"),
			request("/some-data.json"),
		]) {
			assert.equal(kind(info), "network-only", info.url);
		}
	});
});

describe("cacheNames and obsoleteCaches", () => {
	it("versions pages and the precache, shares static files and assets", () => {
		assert.deepEqual(cacheNames("abc"), {
			precache: "jj-precache-abc",
			pages: "jj-pages-abc",
			static: "jj-static",
			assets: "jj-assets",
		});
	});

	it("deletes older versions' caches only, never other caches", () => {
		const existing = [
			"jj-precache-old",
			"jj-pages-old",
			"jj-precache-new",
			"jj-pages-new",
			"jj-static",
			"jj-assets",
			"someone-elses-cache",
		];
		assert.deepEqual(obsoleteCaches(existing, "new"), [
			"jj-precache-old",
			"jj-pages-old",
		]);
	});
});

describe("isCacheable", () => {
	const ok = {
		status: 200,
		type: "basic",
		cacheControl: null,
		redirected: false,
	};

	it("stores complete same-origin successes", () => {
		assert.equal(isCacheable(ok), true);
		assert.equal(
			isCacheable({ ...ok, cacheControl: "public, max-age=60" }),
			true,
		);
	});

	it("refuses errors, partial and opaque responses, redirects and no-store", () => {
		for (const response of [
			{ ...ok, status: 404 },
			{ ...ok, status: 500 },
			{ ...ok, status: 206 },
			{ ...ok, type: "opaque" },
			{ ...ok, redirected: true },
			{ ...ok, cacheControl: "private, no-store" },
		]) {
			assert.equal(isCacheable(response), false);
		}
	});
});

/** A same-origin ("basic") response, as the browser's fetch would return. */
const basic = (body: string, init: ResponseInit = {}) => {
	const response = new Response(body, { status: 200, ...init });
	Object.defineProperty(response, "type", { value: "basic" });
	const clone = response.clone.bind(response);
	Object.defineProperty(response, "clone", {
		value: () => {
			const copy = clone();
			Object.defineProperty(copy, "type", { value: "basic" });
			return copy;
		},
	});
	return response;
};

/** An in-memory Cache: matches by URL, keys in insertion order. */
const memoryCache = () => {
	const entries = new Map<string, Response>();
	const store: CacheStore = {
		match: async (req) => entries.get(req.url)?.clone(),
		put: async (req, response) => {
			entries.delete(req.url);
			entries.set(req.url, response);
		},
		keys: async () => [...entries.keys()].map((url) => new Request(url)),
		delete: async (req) => entries.delete(req.url),
	};
	return { store, entries };
};

const req = (path: string) => new Request(`${ORIGIN}${path}`);
const text = async (response: Response | undefined) => response?.text();
const offline = async (): Promise<Response> => {
	throw new TypeError("Failed to fetch");
};

describe("cacheFirst", () => {
	it("fetches and stores once, then serves from the cache", async () => {
		const { store, entries } = memoryCache();
		let fetches = 0;
		const fetcher = async () => {
			fetches++;
			return basic("chunk");
		};
		assert.equal(
			await text(
				await cacheFirst(req("/_next/static/a.js"), store, fetcher),
			),
			"chunk",
		);
		assert.equal(
			await text(
				await cacheFirst(req("/_next/static/a.js"), store, fetcher),
			),
			"chunk",
		);
		assert.equal(fetches, 1);
		assert.equal(entries.size, 1);
	});

	it("doesn't store errors", async () => {
		const { store, entries } = memoryCache();
		const response = await cacheFirst(
			req("/_next/static/gone.js"),
			store,
			async () => basic("missing", { status: 404 }),
		);
		assert.equal(response.status, 404);
		assert.equal(entries.size, 0);
	});
});

describe("networkFirst", () => {
	const options = (
		fallback = async () => undefined as Response | undefined,
	) => ({
		timeoutMs: 50,
		fallback,
		waitUntil: () => {},
	});

	it("uses and stores the network response when it's fast", async () => {
		const { store, entries } = memoryCache();
		const response = await networkFirst(
			req("/lab"),
			store,
			async () => basic("fresh"),
			options(),
		);
		assert.equal(await text(response), "fresh");
		assert.equal(entries.size, 1);
	});

	it("serves the cached page when offline", async () => {
		const { store } = memoryCache();
		await store.put(req("/lab"), basic("cached"));
		assert.equal(
			await text(
				await networkFirst(req("/lab"), store, offline, options()),
			),
			"cached",
		);
	});

	it("serves the cached page when the network is too slow", async () => {
		const { store } = memoryCache();
		await store.put(req("/lab"), basic("cached"));
		const slow = () =>
			new Promise<Response>((resolve) =>
				setTimeout(() => resolve(basic("late")), 300),
			);
		assert.equal(
			await text(await networkFirst(req("/lab"), store, slow, options())),
			"cached",
		);
	});

	it("waits for a slow network when nothing is cached", async () => {
		const { store } = memoryCache();
		const slow = () =>
			new Promise<Response>((resolve) =>
				setTimeout(() => resolve(basic("late")), 120),
			);
		assert.equal(
			await text(await networkFirst(req("/new"), store, slow, options())),
			"late",
		);
	});

	it("uses the fallback (offline page), then a 503, when offline with nothing cached", async () => {
		const { store } = memoryCache();
		const page = await networkFirst(
			req("/new"),
			store,
			offline,
			options(async () => basic("offline page")),
		);
		assert.equal(await text(page), "offline page");
		const bare = await networkFirst(req("/new"), store, offline, options());
		assert.equal(bare.status, 503);
	});
});

describe("staleWhileRevalidate", () => {
	it("serves the cached copy at once and refreshes it in the background", async () => {
		const { store } = memoryCache();
		await store.put(req("/icon-192.png"), basic("old"));
		const pending: Promise<unknown>[] = [];
		const response = await staleWhileRevalidate(
			req("/icon-192.png"),
			store,
			async () => basic("new"),
			(work) => pending.push(work),
		);
		assert.equal(await text(response), "old");
		await Promise.all(pending);
		assert.equal(
			await text(await store.match(req("/icon-192.png"))),
			"new",
		);
	});

	it("fetches when nothing is cached, and survives a failed refresh", async () => {
		const { store } = memoryCache();
		assert.equal(
			await text(
				await staleWhileRevalidate(
					req("/a.png"),
					store,
					async () => basic("first"),
					() => {},
				),
			),
			"first",
		);
		const pending: Promise<unknown>[] = [];
		const cached = await staleWhileRevalidate(
			req("/a.png"),
			store,
			offline,
			(work) => pending.push(work),
		);
		assert.equal(await text(cached), "first");
		await Promise.all(pending);
	});
});

describe("trimCache", () => {
	it("drops the oldest entries beyond the limit", async () => {
		const { store, entries } = memoryCache();
		for (const path of ["/1.png", "/2.png", "/3.png", "/4.png"])
			await store.put(req(path), basic(path));
		await trimCache(store, 2);
		assert.deepEqual(
			[...entries.keys()].map((url) => new URL(url).pathname),
			["/3.png", "/4.png"],
		);
	});
});
