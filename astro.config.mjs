// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// Cloudflare deployment.
// `site` is the real production origin: the `site` Worker in the gsmandiri-web
// account serves this repository (see wrangler.toml `name`). Cloudflare serves
// at the root, so no `base` subpath is needed.
//
// `output` stays 'static' (default). Only the CMS control-plane routes opt out with
// `prerender: false` (auth, CMS mutations, the deployment callback) so the Cloudflare
// adapter serves them on-demand; the public site itself is fully static.
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
  integrations: [react()],
  // The legacy prototype route is preserved as a redirect to the canonical
  // dashboard (ADR 0012). Astro emits a static meta-refresh redirect page.
  redirects: {
    "/prototype-cms": "/admin",
  },
  vite: {
    plugins: [tailwindcss()],
  },
  // adapter omitted for dev/check/sync (see note above)
  ...(skipAdapter ? {} : { adapter: cloudflare() }),
});
