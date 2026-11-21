import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_CLIENT_ID_LENGTH } from "../../src/app/lib/clientId.ts";
import {
	answerOf,
	buildModelInput,
	TRANSLATE_MODEL,
} from "../../src/app/lib/translate/translateModel.ts";
import {
	base64DecodedBytes,
	buildTranslatePrompt,
	checkBodySize,
	defaultTargetLanguage,
	describeAiError,
	isSameOrigin,
	isTargetLanguage,
	parseModelAnswer,
	parseTranslateRequest,
	quotaDecision,
	scaleToFit,
	TRANSLATE_LIMITS,
	translateWindowStart,
	utcDay,
} from "../../src/app/lib/translate/translatePolicy.ts";

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";

describe("defaultTargetLanguage", () => {
	it("keeps the last choice when it is still offered", () => {
		assert.equal(defaultTargetLanguage(["en-US"], "sv"), "sv");
	});

	it("uses the first offered browser language by its base code", () => {
		assert.equal(
			defaultTargetLanguage(["xx-YY", "sv-SE", "en"], null),
			"sv",
		);
		assert.equal(defaultTargetLanguage(["zh-Hans-CN"], "klingon"), "zh");
		assert.equal(defaultTargetLanguage(["nn-NO"], null), "nb");
	});

	it("falls back to English", () => {
		assert.equal(defaultTargetLanguage([], null), "en");
		assert.equal(defaultTargetLanguage(["xx"], null), "en");
	});
});

describe("parseTranslateRequest", () => {
	const valid = { clientId: "c1", image: JPEG, targetLanguage: "en" };

	it("accepts a small JPEG, PNG or WebP data URI and an offered language", () => {
		assert.deepEqual(parseTranslateRequest(valid), {
			ok: true,
			value: valid,
		});
		for (const type of ["png", "webp"]) {
			const image = JPEG.replace("jpeg", type);
			assert.equal(parseTranslateRequest({ ...valid, image }).ok, true);
		}
	});

	it("rejects missing fields, other formats and unknown languages with 400", () => {
		for (const input of [
			{ ...valid, clientId: "" },
			{
				...valid,
				clientId: "x".repeat(MAX_CLIENT_ID_LENGTH + 1),
			},
			{ ...valid, targetLanguage: "xx" },
			{ ...valid, image: undefined },
			{ ...valid, image: "data:image/gif;base64,R0lGOD==" },
			{ ...valid, image: "https://example.com/a.jpg" },
			{ ...valid, image: "data:image/jpeg;base64,not base64!" },
		]) {
			const decision = parseTranslateRequest(input);
			assert.equal(decision.ok, false);
			assert.equal(!decision.ok && decision.status, 400);
		}
	});

	it("rejects an image over the size limit with 413", () => {
		const bytes = TRANSLATE_LIMITS.maxImageBytes + 3;
		const image = `data:image/jpeg;base64,${"A".repeat((bytes / 3) * 4)}`;
		const decision = parseTranslateRequest({ ...valid, image });
		assert.equal(!decision.ok && decision.status, 413);
	});
});

describe("base64DecodedBytes", () => {
	it("counts decoded bytes, including padding", () => {
		assert.equal(
			base64DecodedBytes(Buffer.from("abc").toString("base64")),
			3,
		);
		assert.equal(
			base64DecodedBytes(Buffer.from("abcd").toString("base64")),
			4,
		);
		assert.equal(
			base64DecodedBytes(Buffer.from("abcde").toString("base64")),
			5,
		);
	});
});

describe("buildTranslatePrompt", () => {
	it("names the target code and asks for JSON only", () => {
		const prompt = buildTranslatePrompt("sv");
		assert.match(prompt, /ISO 639-1 code "sv"/);
		assert.match(prompt, /JSON only/);
		assert.match(prompt, /prices/);
	});
});

