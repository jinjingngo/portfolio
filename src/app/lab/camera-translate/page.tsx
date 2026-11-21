"use client";

import Link from "next/link";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useClientId } from "@/app/hooks/useClientId";
import { useOnline } from "@/app/hooks/useOnline";
import { useReadAloud } from "@/app/hooks/useReadAloud";
import {
	loadImageFile,
	readLastTarget,
	requestTranslation,
	toJpegDataUri,
	writeLastTarget,
} from "@/app/lib/translate/cameraTranslate";
import { playAllOrder } from "@/app/lib/translate/speechPolicy";
import {
	defaultTargetLanguage,
	isTargetLanguage,
	shouldRetranslate,
	TARGET_LANGUAGES,
	type TargetLanguage,
	type Translation,
} from "@/app/lib/translate/translatePolicy";

type Step = "idle" | "camera" | "translating" | "result" | "error";

const buttonClass =
	"rounded-full px-5 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-40";
const primary = `${buttonClass} bg-gray-900 text-white hover:bg-gray-700`;
const secondary = `${buttonClass} border border-gray-300 bg-white text-gray-900 hover:bg-gray-50`;

const stopTracks = (stream: MediaStream | null) => {
	for (const track of stream?.getTracks() ?? []) track.stop();
};

/**
 * Language names in the visitor's own language, e.g. "svenska" or "Swedish".
 * English until mounted, so server and first client render match.
 */
const useLanguageNames = () => {
	const [locale, setLocale] = useState("en");
	useEffect(() => setLocale(navigator.language || "en"), []);
	return useMemo(() => {
		if (typeof Intl === "undefined" || !("DisplayNames" in Intl))
			return null;
		return new Intl.DisplayNames([locale, "en"], { type: "language" });
	}, [locale]);
};

