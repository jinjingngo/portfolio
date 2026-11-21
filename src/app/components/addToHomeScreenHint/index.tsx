/** iPhone/iPad hint: Safari has no install prompt, so explain the Share menu. */
export const AddToHomeScreenHint = ({
	onDismiss,
}: {
	onDismiss: () => void;
}) => (
	<div
		role="status"
		className="fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-50 flex justify-center px-4"
	>
		<div className="flex items-center gap-3 rounded-2xl bg-gray-900 py-2 ps-4 pe-2 text-sm text-white shadow-lg">
			<span>
				Install this site as an app: tap <strong>Share</strong>, then{" "}
				<strong>Add to Home Screen</strong>.
			</span>
			<button
				type="button"
				onClick={onDismiss}
				aria-label="Close"
				className="rounded-full px-2 py-1.5 text-gray-300 hover:text-white"
			>
				✕
			</button>
		</div>
	</div>
);
