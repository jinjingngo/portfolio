/**
 * Pure rules for reading the original text aloud: which installed voice to
 * use for a language, how fast, and which lines to read. No speech APIs here.
 */

/** What the core needs to know about an installed voice. */
export type VoiceInfo = {
	/** BCP 47 tag, e.g. "ja-JP" (some browsers use "ja_JP"). */
	lang: string;
	name: string;
	/** On-device voice (works offline, starts faster). */
	localService: boolean;
	default?: boolean;
};

/** Speech rates; the one place these numbers live. */
export const SPEECH_RATES = Object.freeze({ normal: 1, slow: 0.6 });

/**
 * Preferred region when a language code is ambiguous, e.g. a menu detected as
 * "zh" is read with a Mainland voice before Taiwan or Hong Kong ones.
 */
const PREFERRED_REGION: Readonly<Record<string, string>> = Object.freeze({
	zh: "zh-cn",
	en: "en-us",
	pt: "pt-br",
	es: "es-es",
	fr: "fr-fr",
	de: "de-de",
	sv: "sv-se",
	ja: "ja-jp",
	ko: "ko-kr",
});

const normalizeTag = (lang: string) => lang.toLowerCase().replace(/_/g, "-");
const baseOf = (lang: string) => normalizeTag(lang).split("-")[0];

/**
 * The voice to read a language with, or null when none is installed. Among
 * voices for that language, prefers the usual region, then on-device voices,
 * then the browser's default voice.
 */
export const pickVoice = (
	voices: readonly VoiceInfo[],
	languageCode: string | null,
): VoiceInfo | null => {
	if (!languageCode) return null;
	const code = languageCode.toLowerCase();
	const matching = voices.filter((voice) => baseOf(voice.lang) === code);
	if (matching.length === 0) return null;

	const region = PREFERRED_REGION[code];
	const score = (voice: VoiceInfo) =>
		(region && normalizeTag(voice.lang) === region ? 4 : 0) +
		(voice.localService ? 2 : 0) +
		(voice.default ? 1 : 0);
	return matching.reduce((best, voice) =>
		score(voice) > score(best) ? voice : best,
	);
};

/** Speech rate for the Slow toggle. */
export const speechRate = (slow: boolean) =>
	slow ? SPEECH_RATES.slow : SPEECH_RATES.normal;

/** Indices of the lines "Play all" reads, in order (skipping blank ones). */
export const playAllOrder = (lines: readonly { text: string }[]) =>
	lines.flatMap((line, index) => (line.text.trim() ? [index] : []));
