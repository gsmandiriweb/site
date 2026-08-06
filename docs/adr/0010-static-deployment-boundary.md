# ADR 0010 — Static deployment boundary on Cloudflare Workers + Assets

- **Status:** Accepted
- **Date:** 2026-08-06
- **Context:** The BSM public Astro site is fully static and GitHub is the only durable content source. The CMS control plane is a small authenticated server-side mutation layer. This ADR fixes the deployment shape: the hosting target, the build trigger after a merge to `main`, the preview strategy, the canonical asset/image URL policy, which routes may stay runtime, and the shape of the GitHub Actions workflow.

## Decision

- **Hosting shape:** Cloudflare **Workers + Assets** (one Worker project), not Cloudflare Pages. Astro runs with `output: static`; only control-plane routes render on demand (`prerender: false`): auth (`/admin/*`, `/api/auth/*`), CMS mutations (`/api/cms/*`), the deployment callback, and `/keystatic` while it remains (editor-boundary ticket owns its fate). Everything else is pre-rendered static output. This matches Cloudflare's current direction and the split output the Astro adapter already emits.
- **Build trigger:** GitHub Actions on **push to `main`** — every merged PR deploys. CI builds with bun and deploys with `wrangler deploy`; Cloudflare credentials live only as GitHub secrets. Cloudflare's own git integration (Workers Builds) is rejected because the workflow needs custom build and signed-callback steps.
- **Workflow shape:** the manual stage/dispatch/verify machinery from the D1 era is removed. The workflow builds, deploys, then POSTs a signed terminal callback carrying the **deployed commit SHA**. The CMS stores that SHA in KV and derives **Published** for every merged revision whose merge commit is deployed (ancestry check). Merge to `main` _is_ the owner approval; there is no separate deploy gate.
- **PR previews:** none for CMS revision PRs. Review happens on the GitHub PR diff and in the editor's preview; preview deployments are out of scope for this effort.
- **Assets/images:** the deployed build output is the only canonical URL source (`/_astro/*` and repo images processed by Astro at build time). No runtime hotlinking to raw GitHub URLs.
- **KV boundary:** KV holds only ephemeral control-plane state — sessions and deploy confirmation. It never stores content or media; GitHub remains the durable store.

## Rejected alternatives

- **Cloudflare Pages / Workers Builds git integration:** cannot express the custom build verification and signed callback; Pages is the legacy direction.
- **Manual deploy gate after merge:** the merge to `main` is already the owner-approved, reviewed step; a second gate duplicates it.
- **PR preview deployments:** GitHub diff review plus the editor preview suffice for this editorial scale; revisit only if the workflow demands it.

## Consequences

The migration ticket owns removal of the D1 `CMS_DB` binding and migrations, `CMS_GITHUB_ACTIONS_PAT`, `CMS_GITHUB_ACTIONS_DISPATCH_SECRET`, dispatch-signature verification, and batch staging. Retained: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CMS_DEPLOY_CALLBACK_URL`, `CMS_DEPLOY_CALLBACK_SECRET`, and the SESSION KV namespace. The dashboard's deploy UI is replaced by status derived from GitHub plus the KV deploy confirmation.