export default function CameraTranslatePage() {
	const { id: clientId } = useClientId();
	const online = useOnline();
	const names = useLanguageNames();
	const nameOf = (code: string | null) =>
		code ? (names?.of(code) ?? code) : "unknown";

	const videoRef = useRef<HTMLVideoElement>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const cameraFileRef = useRef<HTMLInputElement>(null);
	const mountedRef = useRef(false);
	const openingRef = useRef(false);
	/** Id of the latest translation request; older answers are ignored. */
	const requestRef = useRef(0);

	const [step, setStep] = useState<Step>("idle");
	const [error, setError] = useState("");
	const [target, setTarget] = useState<TargetLanguage>("en");
	const [photo, setPhoto] = useState<string | null>(null);
	const [result, setResult] = useState<
		(Translation & { target: TargetLanguage }) | null
	>(null);
	const [opening, setOpening] = useState(false);
	/** Language of the last translation attempt, shown or failed. */
	const [lastTarget, setLastTarget] = useState<TargetLanguage | null>(null);
	const readAloud = useReadAloud(
		step === "result" ? (result?.sourceLanguage ?? null) : null,
	);
	const [shownOriginals, setShownOriginals] = useState<Set<number>>(
		new Set(),
	);

	useEffect(() => {
		setTarget(
			defaultTargetLanguage(navigator.languages ?? [], readLastTarget()),
		);
	}, []);

	const stopCamera = () => {
		stopTracks(streamRef.current);
		streamRef.current = null;
	};
	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			stopTracks(streamRef.current);
			streamRef.current = null;
		};
	}, []);

	const fail = (message: string) => {
		stopCamera();
		setError(message);
		setStep("error");
	};

	const startCamera = async () => {
		if (!navigator.mediaDevices?.getUserMedia) {
			cameraFileRef.current?.click();
			return;
		}
		// One request at a time: a second tap while the permission prompt is
		// open would otherwise leave the first stream running.
		if (openingRef.current || streamRef.current) return;
		openingRef.current = true;
		setOpening(true);
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: { ideal: "environment" } },
				audio: false,
			});
			if (!mountedRef.current) {
				stopTracks(stream);
				return;
			}
			streamRef.current = stream;
			setStep("camera");
			const video = videoRef.current;
			if (!video) return;
			video.srcObject = stream;
			await video.play();
		} catch {
			fail(
				"Camera access was blocked. Allow it in your browser, or choose a photo instead.",
			);
		} finally {
			openingRef.current = false;
			if (mountedRef.current) setOpening(false);
		}
	};

	const translate = async (
		image: string,
		targetLanguage: TargetLanguage = target,
	) => {
		if (!clientId) return;
		const requestId = ++requestRef.current;
		readAloud.stop();
		setLastTarget(targetLanguage);
		setPhoto(image);
		setResult(null);
		setShownOriginals(new Set());
		setStep("translating");
		try {
			const translation = await requestTranslation(
				clientId,
				image,
				targetLanguage,
			);
			if (requestId !== requestRef.current) return;
			setResult({ ...translation, target: targetLanguage });
			setStep("result");
		} catch (reason) {
			if (requestId !== requestRef.current) return;
			fail(
				reason instanceof Error
					? reason.message
					: "The photo could not be translated.",
			);
		}
	};

	const capture = () => {
		const video = videoRef.current;
		if (!video?.videoWidth) return;
		const image = toJpegDataUri(video, video.videoWidth, video.videoHeight);
		stopCamera();
		translate(image);
	};

	const pickFile = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		// Busy while the new photo loads: the language picker is disabled and any
		// translation still in flight for the previous photo is ignored.
		requestRef.current++;
		setStep("translating");
		try {
			const image = await loadImageFile(file);
			translate(
				toJpegDataUri(image, image.naturalWidth, image.naturalHeight),
			);
		} catch (reason) {
			fail(
				reason instanceof Error
					? reason.message
					: "That photo could not be opened.",
			);
		}
	};

	const chooseTarget = (code: string) => {
		if (!isTargetLanguage(code)) return;
		setTarget(code);
		writeLastTarget(code);
		const again = shouldRetranslate({
			hasPhoto: photo !== null,
			settled:
				online && !opening && (step === "result" || step === "error"),
			lastTarget,
			nextTarget: code,
		});
		if (again && photo) translate(photo, code);
	};

	const toggleOriginal = (index: number) =>
		setShownOriginals((current) => {
			const next = new Set(current);
			if (next.has(index)) next.delete(index);
			else next.add(index);
			return next;
		});

	const reset = () => {
		readAloud.stop();
		stopCamera();
		setPhoto(null);
		setResult(null);
		setError("");
		setStep("idle");
	};

	return (
		<div className="flex min-w-0 flex-1 flex-col gap-8">
			<div>
				<Link
					className="text-sm underline decoration-wavy underline-offset-4"
					href="/lab"
				>
					← /lab
				</Link>
				<h1 className="mt-5 text-4xl text-gray-900 md:text-5xl">
					Camera Translate
				</h1>
				<p className="mt-3 max-w-2xl text-gray-600">
					Point your camera at a sign, a menu or a label, take a
					photo, and read it in your language.
				</p>
			</div>

			<section className="w-full min-w-0 max-w-2xl rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 md:p-8">
				<div className="flex flex-col gap-5">
					{!online && (
						<p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
							You&apos;re offline. Translating needs a connection;
							reading a result aloud still works.
						</p>
					)}
					<label className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
						Translate into
						<select
							value={target}
							onChange={(event) =>
								chooseTarget(event.target.value)
							}
							disabled={step === "translating" || opening}
							className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
						>
							{TARGET_LANGUAGES.map((code) => (
								<option key={code} value={code}>
									{nameOf(code)}
								</option>
							))}
						</select>
					</label>

					<div className="relative overflow-hidden rounded-xl bg-gray-900">
						<video
							ref={videoRef}
							playsInline
							muted
							className={
								step === "camera" ? "block w-full" : "hidden"
							}
						/>
						{photo && step !== "camera" && (
							// biome-ignore lint/performance/noImgElement: a local data URI, not an optimisable asset
							<img
								src={photo}
								alt="What you captured, with its translation below"
								className="block w-full"
							/>
						)}
						{step === "translating" && (
							<div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-medium text-white">
								Reading and translating…
							</div>
						)}
						{!photo && step !== "camera" && (
							<div className="flex aspect-[4/3] items-center justify-center p-6 text-center text-sm text-gray-300">
								Your photo will appear here.
							</div>
						)}
					</div>

					<p aria-live="polite" className="sr-only">
						{step === "translating"
							? "Reading and translating."
							: step === "result" && result
								? `Detected ${nameOf(result.sourceLanguage)}, ${result.blocks.length} lines translated into ${nameOf(result.target)}.`
								: ""}
					</p>
					{step === "result" && result && (
						<div className="flex flex-col gap-3">
							{result.blocks.length === 0 ? (
								<p className="text-sm text-gray-600">
									No text found. Try again closer, with more
									light.
								</p>
							) : (
								<>
									<p className="text-sm text-gray-600">
										Detected {nameOf(result.sourceLanguage)}{" "}
										→ {nameOf(result.target)}. Tap a line to
										see the original.
									</p>
									{readAloud.supported &&
										readAloud.voicesLoaded &&
										!readAloud.voice && (
											<p className="text-sm text-gray-500">
												No voice for{" "}
												{nameOf(result.sourceLanguage)}{" "}
												on this device, so it can't be
												read aloud.
											</p>
										)}
									{readAloud.voice && (
										<div className="flex flex-wrap items-center gap-3">
											{readAloud.playing === null ? (
												<button
													type="button"
													onClick={() =>
														readAloud.play(
															playAllOrder(
																result.blocks,
															).map((index) => ({
																index,
																text: result
																	.blocks[
																	index
																].text,
															})),
														)
													}
													className={secondary}
												>
													▶ Play all
												</button>
											) : (
												<button
													type="button"
													onClick={readAloud.stop}
													className={secondary}
												>
													■ Stop
												</button>
											)}
											<label className="flex items-center gap-2 text-sm text-gray-700">
												<input
													type="checkbox"
													checked={readAloud.slow}
													onChange={(event) =>
														readAloud.setSlow(
															event.target
																.checked,
														)
													}
													className="h-4 w-4"
												/>
												Slow
											</label>
										</div>
									)}
									<ul className="flex flex-col divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
										{result.blocks.map((block, index) => (
											<li
												// biome-ignore lint/suspicious/noArrayIndexKey: one fixed list per result, never reordered
												key={index}
												className={`flex items-stretch ${readAloud.playing === index ? "bg-amber-50" : ""}`}
											>
												{readAloud.voice && (
													<button
														type="button"
														onClick={() =>
															readAloud.playing ===
															index
																? readAloud.stop()
																: readAloud.play(
																		[
																			{
																				index,
																				text: block.text,
																			},
																		],
																	)
														}
														aria-label={
															readAloud.playing ===
															index
																? "Stop reading"
																: `Read aloud: ${block.text}`
														}
														className="flex w-12 shrink-0 items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-900"
													>
														{readAloud.playing ===
														index
															? "■"
															: "▶"}
													</button>
												)}
												<button
													type="button"
													onClick={() =>
														toggleOriginal(index)
													}
													className="w-full px-4 py-3 text-left text-base leading-snug text-gray-900 hover:bg-gray-50"
												>
													{shownOriginals.has(
														index,
													) ? (
														<span className="text-gray-500">
															{block.text}
														</span>
													) : (
														block.translation
													)}
												</button>
											</li>
										))}
									</ul>
								</>
							)}
						</div>
					)}
					{step === "error" && (
						<p aria-live="polite" className="text-sm text-red-700">
							{error}
						</p>
					)}

					<div className="flex flex-wrap gap-3">
						{step === "camera" ? (
							<>
								<button
									type="button"
									onClick={capture}
									className={primary}
								>
									Take photo
								</button>
								<button
									type="button"
									onClick={reset}
									className={secondary}
								>
									Cancel
								</button>
							</>
						) : (
							<>
								<button
									type="button"
									onClick={startCamera}
									disabled={
										step === "translating" ||
										opening ||
										!clientId ||
										!online
									}
									className={primary}
								>
									{photo ? "Retake" : "Open camera"}
								</button>
								<button
									type="button"
									onClick={() => fileRef.current?.click()}
									disabled={
										step === "translating" ||
										!clientId ||
										!online
									}
									className={secondary}
								>
									Choose photo
								</button>
							</>
						)}
						{/* Library or camera, the phone's own choice. */}
						<input
							ref={fileRef}
							type="file"
							accept="image/*"
							onChange={pickFile}
							className="hidden"
						/>
						{/* Camera only: for "Open camera" when getUserMedia is missing. */}
						<input
							ref={cameraFileRef}
							type="file"
							accept="image/*"
							capture="environment"
							onChange={pickFile}
							className="hidden"
						/>
					</div>

					<p className="text-xs text-gray-500">
						Photos are sent to Cloudflare Workers AI to read and
						translate, and are not stored. Limited to a few photos a
						minute and a daily total for the whole site.
					</p>
				</div>
			</section>
		</div>
	);
}
