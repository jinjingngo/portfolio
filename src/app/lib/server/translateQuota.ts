import { getCloudflareContext } from "@opennextjs/cloudflare";
import { t } from "try";
import { type Decision, reject } from "../decision";
import { quotaObjectName } from "../translate/translateQuota";

/**
 * Asks today's TranslateQuota Durable Object for one translation. `next dev`
 * can't run Durable Objects (they live in worker.ts), so there the call fails
 * and the API says so; `pnpm preview` runs the full Worker.
 */
export const consumeTranslateQuota = async (
	clientId: string,
	nowMs: number,
): Promise<Decision<true>> => {
	// Built inside t() so a synchronous throw (e.g. a missing binding) is caught too.
	const [ok, error, decision] = await t(async () => {
		const { env } = await getCloudflareContext();
		const namespace = env.TRANSLATE_QUOTA;
		const stub = namespace.get(
			namespace.idFromName(quotaObjectName(nowMs)),
		);
		return stub.consume(clientId, nowMs);
	});
	if (!ok) {
		console.error(
			"[ERROR] Translate quota unavailable (next dev can't run Durable Objects; use pnpm preview)",
			String(error).slice(0, 200),
		);
		return reject("Camera translate is unavailable right now.", 503);
	}
	return decision;
};
