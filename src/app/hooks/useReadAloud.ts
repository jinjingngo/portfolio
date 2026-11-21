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

/**
 * Read-aloud state for one language: whether speech works here, the voice
 * to use, which line is playing, and the Slow toggle (remembered).
 */
export const useReadAloud = (languageCode: string | null) => {
	const speakerRef = useRef<Speaker | null>(null);
	const stopRef = useRef<(() => void) | null>(null);
	const [supported, setSupported] = useState(false);
	const [voices, setVoices] = useState<VoiceInfo[]>([]);
	const [playing, setPlaying] = useState<number | null>(null);
	const [slow, setSlowState] = useState(false);

	useEffect(() => {
		const speaker = browserSpeaker();
		speakerRef.current = speaker;
		if (!speaker) return;
		setSupported(true);
		const [ok, , saved] = t(() => localStorage.getItem(SLOW_KEY));
		setSlowState(ok && saved === "1");
		const load = () => setVoices(speaker.voices());
		load();
		const unsubscribe = speaker.onVoicesChanged(load);
		return () => {
			unsubscribe();
			stopRef.current?.();
		};
	}, []);

	const voice = pickVoice(voices, languageCode);

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
			voiceName: voice.name,
			rate: speechRate(slow),
			onLine: setPlaying,
		});
	};

	const setSlow = (value: boolean) => {
		setSlowState(value);
		t(() => localStorage.setItem(SLOW_KEY, value ? "1" : "0"));
	};

	return { supported, voice, playing, slow, setSlow, play, stop };
};
