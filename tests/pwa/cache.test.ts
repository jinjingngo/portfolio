import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	cacheNames,
	isCacheable,
	isOfflinePage,
	obsoleteCaches,
	offlineUrl,
	type RequestInfo,
	safeSitePath,
	staticAssetsIn,
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

/** Collects background work so a test can wait for cache writes. */
const background = () => {
	const pending: Promise<unknown>[] = [];
	return {
		waitUntil: (work: Promise<unknown>) => {
			pending.push(work);
		},
		settle: () => Promise.all(pending),
	};
};

/** A cache whose writes always fail (e.g. storage full). */
const fullCache = (): CacheStore => ({
	match: async () => undefined,
	put: async () => {
		throw new DOMException("Quota exceeded", "QuotaExceededError");
	},
	keys: async () => [],
	delete: async () => false,
});

describe("cacheFirst", () => {
	it("fetches and stores once, then serves from the cache", async () => {
		const { store, entries } = memoryCache();
		const bg = background();
		let fetches = 0;
		const fetcher = async () => {
			fetches++;
			return basic("chunk");
		};
		assert.equal(
			await text(
				await cacheFirst(
					req("/_next/static/a.js"),
					store,
					fetcher,
					bg.waitUntil,
				),
			),
			"chunk",
		);
		await bg.settle();
		assert.equal(
			await text(
				await cacheFirst(
					req("/_next/static/a.js"),
					store,
					fetcher,
					bg.waitUntil,
				),
			),
			"chunk",
		);
		assert.equal(fetches, 1);
		assert.equal(entries.size, 1);
	});

	it("doesn't store errors", async () => {
		const { store, entries } = memoryCache();
		const bg = background();
		const response = await cacheFirst(
			req("/_next/static/gone.js"),
			store,
			async () => basic("missing", { status: 404 }),
			bg.waitUntil,
		);
		await bg.settle();
		assert.equal(response.status, 404);
		assert.equal(entries.size, 0);
	});

	it("still returns the network response when the cache write fails", async () => {
		const bg = background();
		const response = await cacheFirst(
			req("/_next/static/a.js"),
			fullCache(),
			async () => basic("chunk"),
			bg.waitUntil,
		);
		assert.equal(await text(response), "chunk");
		await bg.settle();
	});
});

describe("networkFirst", () => {
	const options = (
		bg: ReturnType<typeof background>,
		fallback = async () => undefined as Response | undefined,
	) => ({
		timeoutMs: 50,
		fallback,
		waitUntil: bg.waitUntil,
	});

	it("uses and stores the network response when it's fast", async () => {
		const { store, entries } = memoryCache();
		const bg = background();
		const response = await networkFirst(
			req("/lab"),
			store,
			async () => basic("fresh"),
			options(bg),
		);
		assert.equal(await text(response), "fresh");
		await bg.settle();
		assert.equal(entries.size, 1);
	});

	it("still returns a good network response when the cache write fails", async () => {
		const bg = background();
		const response = await networkFirst(
			req("/lab"),
			fullCache(),
			async () => basic("fresh"),
			options(bg, async () => basic("FALLBACK")),
		);
		assert.equal(await text(response), "fresh");
		await bg.settle();
	});

	it("serves the cached page when offline", async () => {
		const { store } = memoryCache();
		const bg = background();
		await store.put(req("/lab"), basic("cached"));
		assert.equal(
			await text(
				await networkFirst(req("/lab"), store, offline, options(bg)),
			),
			"cached",
		);
	});

	it("serves the cached page when the network is too slow", async () => {
		const { store } = memoryCache();
		const bg = background();
		await store.put(req("/lab"), basic("cached"));
		const slow = () =>
			new Promise<Response>((resolve) =>
				setTimeout(() => resolve(basic("late")), 300),
			);
		assert.equal(
			await text(
				await networkFirst(req("/lab"), store, slow, options(bg)),
			),
			"cached",
		);
		await bg.settle();
	});

	it("waits for a slow network when nothing is cached", async () => {
		const { store } = memoryCache();
		const bg = background();
		const slow = () =>
			new Promise<Response>((resolve) =>
				setTimeout(() => resolve(basic("late")), 120),
			);
		assert.equal(
			await text(
				await networkFirst(req("/new"), store, slow, options(bg)),
			),
			"late",
		);
		await bg.settle();
	});

	it("uses the fallback (offline page), then a 503, when offline with nothing cached", async () => {
		const { store } = memoryCache();
		const bg = background();
		const page = await networkFirst(
			req("/new"),
			store,
			offline,
			options(bg, async () => basic("offline page")),
		);
		assert.equal(await text(page), "offline page");
		const bare = await networkFirst(
			req("/new"),
			store,
			offline,
			options(bg),
		);
		assert.equal(bare.status, 503);
	});
});

