import { t } from "try";
import { SHARED_PHOTO_CACHE, SHARED_PHOTO_KEY } from "./shareTarget";

/**
 * Takes the photo the service worker kept from a share, removing it so it is
 * used once. Null when there is none or Cache Storage is unavailable.
 */
export const takeSharedPhoto = async (): Promise<Blob | null> => {
	const [ok, error, photo] = await t(async () => {
		const cache = await caches.open(SHARED_PHOTO_CACHE);
		const response = await cache.match(SHARED_PHOTO_KEY);
		if (!response) return null;
		const blob = await response.blob();
		await cache.delete(SHARED_PHOTO_KEY);
		return blob;
	});
	if (!ok) console.warn("Couldn't read the shared photo", error);
	return ok ? photo : null;
};
