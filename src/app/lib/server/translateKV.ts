import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Decision } from "../decision";
import {
	quotaDecision,
	TRANSLATE_LIMITS,
	translateWindowStart,
	utcDay,
} from "../translate/translatePolicy";

const SECONDS_PER_DAY = 86_400;

/**
 * Counts one translation against the per-client window and the site-wide
 * daily cap, or refuses it. Uses the site's KV namespace (bound as
 * PUSH_SUBSCRIPTIONS) under a TRANSLATE: prefix. KV is eventually
 * consistent, so the caps are approximate, which is fine for a demo.
 */
export const consumeTranslateQuota = async (
	clientId: string,
	nowMs: number,
): Promise<Decision<true>> => {
	const { env } = await getCloudflareContext();
	const kv = env.PUSH_SUBSCRIPTIONS;
	const clientKey = `TRANSLATE:RATE:${clientId}:${translateWindowStart(nowMs)}`;
	const dayKey = `TRANSLATE:DAY:${utcDay(nowMs)}`;

	const [client, day] = (
		await Promise.all([kv.get(clientKey), kv.get(dayKey)])
	).map((count) => Number(count ?? 0) || 0);
	const decision = quotaDecision({ client, day });
	if (!decision.ok) return decision;

	await Promise.all([
		kv.put(clientKey, String(client + 1), {
			expirationTtl: TRANSLATE_LIMITS.windowSeconds * 2,
		}),
		kv.put(dayKey, String(day + 1), { expirationTtl: SECONDS_PER_DAY * 2 }),
	]);
	return decision;
};