describe("staleWhileRevalidate", () => {
	it("serves the cached copy at once and refreshes it in the background", async () => {
		const { store } = memoryCache();
		const bg = background();
		await store.put(req("/icon-192.png"), basic("old"));
		const response = await staleWhileRevalidate(
			req("/icon-192.png"),
			store,
			async () => basic("new"),
			bg.waitUntil,
		);
		assert.equal(await text(response), "old");
		await bg.settle();
		await bg.settle();
		assert.equal(
			await text(await store.match(req("/icon-192.png"))),
			"new",
		);
	});

	it("fetches when nothing is cached, and survives a failed refresh", async () => {
		const { store } = memoryCache();
		const bg = background();
		assert.equal(
			await text(
				await staleWhileRevalidate(
					req("/a.png"),
					store,
					async () => basic("first"),
					bg.waitUntil,
				),
			),
			"first",
		);
		await bg.settle();
		const cached = await staleWhileRevalidate(
			req("/a.png"),
			store,
			offline,
			bg.waitUntil,
		);
		assert.equal(await text(cached), "first");
		await bg.settle();
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

describe("safeSitePath against browser URL quirks", () => {
	it("refuses paths a browser would resolve to another site", () => {
		for (const value of [
			"/\\evil.example",
			"/\t/evil.example",
			"/\n/evil.example",
			"/\\/evil.example",
		]) {
			assert.equal(safeSitePath(value), "/", JSON.stringify(value));
		}
	});

	it("keeps ordinary paths with query and hash", () => {
		assert.equal(
			safeSitePath("/lab/web-push?a=1#b"),
			"/lab/web-push?a=1#b",
		);
	});
});

describe("offlineUrl and safeSitePath", () => {
	it("sends an uncached page offline to /offline, remembering it", () => {
		assert.equal(
			offlineUrl(`${ORIGIN}/lab/web-push?x=1`),
			"/offline?from=%2Flab%2Fweb-push%3Fx%3D1",
		);
	});

	it("only returns to paths on this site", () => {
		assert.equal(safeSitePath("/lab/web-push?x=1"), "/lab/web-push?x=1");
		for (const value of [
			"//evil.example",
			"https://evil.example",
			"javascript:x",
			null,
			undefined,
		]) {
			assert.equal(safeSitePath(value), "/");
		}
	});
});

describe("staticAssetsIn", () => {
	it("finds the hashed scripts and styles a page loads, once each", () => {
		const html = `<link rel="stylesheet" href="/_next/static/chunks/a1.css"/><script src="/_next/static/chunks/b2.js" async=""></script><script src="/_next/static/chunks/b2.js"></script><img src="/icon-192.png"/><script src="https://cdn.example/x.js"></script>`;
		assert.deepEqual(staticAssetsIn(html), [
			"/_next/static/chunks/a1.css",
			"/_next/static/chunks/b2.js",
		]);
	});
});

describe("safeSitePath without URL.canParse (Safari 16, service worker)", () => {
	it("works when the browser lacks URL.canParse", () => {
		const original = URL.canParse;
		// @ts-expect-error simulate an older browser
		delete URL.canParse;
		try {
			assert.equal(safeSitePath("/lab?a=1"), "/lab?a=1");
			assert.equal(safeSitePath("/\\evil.example"), "/");
		} finally {
			URL.canParse = original;
		}
	});
});

describe("isOfflinePage", () => {
	it("is true for pages, false for APIs, assets and the worker", () => {
		assert.equal(isOfflinePage("/lab/camera-translate", ORIGIN), true);
		assert.equal(isOfflinePage("/", ORIGIN), true);
		for (const path of [
			"/api/push/send",
			"/_next/static/a.js",
			"/sw.js",
			"/icon-192.png",
		]) {
			assert.equal(isOfflinePage(path, ORIGIN), false, path);
		}
	});
});
