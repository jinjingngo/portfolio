import { useEffect, useState } from "react";
import { t } from "try";
import {
	isShareCancelled,
	type ShareMethod,
	shareMethodFor,
} from "@/app/lib/translate/shareTranslation";

/**
 * Shares text through the system share sheet, or copies it where there is
 * none. `method` is null (offer nothing) during SSR and where neither exists.
 */
export const useShareText = () => {
	const [method, setMethod] = useState<ShareMethod>(null);
	const [note, setNote] = useState("");

	useEffect(() => {
		setMethod(
			shareMethodFor({
				canShare: typeof navigator.share === "function",
				canCopy: typeof navigator.clipboard?.writeText === "function",
			}),
		);
	}, []);

	const share = async (text: string) => {
		setNote("");
		if (method === "share") {
			const [shared, error] = await t(async () =>
				navigator.share({ text }),
			);
			if (shared || isShareCancelled(error)) return;
		}
		const [copied] = await t(async () =>
			navigator.clipboard.writeText(text),
		);
		setNote(
			copied
				? "Copied to the clipboard."
				: "Couldn't share or copy the text.",
		);
	};

	const clearNote = () => setNote("");

	return { method, share, note, clearNote };
};
