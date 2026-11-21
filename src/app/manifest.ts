import type { MetadataRoute } from "next";

/** Icon for the app shortcuts (long-press / right-click on the app icon). */
const SHORTCUT_ICONS = [
	{ src: "/icon-192.png", sizes: "192x192", type: "image/png" },
];

export default function (): MetadataRoute.Manifest {
	return {
		id: "/",
		name: "Jinjing",
		short_name: "Jinjing",
		description:
			"Jinjing Wu's portfolio and lab: small web experiments like Camera Translate and Web Push.",
		start_url: "/?source=pwa",
		scope: "/",
		display: "standalone",
		display_override: ["standalone", "minimal-ui"],
		background_color: "#f9fafb",
		theme_color: "#f9fafb",
		categories: ["personalization", "productivity", "utilities"],
		icons: [
			{
				src: "/icon-192.png",
				sizes: "192x192",
				type: "image/png",
				purpose: "any",
			},
			{
				src: "/icon-512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "any",
			},
			{
				src: "/maskable-192.png",
				sizes: "192x192",
				type: "image/png",
				purpose: "maskable",
			},
			{
				src: "/maskable-512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable",
			},
		],
		// Chrome's richer install dialog: narrow for phones, wide for desktop.
		screenshots: [
			{
				src: "/screenshots/narrow-camera-translate.jpg",
				sizes: "780x1688",
				type: "image/jpeg",
				form_factor: "narrow",
				label: "Camera Translate",
			},
			{
				src: "/screenshots/narrow-home.jpg",
				sizes: "780x1688",
				type: "image/jpeg",
				form_factor: "narrow",
				label: "Home",
			},
			{
				src: "/screenshots/wide-lab.jpg",
				sizes: "1280x800",
				type: "image/jpeg",
				form_factor: "wide",
				label: "The lab",
			},
		],
		shortcuts: [
			{
				name: "Camera Translate",
				url: "/lab/camera-translate",
				description: "Translate the text in a photo",
				icons: SHORTCUT_ICONS,
			},
			{
				name: "Web Push",
				url: "/lab/web-push",
				description: "Send yourself a push notification",
				icons: SHORTCUT_ICONS,
			},
		],
	};
}
