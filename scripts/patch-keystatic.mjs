// @ts-nocheck
// Postinstall patch for @keystatic/astro on Astro 7 / @astrojs/cloudflare.
//
// Upstream @keystatic/astro@5.2.0 reads the Cloudflare RuntimeEnv via
// `Astro.locals.runtime.env`, which was removed in Astro 6/7. On Astro 7 the
// bindings live on the `cloudflare:workers` module instead. Without this patch
// the `/api/keystatic` route throws "Astro.locals.runtime.env has been removed"
// and GitHub login returns HTTP 500.
//
// We apply this as a postinstall step (run on every `bun install`, including
// Cloudflare's `bun install --frozen-lockfile`) because bun hardlinks
// node_modules from its global cache, so `bun patch` / the `patches` field
// cannot diff against the original. See patches/@keystatic+astro.patch for the
// canonical diff. Idempotent: safe to run repeatedly.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, "../node_modules/@keystatic/astro/dist/keystatic-astro-api.js");

const OLD =
  "    const envVarsForCf = (_context$locals = context.locals) === null || _context$locals === void 0 || (_context$locals = _context$locals.runtime) === null || _context$locals === void 0 ? void 0 : _context$locals.env;";

const NEW = [
  "    let envVarsForCf;",
  "    // Patched for Astro 7 / @astrojs/cloudflare: bindings now live on",
  "    // the cloudflare:workers module. Guarded so astro dev (Node) still works.",
  "    try {",
  "      envVarsForCf = (await import('cloudflare:workers')).env;",
  "    } catch {",
  "      envVarsForCf = void 0;",
  "    }",
].join("\n");

if (!existsSync(target)) {
  console.warn("[patch-keystatic] target not found, skipping:", target);
  process.exit(0);
}

const src = readFileSync(target, "utf8");
if (src.includes(NEW)) {
  console.log("[patch-keystatic] already applied");
  process.exit(0);
}
if (!src.includes(OLD)) {
  console.warn("[patch-keystatic] upstream line not found (version changed?). Skipping.");
  process.exit(0);
}

writeFileSync(target, src.replace(OLD, NEW));
console.log("[patch-keystatic] patched @keystatic/astro for Astro 7");
