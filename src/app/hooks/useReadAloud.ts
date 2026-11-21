import { useEffect, useRef, useState } from "react";
import { t } from "try";
import {
	browserSpeaker,
	readLines,
	type Speaker,
} from "@/app/lib/translate/readAloud";
import {
	pickVoice,
	speechRate,
	type VoiceInfo,
} from "@/app/lib/translate/speechPolicy";

const SLOW_KEY = "JJ:READ_ALOUD_SLOW";
/** How long to wait for a late voice list before saying a language has no voice. */
const VOICES_WAIT_MS = 1500;

/**
 * Read-aloud state for one language: whether speech works here, the voice
 * to use, which line is playing, and the Slow toggle (remembered).
 */
export const useReadAloud = (languageCode: string | null) => {
	const speakerRef = useRef<Speaker | null>(null);
	const stopRef = useRef<(() => void) | null>(null);
	const [supported, setSupported] = useState(false);
	const [voices, setVoices] = useState<VoiceInfo[]>([]);
	/** True once the voice list has had a chance to load (Chrome loads it late). */
	const [voicesLoaded, setVoicesLoaded] = useState(false);
	const [playing, setPlaying] = useState<number | null>(null);
	const [slow, setSlowState] = useState(false);

	useEffect(() => {
		const speaker = browserSpeaker();
		speakerRef.current = speaker;
		if (!speaker) return;
		setSupported(true);
		const [ok, , saved] = t(() => localStorage.getItem(SLOW_KEY));
		setSlowState(ok && saved === "1");
		const load = () => {
			const installed = speaker.voices();
			setVoices(installed);
			if (installed.length > 0) setVoicesLoaded(true);
		};
		load();
		const unsubscribe = speaker.onVoicesChanged(() => {
			load();
			setVoicesLoaded(true);
		});
		const giveUp = setTimeout(() => setVoicesLoaded(true), VOICES_WAIT_MS);
		return () => {
			unsubscribe();
			clearTimeout(giveUp);
			stopRef.current?.();
		};
	}, []);

	const voice = pickVoice(voices, languageCode);
	const voiceUri = voice?.uri ?? null;

	// Leaving the result (retake, choose photo, error) or a change of language
	// or voice stops whatever was playing, whichever path caused it.
	useEffect(() => {
		if (!languageCode || !voiceUri) return;
		return () => {
			stopRef.current?.();
			stopRef.current = null;
		};
	}, [languageCode, voiceUri]);

	const stop = () => {
		stopRef.current?.();
		stopRef.current = null;
	};

	/** Reads the given lines in order, replacing anything already playing. */
	const play = (lines: { index: number; text: string }[]) => {
		const speaker = speakerRef.current;
		if (!speaker || !voice) return;
		stop();
		stopRef.current = readLines(speaker, lines, {
			lang: voice.lang,
			voiceUri: voice.uri,
			rate: speechRate(slow),
			onLine: setPlaying,
		});
	};

	const setSlow = (value: boolean) => {
		setSlowState(value);
		t(() => localStorage.setItem(SLOW_KEY, value ? "1" : "0"));
	};

	return {
		supported,
		/** False while voices may still be loading; don't claim "no voice" yet. */
		voicesLoaded,
		voice,
		playing,
		slow,
		setSlow,
		play,
		stop,
	};
};
