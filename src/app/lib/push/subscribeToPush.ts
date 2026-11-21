import { requestWithTokenRetry } from "./tokenRetry";

const urlBase64ToUint8Array = (base64String: string) => {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding)
		.replace(/-/g, "+")
		.replace(/_/g, "/");
	const rawData = atob(base64);

	return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

const SEND_TOKEN_STORAGE_KEY = "JJ:WEB_PUSH_SEND_TOKEN";

const readSendToken = () => {
	try {
		return localStorage.getItem(SEND_TOKEN_STORAGE_KEY);
	} catch {
		return null;
	}
};

const writeSendToken = (token: string | null) => {
	try {
		if (token) localStorage.setItem(SEND_TOKEN_STORAGE_KEY, token);
		else localStorage.removeItem(SEND_TOKEN_STORAGE_KEY);
	} catch (error) {
		console.error("Unable to store push send token", error);
	}
};

const savePushSubscription = async (
	clientId: string,
	subscription: PushSubscription,
) => {
	const response = await fetch("/api/push/subscribe", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			clientId,
			subscription: subscription.toJSON(),
			token: readSendToken() ?? undefined,
		}),
	});

	if (!response.ok) throw new Error("Failed to save push subscription.");

	const { token } = await response.json<{ token?: string }>();
	if (!token) throw new Error("Failed to save push subscription.");
	writeSendToken(token);
	return token;
};

// TODO: iOS Notification and ServiceWorker check need to be investigated further
export const subscribeToPush = async (clientId: string) => {
	if (typeof window === "undefined") {
		throw new Error("Push subscription is only available in the browser.");
	}

	if (!("Notification" in window)) {
		throw new Error("Push notifications are not supported.");
	}
	if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
		throw new Error(
			"Push notifications are not supported in this browser.",
		);
	}

	const permission = await Notification.requestPermission();

	if (permission !== "granted") {
		throw new Error("Notification permission was not granted.");
	}

	const registration = await navigator.serviceWorker.register(
		"/webPushServiceWorker.js",
	);

	const existingSubscription =
		await registration.pushManager.getSubscription();
	if (existingSubscription) {
		await savePushSubscription(clientId, existingSubscription);
		return existingSubscription;
	}

	const publicKeyResponse = await fetch("/api/push/public_key");
	if (!publicKeyResponse.ok) {
		throw new Error("Unable to load the push notification key.");
	}
	const { publicKey } = await publicKeyResponse.json<{ publicKey: string }>();
	if (!publicKey)
		throw new Error("The push notification key is unavailable.");

	const subscription = await registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: urlBase64ToUint8Array(publicKey),
	});

	await savePushSubscription(clientId, subscription);

	return subscription;
};

export const getPushSubscription = async () => {
	if (!("serviceWorker" in navigator)) return null;
	const registration = await navigator.serviceWorker.getRegistration();
	return registration?.pushManager.getSubscription() ?? null;
};

/**
 * Returns this browser's send token. Browsers that subscribed before tokens
 * existed get one by re-saving their current subscription.
 */
const getSendToken = async (clientId: string) => {
	const token = readSendToken();
	if (token) return token;
	const subscription = await getPushSubscription();
	if (!subscription) return null;
	return savePushSubscription(clientId, subscription);
};

/**
 * Replaces a token the server rejected: drops it and re-saves this browser's
 * subscription, which the server accepts by its push endpoint. Null when there
 * is no subscription to re-save or the save fails.
 */
const refreshSendToken = async (clientId: string) => {
	const subscription = await getPushSubscription();
	if (!subscription) return null;
	writeSendToken(null);
	try {
		return await savePushSubscription(clientId, subscription);
	} catch (error) {
		console.error("Unable to refresh push send token", error);
		return null;
	}
};

export type TestNotification = {
	title: string;
	message: string;
	/** A path on this site, e.g. "/lab/web-push". */
	url: string;
};

export const sendPushNotification = async (
	clientId: string,
	notification: TestNotification,
) => {
	const token = await getSendToken(clientId);
	if (!token) throw new Error("Enable notifications first.");

	const response = await requestWithTokenRetry(
		token,
		(currentToken) =>
			fetch("/api/push/send", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					clientId,
					token: currentToken,
					...notification,
				}),
			}),
		() => refreshSendToken(clientId),
	);

	if (response.status === 429) {
		throw new Error("Too many notifications. Try again in a minute.");
	}
	if (!response.ok) {
		throw new Error("The test notification could not be sent.");
	}
};

export const unsubscribeFromPush = async (clientId: string) => {
	const subscription = await getPushSubscription();
	const token = await getSendToken(clientId);
	const unsubscribe = (currentToken: string | null) =>
		fetch("/api/push/unsubscribe", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ clientId, token: currentToken }),
		});
	const response = token
		? await requestWithTokenRetry(token, unsubscribe, () =>
				refreshSendToken(clientId),
			)
		: await unsubscribe(null);
	if (!response.ok) throw new Error("Failed to remove push subscription.");
	writeSendToken(null);
	if (subscription) await subscription.unsubscribe();
};
