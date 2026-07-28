// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import keystatic from "@keystatic/astro";

// Cloudflare deployment.
// Replace `site` with your real Cloudflare URL (e.g. https://second-shepherd.pages.dev
// or your custom domain). Unlike GitHub Pages, Cloudflare serves at the root, so no
// `base` subpath is needed.
//
// `output` stays 'static' (default). The Keystatic integration injects its
// /keystatic and /api/keystatic routes with prerender:false, so the Cloudflare
// adapter serves them on-demand (needed for GitHub-mode auth) while the blog
// itself remains static.
//
// The adapter is only applied for build/preview. We skip it for dev (so requests
// use Astro's Node SSR dev server instead of the workerd runtime, which throws
// "exports is not defined" here) and for check/sync (so `astro check` doesn't try
// to resolve the Wrangler worker entry before a build exists).
// `globalThis.process` is cast because @types/node isn't installed (the project
// targets the browser/Cloudflare runtime).
const argv = /** @type {any} */ (globalThis).process?.argv ?? [];
const cmd = typeof argv[2] === "string" ? argv[2] : "";
const skipAdapter = cmd === "dev" || cmd === "check" || cmd === "sync";

export default defineConfig({
  site: "https://site.gsmandiri-web.workers.dev",
  integrations: [react(), keystatic()],
  // adapter omitted for dev/check/sync (see note above)
  ...(skipAdapter ? {} : { adapter: cloudflare() }),
});
