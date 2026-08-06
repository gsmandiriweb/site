// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// Static GitHub Pages fallback — PUBLIC site only.
//
// The CMS is Cloudflare-only (ADRs 0008–0013): its runtime routes under /admin
// and /api/* opt out of prerendering and need the Worker runtime, KV, and
// secrets. The Pages workflow (deploy-gh-pages.yml) removes those routes before
// this build, so only the fully static public site is emitted.
//
// `base` matches the project Pages URL gsmandiriweb.github.io/site; the `u()`
// URL helper reads BASE_URL, so every link and asset is subpath-aware.
export default defineConfig({
  site: "https://gsmandiriweb.github.io",
  base: "/site/",
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
