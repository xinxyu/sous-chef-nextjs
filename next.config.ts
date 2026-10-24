import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {};

export default nextConfig;

// Makes Cloudflare bindings (Hyperdrive, env vars from .dev.vars) available in `next dev`.
initOpenNextCloudflareForDev();
