import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { t } from "try";
import { consumeTranslateQuota } from "@/app/lib/server/translateQuota";
import {
	answerOf,
	buildModelInput,
	TRANSLATE_MODEL,
} from "@/app/lib/translate/translateModel";
import {
	checkBodySize,
	describeAiError,
	isSameOrigin,
	parseModelAnswer,
	parseTranslateRequest,
} from "@/app/lib/translate/translatePolicy";

const fail = (error: string, status: number) =>
	NextResponse.json({ ok: false, error }, { status });

/** Reads the text in a photo and translates it (see #77). */
export const POST = async (request: Request) => {
	if (!isSameOrigin(request.headers.get("origin"), request.url)) {
		return fail("Requests must come from this site.", 403);
	}

	const size = checkBodySize(request.headers.get("content-length"));
	if (!size.ok) return fail(size.error, size.status);

	const [parsed, , body] = await t(request.json<Record<string, unknown>>());
	if (!parsed || typeof body !== "object" || body === null) {
		console.error("[ERROR] Translate body is not valid JSON");
		return fail("Invalid translate payload.", 400);
	}

	const input = parseTranslateRequest(body);
	if (!input.ok) return fail(input.error, input.status);

	const quota = await consumeTranslateQuota(input.value.clientId, Date.now());
	if (!quota.ok) return fail(quota.error, quota.status);

	const { env } = await getCloudflareContext();
	const [ran, aiError, result] = await t(
		env.AI.run(
			TRANSLATE_MODEL,
			buildModelInput(input.value.image, input.value.targetLanguage),
		),
	);
	if (!ran || aiError) {
		console.error(
			"[ERROR] Workers AI translate failed",
			describeAiError(aiError),
		);
		return fail("The translation service is unavailable. Try again.", 502);
	}

	const translation = parseModelAnswer(answerOf(result));
	if (!translation.ok) {
		console.error("[ERROR] Translate answer was unreadable");
		return fail(translation.error, translation.status);
	}
	return NextResponse.json({ ok: true, ...translation.value });
};
