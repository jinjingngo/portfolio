import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	readLines,
	type Speaker,
	type Utterance,
} from "../../src/app/lib/translate/readAloud.ts";
import {
	pickVoice,
	playAllOrder,
	SPEECH_RATES,
	speechRate,
	type VoiceInfo,
} from "../../src/app/lib/translate/speechPolicy.ts";

const voice = (
	lang: string,
	name: string,
	localService = true,
	isDefault = false,
): VoiceInfo => ({
	lang,
	name,
	localService,
	default: isDefault,
});

describe("pickVoice", () => {
	const voices = [
		voice("en-GB", "Daniel"),
		voice("en-US", "Samantha", true, true),
		voice("zh-TW", "Meijia"),
		voice("zh-CN", "Tingting"),
		voice("zh-HK", "Sinji"),
		voice("ja-JP", "Kyoko (cloud)", false),
		voice("ja-JP", "Kyoko"),
		voice("sv_SE", "Alva"),
	];

	it("prefers the usual region for an ambiguous language", () => {
		assert.equal(pickVoice(voices, "zh")?.name, "Tingting");
		assert.equal(pickVoice(voices, "en")?.name, "Samantha");
	});

	it("prefers an on-device voice, and accepts underscore tags", () => {
		assert.equal(pickVoice(voices, "ja")?.name, "Kyoko");
		assert.equal(pickVoice(voices, "sv")?.name, "Alva");
	});

	it("is null when no voice speaks the language or it is unknown", () => {
		assert.equal(pickVoice(voices, "th"), null);
		assert.equal(pickVoice(voices, null), null);
		assert.equal(pickVoice([], "en"), null);
	});

	it("falls back to any voice of the language without a preferred region", () => {
		assert.equal(
			pickVoice([voice("fi-FI", "Satu", false)], "fi")?.name,
			"Satu",
		);
	});
});

describe("speechRate and playAllOrder", () => {
	it("reads slower with Slow on", () => {
		assert.equal(speechRate(false), SPEECH_RATES.normal);
		assert.equal(speechRate(true), SPEECH_RATES.slow);
		assert.ok(SPEECH_RATES.slow < SPEECH_RATES.normal);
	});

	it("reads every non-blank line in order", () => {
		assert.deepEqual(
			playAllOrder([{ text: "a" }, { text: "  " }, { text: "c" }]),
			[0, 2],
		);
	});
});

/** A speaker that records utterances; the test plays them by hand. */
const fakeSpeaker = () => {
	const queue: Utterance[] = [];
	let cancels = 0;
	const speaker: Speaker = {
		voices: () => [],
		onVoicesChanged: () => () => {},
		speak: (utterance) => {
			queue.push(utterance);
		},
		cancel: () => {
			cancels++;
		},
	};
	return { speaker, queue, cancels: () => cancels };
};

const options = (lines: (number | null)[]) => ({
	lang: "ja-JP",
	voiceName: "Kyoko",
	rate: 0.6,
	onLine: (index: number | null) => lines.push(index),
});

describe("readLines", () => {
	it("queues every line at once with the voice and rate, cancelling what was playing", () => {
		const { speaker, queue, cancels } = fakeSpeaker();
		readLines(
			speaker,
			[
				{ index: 0, text: "取扱注意" },
				{ index: 2, text: "水濡れ厳禁" },
			],
			options([]),
		);
		assert.equal(cancels(), 1);
		assert.deepEqual(
			queue.map((u) => [u.text, u.lang, u.voiceName, u.rate]),
			[
				["取扱注意", "ja-JP", "Kyoko", 0.6],
				["水濡れ厳禁", "ja-JP", "Kyoko", 0.6],
			],
		);
	});

	it("reports the line being read, then null after the last one ends", () => {
		const { speaker, queue } = fakeSpeaker();
		const lines: (number | null)[] = [];
		readLines(
			speaker,
			[
				{ index: 0, text: "a" },
				{ index: 2, text: "c" },
			],
			options(lines),
		);
		queue[0].onStart();
		queue[0].onEnd();
		queue[1].onStart();
		queue[1].onEnd();
		assert.deepEqual(lines, [0, 2, null]);
	});

	it("stops: cancels speech, reports null once, and ignores later events", () => {
		const { speaker, queue, cancels } = fakeSpeaker();
		const lines: (number | null)[] = [];
		const stop = readLines(
			speaker,
			[
				{ index: 0, text: "a" },
				{ index: 1, text: "b" },
			],
			options(lines),
		);
		queue[0].onStart();
		stop();
		stop();
		queue[0].onEnd();
		queue[1].onStart();
		queue[1].onEnd();
		assert.deepEqual(lines, [0, null]);
		assert.equal(cancels(), 2);
	});

	it("reports null at once when there is nothing to read", () => {
		const { speaker, queue } = fakeSpeaker();
		const lines: (number | null)[] = [];
		readLines(speaker, [], options(lines));
		assert.equal(queue.length, 0);
		assert.deepEqual(lines, [null]);
	});
});
