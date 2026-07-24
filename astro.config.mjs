// @ts-check
import { defineConfig } from "astro/config";

// GitHub Pages deployment (project page): https://gsmandiriweb.github.io/site/
// `site` is the Pages origin; `base` is the repo subpath. If you later move this
export default defineConfig({
  site: "https://gsmandiriweb.github.io",
  base: "/site",
});
