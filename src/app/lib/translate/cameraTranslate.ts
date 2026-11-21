import { t } from "try";
import {
	scaleToFit,
	type TargetLanguage,
	TRANSLATE_LIMITS,
	type Translation,
} from "./translatePolicy";

/** Browser side of camera translation: frames to JPEG, and the API call. */

const LAST_TARGET_KEY = "JJ:CAMERA_TRANSLATE_TARGET";

export const readLastTarget = () => {
	const [ok, , value] = t(() => localStorage.getItem(LAST_TARGET_KEY));
	return ok ? value : null;
};

export const writeLastTarget = (code: TargetLanguage) => {
	t(() => localStorage.setItem(LAST_TARGET_KEY, code));
};

/** Draws a video frame or image, scaled down, and encodes it as a JPEG data URI. */
export const toJpegDataUri = (
	source: CanvasImageSource,
	width: number,
	height: number,
) => {
	const size = scaleToFit(width, height);
	const canvas = document.createElement("canvas");
	canvas.width = size.width;
	canvas.height = size.height;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("This browser can't process photos.");
	context.drawImage(source, 0, 0, size.width, size.height);
	return canvas.toDataURL("image/jpeg", TRANSLATE_LIMITS.jpegQuality);
};

/** Loads a picked file into an image element. */
export const loadImageFile = (file: File) =>
	new Promise<HTMLImageElement>((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const image = new Image();
		image.onload = () => {
			URL.revokeObjectURL(url);
			resolve(image);
		};
		image.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error("That file isn't a photo this browser can open."));
		};
		image.src = url;
	});

/** Sends a photo for translation; throws with the API's message on failure. */
export const requestTranslation = async (
	clientId: string,
	image: string,
	targetLanguage: TargetLanguage,
): Promise<Translation> => {
	const [sent, , response] = await t(
		fetch("/api/translate/image", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ clientId, image, targetLanguage }),
		}),
	);
	if (!sent)
		throw new Error("No connection. Check your network and try again.");

	const [read, , body] = await t(
		response.json<
			Partial<Translation> & { ok?: boolean; error?: string }
		>(),
	);
	if (!read || !response.ok || !body?.ok) {
		throw new Error(body?.error ?? "The photo could not be translated.");
	}
	return {
		sourceLanguage: body.sourceLanguage ?? null,
		blocks: body.blocks ?? [],
	};
};
