import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;

// Awaited so `next dev` serves requests only after the Cloudflare bindings
// (wrangler's local KV and friends) are ready; un-awaited, early requests can
// fail with "getCloudflareContext has been called without ...".
await initOpenNextCloudflareForDev();
