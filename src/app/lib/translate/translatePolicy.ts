import { t } from "try";
import { isValidClientId } from "../clientId";
import { accept, type Decision, reject } from "../decision";

/**
 * Pure rules for camera translation: what a request may contain, what the
 * model is asked, and what of its answer is trusted. No I/O, no clock.
 */

/** Decoded image bytes accepted by the API. */
const MAX_IMAGE_BYTES = 1_500_000;

/** Translation limits; the one place these numbers live. */
export const TRANSLATE_LIMITS = Object.freeze({
	maxImageBytes: MAX_IMAGE_BYTES,
	/** Request body bytes: the base64 image plus room for the other fields. */
	maxBodyBytes: Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 16_384,
	/** Long edge the browser scales a photo down to before upload. */
	maxImageEdge: 1280,
	/** JPEG quality for the upload (0–1). */
	jpegQuality: 0.8,
	/** Translations per client per rate window. */
	translationsPerWindow: 6,
	/** Rate-limit window in seconds (KV's minimum TTL is 60s). */
	windowSeconds: 60,
	/** Translations per UTC day for the whole site, under the free allowance. */
	dailyCap: 150,
	/** Text blocks kept from one answer. */
	maxBlocks: 40,
	/** Characters kept per original or translated block. */
	maxBlockLength: 500,
	/** Output tokens the model may use. */
	maxOutputTokens: 1200,
});

/** Target languages offered, as ISO 639-1 codes. */
export const TARGET_LANGUAGES = Object.freeze([
	"en",
	"sv",
	"zh",
	"ja",
	"ko",
	"de",
	"fr",
	"es",
	"it",
	"pt",
	"nl",
	"da",
	"nb",
	"fi",
	"pl",
	"ru",
	"uk",
	"ar",
	"hi",
	"th",
	"vi",
] as const);

export type TargetLanguage = (typeof TARGET_LANGUAGES)[number];

export const isTargetLanguage = (code: unknown): code is TargetLanguage =>
	typeof code === "string" &&
	(TARGET_LANGUAGES as readonly string[]).includes(code);

/**
 * The target language to preselect: the last choice if still offered,
 * otherwise the first browser language we offer (by its base code, so
 * "sv-SE" picks "sv" and "no"/"nn" pick "nb"), otherwise English.
 */
export const defaultTargetLanguage = (
	browserLanguages: readonly string[],
	lastChoice: string | null,
): TargetLanguage => {
	if (isTargetLanguage(lastChoice)) return lastChoice;
	for (const tag of browserLanguages) {
		const base = tag.toLowerCase().split("-")[0];
		const code = base === "no" || base === "nn" ? "nb" : base;
		if (isTargetLanguage(code)) return code;
	}
	return "en";
};

/**
 * Size to draw a photo at before upload: scaled down so its long edge is at
 * most `maxEdge`, never scaled up, whole pixels.
 */
export const scaleToFit = (
	width: number,
	height: number,
	maxEdge: number = TRANSLATE_LIMITS.maxImageEdge,
) => {
	const scale = Math.min(1, maxEdge / Math.max(width, height, 1));
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale)),
	};
};

export type TranslateRequest = {
	clientId: string;
	/** A JPEG, PNG or WebP image as a base64 data URI. */
	image: string;
	targetLanguage: TargetLanguage;
};

const IMAGE_DATA_URI =
	/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

/** Bytes a base64 payload decodes to. */
export const base64DecodedBytes = (payload: string) =>
	Math.floor((payload.length * 3) / 4) -
	(payload.match(/=+$/)?.[0].length ?? 0);

/**
 * Checks the declared body size before the body is read, so an oversized
 * request is refused without parsing it.
 */
export const checkBodySize = (contentLength: string | null): Decision<true> => {
	if (contentLength === null)
		return reject("Content-Length is required.", 411);
	if (!/^\d+$/.test(contentLength))
		return reject("Invalid Content-Length.", 400);
	const bytes = Number(contentLength);
	if (bytes > TRANSLATE_LIMITS.maxBodyBytes) {
		return reject("The image is too large.", 413);
	}
	return accept(true);
};

/** Validates a translate request body. */
export const parseTranslateRequest = (input: {
	clientId?: unknown;
	image?: unknown;
	targetLanguage?: unknown;
}): Decision<TranslateRequest> => {
	const { clientId, image, targetLanguage } = input;
	if (!isValidClientId(clientId)) return reject("Missing clientId.", 400);
	if (!isTargetLanguage(targetLanguage)) {
		return reject("Unsupported target language.", 400);
	}
	if (typeof image !== "string") return reject("Missing image.", 400);

	const match = IMAGE_DATA_URI.exec(image);
	if (!match) return reject("The image must be a JPEG, PNG or WebP.", 400);
	if (base64DecodedBytes(match[2]) > TRANSLATE_LIMITS.maxImageBytes) {
		return reject("The image is too large.", 413);
	}
	return accept({ clientId, image, targetLanguage });
};