describe("parseModelAnswer", () => {
	it("reads a JSON answer (real Mistral output from the spike)", () => {
		const answer = JSON.stringify({
			sourceLanguage: "zh",
			blocks: [
				{ text: "今日菜单", translation: "Today's Menu" },
				{ text: "宫保鸡丁 ¥38", translation: "Kung Pao Chicken ¥38" },
			],
		});
		assert.deepEqual(parseModelAnswer(answer), {
			ok: true,
			value: {
				sourceLanguage: "zh",
				blocks: [
					{ text: "今日菜单", translation: "Today's Menu" },
					{
						text: "宫保鸡丁 ¥38",
						translation: "Kung Pao Chicken ¥38",
					},
				],
			},
		});
	});

	it("accepts an answer the runtime already parsed into an object", () => {
		const answer = {
			sourceLanguage: "SV",
			blocks: [{ text: "Utgång", translation: "Exit" }],
		};
		assert.deepEqual(parseModelAnswer(answer), {
			ok: true,
			value: {
				sourceLanguage: "sv",
				blocks: [{ text: "Utgång", translation: "Exit" }],
			},
		});
	});

	it("ignores code fences and prose around the JSON", () => {
		const answer =
			'Sure!\n```json\n{"sourceLanguage":"ja","blocks":[{"text":"取扱注意","translation":"Handle with care"}]}\n```';
		const decision = parseModelAnswer(answer);
		assert.equal(decision.ok && decision.value.blocks.length, 1);
	});

	it("drops malformed blocks (real Llama output from the spike)", () => {
		const answer = {
			sourceLanguage: "ja",
			blocks: [
				{ text: "取扱注意", translation: "Handling Precautions" },
				'{"text":"この面を上にして下さい',
				{ text: "水濡れ厳禁", translation: 42 },
				{ text: "  ", translation: "blank" },
			],
		};
		const decision = parseModelAnswer(answer);
		assert.deepEqual(decision.ok && decision.value.blocks, [
			{ text: "取扱注意", translation: "Handling Precautions" },
		]);
	});

	it("caps and clips blocks, and keeps the language only when text was found", () => {
		const long = "x".repeat(TRANSLATE_LIMITS.maxBlockLength + 50);
		const blocks = Array.from(
			{ length: TRANSLATE_LIMITS.maxBlocks + 5 },
			() => ({
				text: long,
				translation: long,
			}),
		);
		const decision = parseModelAnswer({ sourceLanguage: "en", blocks });
		assert.equal(
			decision.ok && decision.value.blocks.length,
			TRANSLATE_LIMITS.maxBlocks,
		);
		assert.equal(
			decision.ok && decision.value.blocks[0].text.length,
			TRANSLATE_LIMITS.maxBlockLength,
		);
		assert.deepEqual(
			parseModelAnswer({ sourceLanguage: "en", blocks: [] }),
			{
				ok: true,
				value: { sourceLanguage: null, blocks: [] },
			},
		);
	});

	it("rejects a language that isn't an ISO 639-1 code", () => {
		const decision = parseModelAnswer({
			sourceLanguage: "Swedish<script>",
			blocks: [{ text: "Utgång", translation: "Exit" }],
		});
		assert.equal(decision.ok && decision.value.sourceLanguage, null);
	});

	it("fails with 502 on unreadable answers", () => {
		for (const answer of [
			null,
			undefined,
			42,
			"no json here",
			"{broken",
			["a"],
		]) {
			const decision = parseModelAnswer(answer);
			assert.equal(!decision.ok && decision.status, 502);
		}
	});
});

describe("quotaDecision", () => {
	it("allows below both limits", () => {
		assert.equal(quotaDecision({ client: 0, day: 0 }).ok, true);
	});

	it("blocks on the daily cap first, then the client window", () => {
		const day = quotaDecision({
			client: 0,
			day: TRANSLATE_LIMITS.dailyCap,
		});
		assert.match(!day.ok ? day.error : "", /Daily limit/);
		const client = quotaDecision({
			client: TRANSLATE_LIMITS.translationsPerWindow,
			day: 0,
		});
		assert.match(!client.ok ? client.error : "", /Try again in a minute/);
	});
});

describe("time keys", () => {
	it("uses the UTC day and the start of the rate window", () => {
		const nowMs = Date.UTC(2026, 10, 21, 23, 59, 30);
		assert.equal(utcDay(nowMs), "2026-11-21");
		assert.equal(
			translateWindowStart(nowMs),
			Date.UTC(2026, 10, 21, 23, 59, 0),
		);
	});
});

