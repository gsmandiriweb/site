# CMS inventory — GitHub-only migration

Read-only inventory of the current CMS implementation (D1-era), classified for the
GitHub-native static destination. Each item is tagged **keep**, **adapt**, **remove**,
or **undecided**. Facts here unblock the downstream decisions (editor boundary, PR
metadata) and the eventual implementation. No migration is performed by this document.

Destination ADRs in force: 0008 (GitHub App control plane), 0009 (draft-to-PR
lifecycle), 0010 (static deployment boundary), 0011 (media contract),
0012 (canonical editor boundary), 0013 (GitHub-derived PR/revision metadata).

> **Implementation status:** the removal + rework described below has been
> executed — D1 and Keystatic are gone, deploy is automatic (`on: push: [main]`),
> the callback records the deployed SHA, and the dashboard is GitHub-native
> (local drafts + "save revision & open PR"). Remaining gaps are marked in
> section 8.

## 1. Runtime surface (all `prerender = false`)

| Route            | File                                                | Tag        | Note                                                                                                                                                                       |
| ---------------- | --------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin sign-in    | `src/pages/admin/login.astro`                       | **adapt**  | Copy mentions Keystatic; follows editor-boundary decision                                                                                                                  |
| PAT login        | `src/pages/api/auth/pat-login/index.astro`          | **keep**   | Interim owner-secret session gate; replaced by GitHub App + server roles per ADR 0008                                                                                      |
| Logout           | `src/pages/api/auth/logout/index.astro`             | **keep**   | Clears the session cookie (legacy Keystatic cookie removal done)                                                                                                           |
| Draft list/save  | `src/pages/api/cms/drafts/index.astro`              | **remove** | D1-backed server drafts; browser-local drafts replace them                                                                                                                 |
| PR status/create | `src/pages/api/cms/drafts/pr/index.astro`           | **adapt**  | Endpoint shape stays; storage backend follows the PR-metadata decision                                                                                                     |
| Publish approve  | `src/pages/api/cms/publish/index.astro`             | **remove** | Provenance moved into `draft-publish.ts` (PR metadata fingerprint); publish = merge + deploy                                                                               |
| Publish status   | `src/pages/api/cms/publish/status/index.astro`      | **remove** | Replaced by `deploy/status` (deployed SHA) + PR status                                                                                                                     |
| Deploy stage     | `src/pages/api/cms/deploy/stage/index.astro`        | **remove** | Manual deploy gate removed (ADR 0010)                                                                                                                                      |
| Deploy trigger   | `src/pages/api/cms/deploy/trigger/index.astro`      | **remove** | Manual dispatch removed (ADR 0010)                                                                                                                                         |
| Deploy status    | `src/pages/api/cms/deploy/status/index.astro`       | **adapt**  | Re-created as a minimal deployed-SHA status route (manual batch status removed)                                                                                            |
| Deploy callback  | `src/pages/api/cms/deploy/callback/index.astro`     | **adapt**  | Signed deploy-confirmation endpoint recording the deployed commit SHA (done)                                                                                               |
| Keystatic editor | `/keystatic`, `/api/keystatic` (+ middleware guard) | **remove** | Custom dashboard is the canonical editor (editor-boundary decision)                                                                                                        |
| Custom dashboard | `/prototype-cms` → canonical `/admin`               | **adapt**  | Sole authoring surface; drop stage/trigger/publish-approve UI; keep PR creation/review/status; derive Draft → In review → Merged → Published; add image upload + insertion |

## 2. D1 layer — **remove**

- `wrangler.toml` `[[d1_databases]] CMS_DB` binding — **remove**; contains the
  deploy-blocking placeholder `database_id = "REPLACE_WITH_CMS_DB_ID"`.
