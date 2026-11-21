"use client";

import { usePwaUpdate } from "@/app/hooks/usePwaUpdate";

/** Registers the service worker and offers a newly deployed version. */
export const PwaUpdatePrompt = () => {
	const { updateReady, update, dismiss } = usePwaUpdate();
	if (!updateReady) return null;

	return (
		<div
			role="status"
			className="fixed inset-x-0 bottom-[max(2.5rem,calc(env(safe-area-inset-bottom)+2rem))] z-50 flex justify-center px-4"
		>
			<div className="flex items-center gap-3 rounded-full bg-gray-900 py-2 ps-5 pe-2 text-sm text-white shadow-lg">
				<span>A new version is available.</span>
				<button
					type="button"
					onClick={update}
					className="rounded-full bg-white px-4 py-1.5 font-medium text-gray-900 hover:bg-gray-100"
				>
					Reload
				</button>
				<button
					type="button"
					onClick={dismiss}
					aria-label="Later"
					className="rounded-full px-2 py-1.5 text-gray-300 hover:text-white"
				>
					✕
				</button>
			</div>
		</div>
	);
};