describe("isTargetLanguage", () => {
	it("accepts offered codes only", () => {
		assert.equal(isTargetLanguage("ja"), true);
		assert.equal(isTargetLanguage("JA"), false);
		assert.equal(isTargetLanguage(undefined), false);
	});
});

describe("translateModel", () => {
	it("sends the prompt and the image as one user message", () => {
		const input = buildModelInput(JPEG, "en");
		assert.equal(
			TRANSLATE_MODEL,
			"@cf/mistralai/mistral-small-3.1-24b-instruct",
		);
		assert.equal(input.messages[0].content[1].image_url?.url, JPEG);
		assert.match(input.messages[0].content[0].text ?? "", /JSON only/);
		assert.equal(input.max_tokens, TRANSLATE_LIMITS.maxOutputTokens);
	});

	it("reads the response field, whatever its type", () => {
		assert.equal(answerOf({ response: "x" }), "x");
		assert.deepEqual(answerOf({ response: { a: 1 } }), { a: 1 });
		assert.equal(answerOf(null), null);
		assert.equal(answerOf({}), null);
	});
});

describe("isSameOrigin", () => {
	const url = "https://wujinjing.com/api/translate/image";

	it("accepts only this site's origin", () => {
		assert.equal(isSameOrigin("https://wujinjing.com", url), true);
		assert.equal(isSameOrigin("https://evil.example", url), false);
		assert.equal(isSameOrigin("http://wujinjing.com", url), false);
		assert.equal(isSameOrigin(null, url), false);
	});
});

describe("describeAiError", () => {
	it("never includes image data and caps the length", () => {
		const text = describeAiError(
			new Error(
				`bad input "data:image/jpeg;base64,${"A".repeat(5000)}" rejected`,
			),
		);
		assert.equal(text.includes("base64"), false);
		assert.match(text, /<image>/);
		assert.ok(describeAiError("x".repeat(1000)).length <= 300);
	});
});

describe("scaleToFit", () => {
	it("shrinks the long edge to the limit and keeps the aspect ratio", () => {
		assert.deepEqual(scaleToFit(4032, 3024), { width: 1280, height: 960 });
		assert.deepEqual(scaleToFit(3024, 4032), { width: 960, height: 1280 });
	});

	it("never scales up and never returns zero", () => {
		assert.deepEqual(scaleToFit(640, 480), { width: 640, height: 480 });
		assert.deepEqual(scaleToFit(0, 0), { width: 1, height: 1 });
	});
});

describe("checkBodySize", () => {
	it("accepts a declared size up to the limit", () => {
		assert.equal(checkBodySize("1024").ok, true);
		assert.equal(
			checkBodySize(String(TRANSLATE_LIMITS.maxBodyBytes)).ok,
			true,
		);
	});

	it("refuses missing, invalid and oversized bodies before reading them", () => {
		const status = (value: string | null) => {
			const decision = checkBodySize(value);
			return decision.ok ? 200 : decision.status;
		};
		assert.equal(status(null), 411);
		assert.equal(status("abc"), 400);
		assert.equal(status("-1"), 400);
		assert.equal(status(""), 400);
		assert.equal(status("1e3"), 400);
		assert.equal(status("0x10"), 400);
		assert.equal(status(String(TRANSLATE_LIMITS.maxBodyBytes + 1)), 413);
		assert.equal(status("90000000"), 413);
	});
});

describe("request size limits agree", () => {
	it("a body with the largest valid image passes the body-size check", () => {
		const payload = "A".repeat(
			Math.ceil(TRANSLATE_LIMITS.maxImageBytes / 3) * 4,
		);
		const body = JSON.stringify({
			clientId: "c".repeat(128),
			targetLanguage: "en",
			image: `data:image/jpeg;base64,${payload}`,
		});
		assert.equal(
			base64DecodedBytes(payload) >= TRANSLATE_LIMITS.maxImageBytes,
			true,
		);
		assert.equal(checkBodySize(String(Buffer.byteLength(body))).ok, true);
	});
});
