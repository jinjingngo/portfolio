import type { Decision } from "../decision";
import { quotaDecision, translateWindowStart, utcDay } from "./translatePolicy";

/** The storage a quota counter needs: numbers by key. */
export type QuotaStorage = {
	get(key: string): Promise<number | undefined>;
	put(entries: Record<string, number>): Promise<void>;
};

const DAY_KEY = "day";

/** Name of the Durable Object instance that counts one UTC day. */
export const quotaObjectName = (nowMs: number) =>
	`translate-quota:${utcDay(nowMs)}`;

/**
 * Counts one translation against the site's daily cap and the client's rate
 * window, or refuses it. Read, decide, write: run inside one Durable Object
 * per day, which handles one request at a time, so the caps are exact.
 */
export const consumeQuota = async (
	storage: QuotaStorage,
	clientId: string,
	nowMs: number,
): Promise<Decision<true>> => {
	const clientKey = `client:${clientId}:${translateWindowStart(nowMs)}`;
	const day = (await storage.get(DAY_KEY)) ?? 0;
	const client = (await storage.get(clientKey)) ?? 0;

	const decision = quotaDecision({ day, client });
	if (!decision.ok) return decision;

	await storage.put({ [DAY_KEY]: day + 1, [clientKey]: client + 1 });
	return decision;
};
