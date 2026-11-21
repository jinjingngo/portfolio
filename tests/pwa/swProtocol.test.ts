import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	GET_VERSION,
	notificationFromPush,
	parseWorkerMessage,
	SKIP_WAITING,
	safeNotificationPath,
} from "../../src/app/lib/pwa/swProtocol.ts";

describe("parseWorkerMessage", () => {
	it("reads the known messages", () => {
		assert.deepEqual(parseWorkerMessage({ type: SKIP_WAITING }), {
			type: SKIP_WAITING,
		});
		assert.deepEqual(parseWorkerMessage({ type: GET_VERSION, extra: 1 }), {
			type: GET_VERSION,
		});
	});

	it("ignores anything else", () => {
		for (const data of [
			null,
			undefined,
			"SKIP_WAITING",
			42,
			{},
			{ type: "skip" },
		]) {
			assert.equal(parseWorkerMessage(data), null);
		}
	});
});

describe("safeNotificationPath", () => {
	it("keeps paths on this site", () => {
		assert.equal(safeNotificationPath("/lab/web-push"), "/lab/web-push");
		assert.equal(safeNotificationPath("/a?b=1#c"), "/a?b=1#c");
	});

	it("turns anything that could leave the site into /", () => {
		for (const url of [
			"//evil.example/x",
			"https://evil.example",
			"javascript:alert(1)",
			"lab",
			"",
			undefined,
			42,
		]) {
			assert.equal(safeNotificationPath(url), "/");
		}
	});
});

describe("notificationFromPush", () => {
	it("reads title, body and url from the payload the send route builds", () => {
		assert.deepEqual(
			notificationFromPush({
				title: "Web Push Lab",
				body: "It works",
				url: "/lab/web-push",
			}),
			{ title: "Web Push Lab", body: "It works", url: "/lab/web-push" },
		);
	});

	it("falls back to safe defaults for missing or bad fields", () => {
		assert.deepEqual(notificationFromPush(undefined), {
			title: "New notification",
			body: "",
			url: "/",
		});
		assert.deepEqual(
			notificationFromPush({
				title: "",
				body: 7,
				url: "https://evil.example",
			}),
			{
				title: "New notification",
				body: "",
				url: "/",
			},
		);
	});
});
