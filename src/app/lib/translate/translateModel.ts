import {
	buildTranslatePrompt,
	type TargetLanguage,
	TRANSLATE_LIMITS,
} from "./translatePolicy";

/**
 * The Workers AI model that reads and translates the photo, and how to talk
 * to it. Chosen in the #77 spike: accurate on Latin, CJK and blurry photos,
 * 1.5–4 s, about 40 neurons per photo. Swap the model here only.
 */
export const TRANSLATE_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";

/** Workers AI input: one user message with the instruction and the image. */
export const buildModelInput = (
	image: string,
	targetLanguage: TargetLanguage,
) => ({
	messages: [
		{
			role: "user",
			content: [
				{ type: "text", text: buildTranslatePrompt(targetLanguage) },
				{ type: "image_url", image_url: { url: image } },
			],
		},
	],
	max_tokens: TRANSLATE_LIMITS.maxOutputTokens,
});

/** The answer inside a Workers AI result (text, or an already-parsed object). */
export const answerOf = (result: unknown): unknown =>
	typeof result === "object" && result !== null && "response" in result
		? result.response
		: null;
