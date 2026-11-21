import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;

// Awaited so `next dev` serves requests only after the Cloudflare bindings
// (remote KV proxy) are ready; un-awaited, early requests fail for ~5s.
await initOpenNextCloudflareForDev();
