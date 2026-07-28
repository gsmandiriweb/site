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
// The adapter is only applied for build/preview/deploy. In `astro dev` we skip it
// so requests are served by Astro's standard Node SSR dev server instead of the
// Cloudflare workerd runtime, which throws "exports is not defined" on this
// project. The on-demand /keystatic routes still work in dev without the adapter.
// `globalThis.process` is cast because @types/node isn't installed (the project
// targets the browser/Cloudflare runtime).
const isDev = /** @type {any} */ (globalThis).process?.argv?.includes("dev") ?? false;

export default defineConfig({
  site: "https://second-shepherd.pages.dev",
  integrations: [react(), keystatic()],
  // adapter is omitted in `astro dev` (see note above)
  ...(isDev ? {} : { adapter: cloudflare() }),
});
