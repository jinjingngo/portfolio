import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	classifySendStatus,
	isSameSubscription,
	type PushEnvironment,
	pushUnavailableReason,
} from "../../src/app/lib/push/pushClientPolicy.ts";

describe("classifySendStatus", () => {
	it("maps send statuses to what the browser does", () => {
		assert.equal(classifySendStatus(201), "sent");
		assert.equal(classifySendStatus(429), "throttled");
		assert.equal(classifySendStatus(410), "expired");
		for (const status of [400, 401, 500, 502]) {
			assert.equal(classifySendStatus(status), "failed");
		}
	});
});

describe("pushUnavailableReason", () => {
	const supported: PushEnvironment = {
		hasNotification: true,
		hasServiceWorker: true,
		hasPushManager: true,
		isAppleMobile: false,
		isStandalone: false,
	};
	const iosTab: PushEnvironment = {
		hasNotification: false,
		hasServiceWorker: true,
		hasPushManager: false,
		isAppleMobile: true,
		isStandalone: false,
	};

	it("is null when push is available, including an iOS Home Screen app", () => {
		assert.equal(pushUnavailableReason(supported), null);
		assert.equal(
			pushUnavailableReason({
				...supported,
				isAppleMobile: true,
				isStandalone: true,
			}),
			null,
		);
	});

	it("tells iPhone and iPad tabs to add the site to the Home Screen", () => {
		assert.match(pushUnavailableReason(iosTab) ?? "", /Home Screen/);
	});

	it("says not supported elsewhere, including an old iOS Home Screen app", () => {
		const desktop = { ...supported, hasPushManager: false };
		assert.equal(
			pushUnavailableReason(desktop),
			"Push notifications are not supported in this browser.",
		);
		assert.equal(
			pushUnavailableReason({ ...iosTab, isStandalone: true }),
			"Push notifications are not supported in this browser.",
		);
	});
});

describe("isSameSubscription", () => {
	it("is true only for the same, known endpoint", () => {
		assert.equal(isSameSubscription("https://p/a", "https://p/a"), true);
		assert.equal(isSameSubscription("https://p/a", "https://p/b"), false);
		assert.equal(isSameSubscription(null, "https://p/a"), false);
		assert.equal(isSameSubscription(null, null), false);
	});
});