- `migrations/0001_cms_drafts.sql` — `cms_drafts`, `cms_draft_revisions` — **remove**.
- `migrations/0002_cms_draft_pull_requests.sql` — `cms_draft_pull_requests` — **remove**.
- `src/utils/cms-drafts.ts` — the whole D1 draft repository (list/save, revision
  conflict detection, actor tracking) — **remove**. Keep and reuse:
  - `validateDraftPost` — **keep** (payload contract for editor → GitHub).
  - `validateMutationOrigin` — **keep** (same-origin guard).
  - `DraftActionError`, `jsonResponse` — **keep** (shared API error plumbing).
  - `isSafeStorageSlug` — **adapt** (currently a hard-coded 3-slug allowlist; must
    derive from the repository's actual `src/content/blog/*` files).
  - `DraftPost` type — **keep**; `CmsDraft.revision` derives from GitHub branch
    naming (`cms/<slug>/r<N>`), not a DB row.

## 3. KV layer — **keep**

- `SESSION` KV namespace (binding in `wrangler.toml`) — **keep**: sessions and,
  per ADR 0010, the deploy confirmation (last deployed commit SHA) live here.
  KV never stores content or media.
- `src/utils/cms-state.ts` (`readCmsState`/`writeCmsState`) — **adapt**: keep as the
  generic KV state layer; publish changeSet + deploy batch records are replaced by
  a minimal `deployedSha` confirmation record.

## 4. Auth / session — **keep**, harden later

- `src/utils/admin-session.ts` — HttpOnly `SameSite=Lax` cookie sessions over KV,
  constant-time owner-secret compare — **keep** as interim. ADR 0008 consequence:
  server-enforced roles and GitHub App identity land in implementation.
- `src/middleware.astro` — Keystatic-only guard + PAT cookie injection — **remove**
  (its only job was guarding Keystatic; the CMS APIs self-guard).

## 5. GitHub-native flow — **adapt**

- `src/utils/draft-publish.ts` — branch-per-revision (`cms/draft/<slug>/r<N>`),
  Contents-API commit, PR create/reuse/reopen, GitHub reconciliation — **adapt**:
  all D1 reads and the `cms_draft_pull_requests` table are dropped; PR metadata
  comes from GitHub itself (PR-metadata decision). Branch prefix per ADR 0009 is
  `cms/<slug>/r<N>`.
- `src/utils/publish.ts` — **remove**: with publish = merge on GitHub, the
  approve-changeSet endpoint is gone. The ADR 0009/0013 provenance contract now
  lives in `draft-publish.ts` (fingerprint written to the PR metadata block at PR
  creation; exact-match is re-checkable from GitHub alone).
- `src/utils/images.ts` — basename resolver — **adapt**: explicit-path resolution per
  ADR 0011; basename fallback only for legacy catalog refs during migration.
- Content contract — `src/content.config.ts`, `src/utils/blog.ts` — **done**: schema
  gains `imageAlt` (required with `image`) per ADR 0011; legacy posts backfilled; the
  blog detail page renders `imageAlt` instead of the title.

## 6. Deploy flow — **rework** (ADR 0010)

- `src/utils/deploy.ts` — rewritten (done): callback-only. `recordDeployCallback`
  verifies the signed workflow callback and stores the deployed SHA in KV;
  `deployedCommit` reads it; `isCommitDeployed` checks ancestry via the GitHub
  compare API (base=deployed, head=commit → `behind`/`identical` means live).
- `.github/workflows/deploy.yml` — **adapt**: `on: push: [main]` (every merge);
  remove batch/commit/signature dispatch inputs and the verify step; build with bun,
  `wrangler deploy`, then POST a signed callback carrying the deployed commit SHA.
- Secrets: **remove** `CMS_GITHUB_ACTIONS_PAT`, `CMS_GITHUB_ACTIONS_DISPATCH_SECRET`.
  **Keep** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CMS_DEPLOY_CALLBACK_URL`,
  `CMS_DEPLOY_CALLBACK_SECRET`, `KEYSTATIC_GITHUB_PAT` (pending editor/App decisions),
  `CMS_OWNER_SECRET`. **Undecided**: GitHub App ID/private key (ADR 0008).
- `docs/deploy-cloudflare.md` — **adapt**: replace dispatch-era sections with the
  auto-deploy + callback flow; drop D1 instructions.

## 7. Keystatic — **remove** (resolved: custom dashboard is the canonical editor)

- `keystatic.config.ts`, `@keystatic/astro` integration, `@keystatic/core`,
  `/keystatic`, `/api/keystatic`, middleware guard, the postinstall patch
  (`scripts/patch-keystatic.mjs`), and the Astro code-splitting groups — **remove**.
- `KEYSTATIC_GITHUB_PAT` is renamed `CMS_GITHUB_PAT` (pending the GitHub App
  decision); Keystatic's `src/images/ref` upload target is dropped in favor of the
  ADR 0011 per-post folders.

## 8. Gaps vs destination

1. ~~PR/revision metadata home~~ resolved: derive from GitHub; the PR body block carries revision + fingerprint (ADR 0013).
2. ~~Editor boundary~~ resolved: custom dashboard canonical, Keystatic removed.
3. Server-side roles are still cosmetic (ADR 0008 consequence).
4. GitHub App not implemented; PATs still the mutation identity (ADR 0008 consequence).
5. Image convention today (`src/images/ref`, basename refs, a space in one path)
   conflicts with ADR 0011 → migration work.
6. ~~`imageAlt` missing from the schema~~ resolved: required when `image` is set;
   existing posts backfilled (done).
7. ~~Manual deploy dispatch~~ resolved: auto-deploy on push to main (done).
8. ~~`REPLACE_WITH_CMS_DB_ID` placeholder~~ resolved: D1 removed (done).
9. ~~Duplicated serializers~~ resolved: `publish.ts` removed; the one serializer
   lives in `draft-publish.ts` (done).
10. ~~Dangling-reference gate + `imageAlt` requirement~~ resolved: the gate runs at
    PR creation (`draft-publish.ts` `verifyImageReferences`) and rejects unresolvable
    `image:`/`![…]()` references with the exact path; upload endpoint
    (`/api/cms/media`) validates magic bytes + limits and writes to
    `src/images/blog/<slug>/` on the pending revision branch (done).

## 9. Suggested implementation sequence (not a decision)

1. All decisions resolved — implementation proceeds from this inventory.
2. Remove D1: delete bindings, migrations, `cms-drafts.ts` DB layer, drafts API;
   remove dispatch-era deploy routes and secrets.
3. Rework deploy: auto-deploy workflow + deployed-SHA callback; simplify dashboard.
4. ~~Adopt ADR 0011 (resolver, `imageAlt`, per-post folders)~~ done for uploads and
   the resolver; remaining migration: move legacy `src/images/ref|bsm` files into
   per-post folders and rewrite legacy basename references to explicit paths.
5. Harden auth per ADR 0008 (GitHub App, server roles).
