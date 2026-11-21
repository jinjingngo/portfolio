import { useEffect, useState } from "react";
import { t } from "try";
import {
	type Device,
	INSTALL_HINT_DISMISSED_KEY,
	INSTALL_PROMPT_STASH,
	installHint,
} from "@/app/lib/pwa/installPolicy";
import { readDevice } from "@/app/lib/pwa/readDevice";

/** Chrome/Edge/Android's install prompt event (not in TypeScript's DOM lib). */
type BeforeInstallPromptEvent = Event & { prompt(): Promise<void> };

/** The window, with the slot `InstallPromptCatcher` stashes the event in. */
const stash = () =>
	window as unknown as Record<string, BeforeInstallPromptEvent | null>;

const readHintDismissed = () => {
	const [ok, , value] = t(() =>
		localStorage.getItem(INSTALL_HINT_DISMISSED_KEY),
	);
	return ok && value !== null;
};

const rememberHintDismissed = () => {
	const [ok, error] = t(() =>
		localStorage.setItem(INSTALL_HINT_DISMISSED_KEY, "1"),
	);
	if (!ok) console.warn("Couldn't remember the closed install hint", error);
};

/**
 * Which install action to offer (see `installHint`), `install` to open the
 * browser's install dialog, and `dismissHint` to close the iOS hint for good.
 * Offers nothing during SSR and until the browser facts are read.
 */
export const useInstallPrompt = () => {
	const [device, setDevice] = useState<Device | null>(null);
	const [hintDismissed, setHintDismissed] = useState(false);
	const [promptEvent, setPromptEvent] =
		useState<BeforeInstallPromptEvent | null>(null);

	useEffect(() => {
		setDevice(readDevice());
		setHintDismissed(readHintDismissed());
		// Fired before hydration: InstallPromptCatcher kept it.
		setPromptEvent(stash()[INSTALL_PROMPT_STASH] ?? null);
		// Fired later: the catcher has already called preventDefault.
		const onPrompt = (event: Event) =>
			setPromptEvent(event as BeforeInstallPromptEvent);
		const onInstalled = () => setPromptEvent(null);
		window.addEventListener("beforeinstallprompt", onPrompt);
		window.addEventListener("appinstalled", onInstalled);
		return () => {
			window.removeEventListener("beforeinstallprompt", onPrompt);
			window.removeEventListener("appinstalled", onInstalled);
		};
	}, []);

	const hint = device
		? installHint({
				...device,
				canPrompt: promptEvent !== null,
				hintDismissed,
			})
		: "none";

	const install = async () => {
		if (!promptEvent) return;
		// A prompt event works once; if the dialog is cancelled, the button returns on the next page load.
		stash()[INSTALL_PROMPT_STASH] = null;
		setPromptEvent(null);
		const [ok, error] = await t(promptEvent.prompt());
		if (!ok) console.warn("Couldn't open the install dialog", error);
	};

	const dismissHint = () => {
		rememberHintDismissed();
		setHintDismissed(true);
	};

	return { hint, install, dismissHint };
};
