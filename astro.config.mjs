// @ts-check
import { defineConfig } from "astro/config";

// GitHub Pages deployment.
// - If you publish to the special `<username>.github.io` repository, set base to "/".
// - If you publish to a project repository (e.g. `my-website`), set base to "/my-website".
//   Replace <username> and <repo> below with your actual GitHub values.
export default defineConfig({
  site: "https://USERNAME.github.io",
  base: "/REPO",
});
