import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	PushSubscriptionExpiredError,
	sendPushNotification,
	unsubscribeFromPush,
} from "../../src/app/lib/push/subscribeToPush.ts";

const TOKEN_KEY = "JJ:WEB_PUSH_SEND_TOKEN";
const CLIENT_ID = "client-1";
const NOTIFICATION = { title: "t", message: "m", url: "/" };

type Call = { path: string; body: Record<string, unknown> };
type Handler = (body: Record<string, unknown>) => Response;

/** Installs a fake browser: storage, one push subscription, optional Web Locks, scripted fetch. */
const fakeBrowser = (
	routes: Record<string, Handler[]>,
	options = { locks: false },
) => {
	const store = new Map<string, string>();
	const calls: Call[] = [];
	const makeSubscription = (endpoint: string) => {
		const made = {
			endpoint,
			unsubscribed: false,
			failUnsubscribe: false,
			toJSON: () => ({ endpoint, keys: {} }),
			unsubscribe: async () => {
				if (made.failUnsubscribe) throw new Error("unsubscribe failed");
				made.unsubscribed = true;
				return true;
			},
		};
		return made;
	};
	const subscription = makeSubscription(OLD_ENDPOINT);
	let current = subscription;
	/** Another tab re-subscribed: the browser now has a different subscription. */
	const replaceSubscription = () => {
		current = makeSubscription("https://push.example/new");
		return current;
	};
	const define = (name: string, value: unknown) =>
		Object.defineProperty(globalThis, name, {
			value,
			configurable: true,
			writable: true,
		});

	define("localStorage", {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => store.set(key, value),
		removeItem: (key: string) => store.delete(key),
	});
	define("navigator", {
		serviceWorker: {
			getRegistration: async () => ({
				pushManager: {
					getSubscription: async () =>
						current.unsubscribed ? null : current,
				},
			}),
		},
		locks: options.locks
			? {
					request: async (
						_name: string,
						callback: () => Promise<unknown>,
					) => callback(),
				}
			: undefined,
	});
	define("fetch", async (path: string, init: { body: string }) => {
		const body = JSON.parse(init.body);
		calls.push({ path, body });
		const handler = routes[path]?.shift();
		if (!handler) throw new Error(`unexpected request ${path}`);
		return handler(body);
	});
	return { store, calls, subscription, replaceSubscription };
};

const OLD_ENDPOINT = "https://push.example/abc";
const gone = () => json(410, { ok: false, expiredEndpoint: OLD_ENDPOINT });

const json = (status: number, body: unknown = {}) =>
	new Response(JSON.stringify(body), { status });

