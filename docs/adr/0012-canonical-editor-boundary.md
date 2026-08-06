# ADR 0012 — Canonical BSM editor and legacy-admin boundary

- **Status:** Accepted
- **Date:** 2026-08-06
- **Context:** Two candidate editors existed at the GitHub-native decision: Keystatic (a full git-backed CMS with its own UI, config, Cloudflare patch, and fixed `src/images/ref` upload directory) and the custom `/prototype-cms` dashboard (brand-controlled, with a WYSIWYG body editor and the per-revision PR lifecycle already built). `PRODUCT.md` also still documented Decap CMS as intent. One canonical authoring surface must be fixed, and the legacy admin surfaces deprecated.

## Decision

- **Canonical editor:** the custom CMS dashboard is the sole authoring surface. **Keystatic is removed entirely** — `keystatic.config.ts`, the `/keystatic` and `/api/keystatic` routes, the middleware guard, the `@keystatic/astro` + `@keystatic/core` dependencies, the postinstall patch, and the Astro code-splitting groups for Keystatic editor families.
- **Editing paradigm:** the current markdown-first WYSIWYG (MDXEditor headings/lists/links/quotes/inline styles) stays the editor bar; in-body **image insertion** is added. Tables/code blocks are added later only if editorial need arises.
- **Decap:** the `PRODUCT.md` Decap intent is **discarded**; the custom dashboard is documented as the CMS.
- **Route map:** the control plane becomes one tree — login at `/admin/login`, dashboard at `/admin` (the former `/prototype-cms` redirects), `safeNext` updated from `/keystatic` to `/admin`. `/keystatic`, `/api/keystatic`, and `middleware.astro` are removed (the CMS APIs self-guard). `/admin/login` copy is rewritten. Keystatic-centric docs (`cms-operations-guide.html`, `deploy-cloudflare.md`) are rewritten in implementation.
- **Editor readiness bar** (the precondition for removing old surfaces): edit every field incl. required `imageAlt`; insert and upload images with ADR 0011 validation and a picker for existing repo images; dangling-reference gate at PR creation; browser-local autosave + explicit save-revision-and-open-PR; the Draft → In review → Merged → Published lifecycle UI with supersede, open/recreate, owner merge, and owner revert; deploy status derived from the KV deployed SHA.

## Rejected alternatives

- **Keystatic retained as a fallback editor:** two editors means two schemas, two auth paths, and the unresolved `src/images/ref` media conflict.
- **Keystatic canonical:** contradicts the settled direction and carries Cloudflare/Astro patching friction and a fixed UI.
- **Decap as a documented fallback:** stale intent; the destination is a custom editor.
- **Full rich-text upgrade now:** beyond BSM's long-form editorial needs.

## Consequences

Only genuinely new build work is image upload + insertion in the dashboard. `KEYSTATIC_GITHUB_PAT` is renamed `CMS_GITHUB_PAT` (pending the GitHub App decision). Removing Keystatic drops the patched Cloudflare surface and the editor code-splitting hacks, and the `/keystatic` runtime surface disappears from the deployment boundary.
