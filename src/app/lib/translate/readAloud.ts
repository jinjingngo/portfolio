import type { VoiceInfo } from "./speechPolicy";

/**
 * Browser side of reading aloud: a small Speaker interface over the Web
 * Speech API, and a player that reads lines in order through it.
 */

export type Utterance = {
	text: string;
	lang: string;
	/** VoiceInfo.uri of the voice to use, or null for the browser's choice. */
	voiceUri: string | null;
	rate: number;
	onStart: () => void;
	onEnd: () => void;
};

/** The speech engine the player needs; the browser's or a test fake. */
export type Speaker = {
	voices(): VoiceInfo[];
	/** Calls `listener` when the installed voices change; returns an unsubscribe. */
	onVoicesChanged(listener: () => void): () => void;
	/** Queues an utterance after any already queued. */
	speak(utterance: Utterance): void;
	/** Stops speaking and clears the queue. */
	cancel(): void;
};

/** The browser's speech engine, or null where speech isn't supported. */
export const browserSpeaker = (): Speaker | null => {
	if (typeof window === "undefined" || !("speechSynthesis" in window))
		return null;
	const synth = window.speechSynthesis;
	const installed = () => synth.getVoices();
	// Chrome can garbage-collect a queued utterance before its end event
	// fires; holding them here until they finish keeps the events coming.
	const queued = new Set<SpeechSynthesisUtterance>();
	return {
		voices: () =>
			installed().map((voice) => ({
				uri: voice.voiceURI,
				lang: voice.lang,
				name: voice.name,
				localService: voice.localService,
				default: voice.default,
			})),
		onVoicesChanged: (listener) => {
			synth.addEventListener("voiceschanged", listener);
			return () => synth.removeEventListener("voiceschanged", listener);
		},
		speak: (utterance) => {
			const spoken = new SpeechSynthesisUtterance(utterance.text);
			spoken.lang = utterance.lang;
			spoken.rate = utterance.rate;
			// By unique id: Apple reuses voice names across languages.
			const voice = installed().find(
				(v) => v.voiceURI === utterance.voiceUri,
			);
			if (voice) spoken.voice = voice;
			const finish = () => {
				queued.delete(spoken);
				utterance.onEnd();
			};
			spoken.onstart = utterance.onStart;
			spoken.onend = finish;
			spoken.onerror = finish;
			queued.add(spoken);
			synth.speak(spoken);
		},
		cancel: () => {
			synth.cancel();
			queued.clear();
		},
	};
};

export type ReadOptions = {
	lang: string;
	voiceUri: string | null;
	rate: number;
	/** The line now being read, or null when reading has finished or stopped. */
	onLine: (index: number | null) => void;
};

/**
 * Reads the given lines in order. Everything is queued at once, so a single
 * tap starts the whole sequence (iOS only allows speech from a tap). Returns
 * a stop function; events from a stopped or replaced reading are ignored.
 */
export const readLines = (
	speaker: Speaker,
	lines: readonly { index: number; text: string }[],
	options: ReadOptions,
) => {
	let active = true;
	speaker.cancel();
	lines.forEach((line, position) => {
		const isLast = position === lines.length - 1;
		speaker.speak({
			text: line.text,
			lang: options.lang,
			voiceUri: options.voiceUri,
			rate: options.rate,
			onStart: () => {
				if (active) options.onLine(line.index);
			},
			onEnd: () => {
				if (active && isLast) {
					active = false;
					options.onLine(null);
				}
			},
		});
	});
	if (lines.length === 0) options.onLine(null);
	return () => {
		if (!active) return;
		active = false;
		speaker.cancel();
		options.onLine(null);
	};
};
