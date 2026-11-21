/** The result of a pure decision: a value, or an error with its HTTP status. */
export type Decision<T> =
	| { ok: true; value: T }
	| { ok: false; error: string; status: number };

export const accept = <T>(value: T): Decision<T> => ({ ok: true, value });

export const reject = (error: string, status: number) =>
	({ ok: false, error, status }) as const;