/** The instruction for the vision model: read, detect, translate, answer JSON. */
export const buildTranslatePrompt = (targetLanguage: TargetLanguage) =>
	[
		"Read all text in this image, line by line, top to bottom.",
		"Detect the language of the text as an ISO 639-1 code.",
		`Translate each line into the language with ISO 639-1 code "${targetLanguage}".`,
		"Keep numbers, prices, units and symbols exactly as written, in both text and translation.",
		"Reply with JSON only, no prose and no code fences:",
		'{"sourceLanguage":"<code>","blocks":[{"text":"<original line>","translation":"<translated line>"}]}',
		'If there is no readable text, reply {"sourceLanguage":null,"blocks":[]}.',
	].join("\n");

export type TranslatedBlock = { text: string; translation: string };

export type Translation = {
	/** ISO 639-1 code of the detected language, or null when no text was found. */
	sourceLanguage: string | null;
	blocks: TranslatedBlock[];
};

const clip = (text: string) =>
	text.trim().slice(0, TRANSLATE_LIMITS.maxBlockLength);

/** The JSON object in a model answer, ignoring code fences or prose around it. */
const parseJsonObject = (answer: string): unknown => {
	const start = answer.indexOf("{");
	const end = answer.lastIndexOf("}");
	if (start === -1 || end < start) return null;
	const [ok, , parsed] = t((): unknown =>
		JSON.parse(answer.slice(start, end + 1)),
	);
	return ok ? parsed : null;
};

/**
 * Parses the model's answer: JSON text, or an object when the runtime has
 * already parsed it. Model output is untrusted: only well-formed
 * blocks of strings are kept, clipped and capped, and the language code is
 * accepted only if it looks like an ISO 639-1 code.
 */
export const parseModelAnswer = (answer: unknown): Decision<Translation> => {
	const parsed =
		typeof answer === "string" ? parseJsonObject(answer) : answer;
	if (
		typeof parsed !== "object" ||
		parsed === null ||
		Array.isArray(parsed)
	) {
		return reject(
			"The translation service returned an unreadable answer.",
			502,
		);
	}

	const { sourceLanguage, blocks } = parsed as {
		sourceLanguage?: unknown;
		blocks?: unknown;
	};
	const kept = (Array.isArray(blocks) ? blocks : [])
		.filter(
			(block): block is TranslatedBlock =>
				typeof block?.text === "string" &&
				typeof block?.translation === "string" &&
				block.text.trim() !== "",
		)
		.slice(0, TRANSLATE_LIMITS.maxBlocks)
		.map((block) => ({
			text: clip(block.text),
			translation: clip(block.translation),
		}));

	const code =
		typeof sourceLanguage === "string" &&
		/^[a-z]{2}$/.test(sourceLanguage.toLowerCase())
			? sourceLanguage.toLowerCase()
			: null;
	return accept({ sourceLanguage: kept.length ? code : null, blocks: kept });
};

/**
 * True when a browser request comes from this site. Browsers send Origin on
 * POST; a missing or different origin is refused so other sites can't spend
 * the translation allowance.
 */
export const isSameOrigin = (originHeader: string | null, requestUrl: string) =>
	originHeader !== null && originHeader === new URL(requestUrl).origin;

/** An AI error as text safe to log: no image data, length-capped. */
export const describeAiError = (error: unknown) =>
	String(error)
		.replace(/data:[^\s"']+/g, "<image>")
		.slice(0, 300);

/**
 * Whether picking a new target language should translate the current photo
 * again: only when there is a photo whose last attempt (shown or failed) was
 * not already in that language, and nothing is in progress.
 */
export const shouldRetranslate = (state: {
	hasPhoto: boolean;
	settled: boolean;
	lastTarget: TargetLanguage | null;
	nextTarget: TargetLanguage;
}) => state.hasPhoto && state.settled && state.lastTarget !== state.nextTarget;

/** UTC day (YYYY-MM-DD) for the site-wide daily cap. */
export const utcDay = (nowMs: number) =>
	new Date(nowMs).toISOString().slice(0, 10);

/** Start (epoch ms) of the fixed per-client rate window containing `nowMs`. */
export const translateWindowStart = (nowMs: number) => {
	const windowMs = TRANSLATE_LIMITS.windowSeconds * 1000;
	return Math.floor(nowMs / windowMs) * windowMs;
};

/** Which limit, if any, blocks one more translation. */
export const quotaDecision = (counts: {
	client: number;
	day: number;
}): Decision<true> => {
	if (counts.day >= TRANSLATE_LIMITS.dailyCap) {
		return reject("Daily limit reached. Try again tomorrow.", 429);
	}
	if (counts.client >= TRANSLATE_LIMITS.translationsPerWindow) {
		return reject("Too many translations. Try again in a minute.", 429);
	}
	return accept(true);
};
