"use client";

import { startTransition, useState, ViewTransition } from "react";

const CARDS = Object.freeze([
	{
		title: "Forward",
		text: "Going deeper slides the page in from the right.",
	},
	{ title: "Back", text: "Going up slides it back in from the left." },
	{ title: "Still", text: "The navbar stays where it is the whole time." },
]);

/**
 * Same-page demo: changing the card inside a transition lets the browser
 * crossfade the old and new card (the key makes React treat them as two).
 */
export const CrossfadeDemo = () => {
	const [index, setIndex] = useState(0);
	const card = CARDS[index];
	const next = () =>
		startTransition(() =>
			setIndex((current) => (current + 1) % CARDS.length),
		);

	return (
		<div className="flex flex-col items-start gap-3">
			<ViewTransition key={index}>
				<div className="w-full rounded-xl border border-gray-200 bg-white p-5">
					<p className="font-medium text-gray-900">{card.title}</p>
					<p className="mt-1 text-gray-700">{card.text}</p>
				</div>
			</ViewTransition>
			<button
				type="button"
				onClick={next}
				className="rounded-full border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-50"
			>
				Next card
			</button>
		</div>
	);
};
