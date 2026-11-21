import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void) => {
	window.addEventListener("online", onChange);
	window.addEventListener("offline", onChange);
	return () => {
		window.removeEventListener("online", onChange);
		window.removeEventListener("offline", onChange);
	};
};

/**
 * Whether the browser thinks it's online. "Online" can still mean a bad
 * network, so features must handle failed requests anyway; this only lets
 * them explain early that they need a connection. Online during SSR.
 */
export const useOnline = () =>
	useSyncExternalStore(
		subscribe,
		() => navigator.onLine,
		() => true,
	);