describe("sendPushNotification", () => {
	it("re-saves once with the rejected token and retries with the fresh one", async () => {
		const browser = fakeBrowser(
			{
				"/api/push/send": [() => json(401), () => json(201)],
				"/api/push/subscribe": [() => json(200, { token: "fresh" })],
			},
			{ locks: true },
		);
		browser.store.set(TOKEN_KEY, "stale");

		await sendPushNotification(CLIENT_ID, NOTIFICATION);

		assert.deepEqual(
			browser.calls.map((call) => [call.path, call.body.token]),
			[
				["/api/push/send", "stale"],
				["/api/push/subscribe", "stale"],
				["/api/push/send", "fresh"],
			],
		);
		assert.equal(browser.store.get(TOKEN_KEY), "fresh");
	});

	it("reuses a token another tab stored instead of re-saving", async () => {
		const browser = fakeBrowser({
			"/api/push/send": [
				() => {
					browser.store.set(TOKEN_KEY, "from-other-tab");
					return json(401);
				},
				() => json(201),
			],
		});
		browser.store.set(TOKEN_KEY, "stale");

		await sendPushNotification(CLIENT_ID, NOTIFICATION);

		assert.deepEqual(
			browser.calls.map((call) => [call.path, call.body.token]),
			[
				["/api/push/send", "stale"],
				["/api/push/send", "from-other-tab"],
			],
		);
	});

	it("drops an expired subscription locally and never re-saves it", async () => {
		const browser = fakeBrowser({ "/api/push/send": [gone] });
		browser.store.set(TOKEN_KEY, "token");

		await assert.rejects(
			sendPushNotification(CLIENT_ID, NOTIFICATION),
			PushSubscriptionExpiredError,
		);
		assert.equal(browser.store.has(TOKEN_KEY), false);
		assert.equal(browser.subscription.unsubscribed, true);
		assert.deepEqual(
			browser.calls.map((call) => call.path),
			["/api/push/send"],
		);
	});

	it("keeps a subscription another tab created while the send was in flight", async () => {
		let replacement: { unsubscribed: boolean } | undefined;
		const browser = fakeBrowser({
			"/api/push/send": [
				() => {
					replacement = browser.replaceSubscription();
					browser.store.set(TOKEN_KEY, "token-of-new-subscription");
					return gone();
				},
			],
		});
		browser.store.set(TOKEN_KEY, "token");

		await assert.rejects(
			sendPushNotification(CLIENT_ID, NOTIFICATION),
			/could not be sent/,
		);
		assert.equal(browser.store.get(TOKEN_KEY), "token-of-new-subscription");
		assert.equal(replacement?.unsubscribed, false);
	});

	it("keeps a newer local subscription the server hasn't saved yet", async () => {
		const browser = fakeBrowser({ "/api/push/send": [gone] });
		browser.store.set(TOKEN_KEY, "token");
		const newer = browser.replaceSubscription();

		await assert.rejects(
			sendPushNotification(CLIENT_ID, NOTIFICATION),
			/could not be sent/,
		);
		assert.equal(newer.unsubscribed, false);
		assert.equal(browser.store.get(TOKEN_KEY), "token");
	});

	it("drops nothing when a 410 doesn't name the expired endpoint", async () => {
		const browser = fakeBrowser({ "/api/push/send": [() => json(410)] });
		browser.store.set(TOKEN_KEY, "token");

		await assert.rejects(
			sendPushNotification(CLIENT_ID, NOTIFICATION),
			/could not be sent/,
		);
		assert.equal(browser.subscription.unsubscribed, false);
	});

	it("keeps token and toggle when the browser can't drop the expired subscription", async () => {
		const browser = fakeBrowser({ "/api/push/send": [gone] });
		browser.store.set(TOKEN_KEY, "token");
		browser.subscription.failUnsubscribe = true;

		await assert.rejects(
			sendPushNotification(CLIENT_ID, NOTIFICATION),
			(error: Error) =>
				!(error instanceof PushSubscriptionExpiredError) &&
				/could not be sent/.test(error.message),
		);
		assert.equal(browser.store.get(TOKEN_KEY), "token");
	});

	it("reports throttling and other failures with their own messages", async () => {
		const browser = fakeBrowser({
			"/api/push/send": [() => json(429), () => json(502)],
		});
		browser.store.set(TOKEN_KEY, "token");

		await assert.rejects(
			sendPushNotification(CLIENT_ID, NOTIFICATION),
			/Too many notifications/,
		);
		await assert.rejects(
			sendPushNotification(CLIENT_ID, NOTIFICATION),
			/could not be sent/,
		);
		assert.equal(browser.store.get(TOKEN_KEY), "token");
	});
});

describe("unsubscribeFromPush", () => {
	it("recovers from a stale token, then clears the token and the subscription", async () => {
		const browser = fakeBrowser({
			"/api/push/unsubscribe": [
				() => json(401),
				() => json(200, { ok: true }),
			],
			"/api/push/subscribe": [() => json(200, { token: "fresh" })],
		});
		browser.store.set(TOKEN_KEY, "stale");

		await unsubscribeFromPush(CLIENT_ID);

		assert.deepEqual(
			browser.calls.map((call) => [call.path, call.body.token]),
			[
				["/api/push/unsubscribe", "stale"],
				["/api/push/subscribe", "stale"],
				["/api/push/unsubscribe", "fresh"],
			],
		);
		assert.equal(browser.store.has(TOKEN_KEY), false);
		assert.equal(browser.subscription.unsubscribed, true);
	});
});
