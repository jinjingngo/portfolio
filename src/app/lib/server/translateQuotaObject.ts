import { DurableObject } from "cloudflare:workers";
import type { Decision } from "../decision";
import { consumeQuota, type QuotaStorage } from "../translate/translateQuota";

/** Days a finished day's counters are kept before the object clears itself. */
const RETENTION_MS = 2 * 86_400_000;

/**
 * Exact translate quota for one UTC day (see quotaObjectName). Exported from
 * worker.ts; the route reaches it through the TRANSLATE_QUOTA binding.
 */
export class TranslateQuota extends DurableObject<CloudflareEnv> {
	async consume(clientId: string, nowMs: number): Promise<Decision<true>> {
		const { storage } = this.ctx;
		const port: QuotaStorage = {
			get: (key) => storage.get<number>(key),
			put: (entries) => storage.put(entries),
		};
		const decision = await consumeQuota(port, clientId, nowMs);
		if ((await storage.getAlarm()) === null) {
			await storage.setAlarm(nowMs + RETENTION_MS);
		}
		return decision;
	}

	async alarm() {
		await this.ctx.storage.deleteAll();
	}
}
