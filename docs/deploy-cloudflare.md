# Deploy to Cloudflare (Workers + Assets)

> **Ops shortcut:** for the quick secrets checklist, first-deploy steps, and
> verification flow, see [`deploy-runbook.md`](./deploy-runbook.md). This guide
> has the full background and troubleshooting detail.

This site is an Astro 7 static site with the `@astrojs/cloudflare` adapter. The
adapter emits a **split build**: static assets in `dist/client/`, the Worker in
`dist/server/`. Deploy it as a **Cloudflare Worker + Assets** — not classic
Cloudflare Pages, which expects a flat `dist/_worker.js` and will not serve
this output.

The CMS is GitHub-native (ADRs 0008–0013): authors edit in the `/admin`
dashboard, each revision becomes a branch + pull request (`cms/<slug>/r<N>`),
and merging to `main` auto-deploys. There is **no D1, no R2, and no runtime
content database** — GitHub is the durable source of truth. The Worker runs
only the auth routes, the CMS mutation APIs, and the signed deploy callback.

## 1. Set the real site URL

In `astro.config.mjs`, replace the placeholder with your Cloudflare domain:

```js
site: "https://site.gsmandiri-web.workers.dev", // or your custom domain
```

(This only affects canonical URLs, not asset paths — those are already root-relative.)

## 2. Create the SESSION KV namespace

The adapter requires a `SESSION` KV binding for the on-demand CMS routes
(sessions + the deployed-SHA confirmation). Create it once and copy the id into
`wrangler.toml`:

```bash
npx wrangler kv namespace create SESSION
# → copy the "id" value and paste it into wrangler.toml:
#   kv_namespaces = [{ binding = "SESSION", id = "xxxx" }]
```

> `wrangler.toml` deliberately contains **only** `name`, `compatibility_date`,
> `compatibility_flags` and bindings. `compatibility_flags = ["nodejs_compat"]`
> is **required** — Astro's server runtime uses Node globals (`Buffer`,
> `process`, …) that workerd only exposes with this flag; without it every
> request 500s with `Buffer is not defined`.
>
> Do **not** add `main` or `assets` — `@astrojs/cloudflare` injects them from
> the build output into the generated `dist/server/wrangler.json`.

## 3. Set the CMS secrets

Set these as encrypted Worker secrets. Never commit values to `wrangler.toml`.

```bash
wrangler secret put CMS_OWNER_SECRET
# The owner access key entered at /admin/login. Long random value:
openssl rand -hex 32

wrangler secret put CMS_GITHUB_PAT
# GitHub PAT with repository Contents read/write + Pull requests read/write
# permissions. Used server-side for revision branches and PRs; never in the browser.

wrangler secret put CMS_DEPLOY_CALLBACK_URL
# Public URL of /api/cms/deploy/callback on the deployed Worker.

wrangler secret put CMS_DEPLOY_CALLBACK_SECRET
# HMAC secret shared with the deploy workflow (same value as the GitHub
# repository Actions secret of the same name).
```

The browser receives only the opaque `bsm-cms-session` cookie (`HttpOnly`,
`Secure` in production, `SameSite=Lax`, 30-day expiry). `/api/auth/logout`
revokes the session.

Configure these as GitHub repository Actions secrets (Settings → Secrets and
variables → Actions):

- `CLOUDFLARE_API_TOKEN` — scoped to deploy the Worker and Assets.
- `CLOUDFLARE_ACCOUNT_ID` — the Cloudflare account containing the `site` Worker.
- `CMS_DEPLOY_CALLBACK_URL` — same value as the Worker secret.
- `CMS_DEPLOY_CALLBACK_SECRET` — same HMAC secret as the Worker.

## 4. Deploy

The normal path is automatic: `.github/workflows/deploy.yml` runs on **every
push to `main`**, builds the site, deploys with Wrangler, then POSTs a signed
callback (`{commitSha, status}`) so the CMS marks merged revisions as Published.

### Manual first deployment (Wrangler CLI)

```bash
bun install
bun run build
bunx wrangler deploy --config dist/server/wrangler.json
```

For a local smoke test before pushing: `bun run build && bunx wrangler dev`.

### Cloudflare dashboard (Workers Builds, Git-connected) — optional

1. Cloudflare dashboard → **Compute → Workers & Pages → Create application →
   Import a repository** → select `gsmandiriweb/site`.
2. Framework preset: leave blank / "Astro" if offered; set:
   - **Build command:** `npx astro build`
   - **Deploy command:** `npx wrangler deploy --config dist/server/wrangler.json`
   - **Root directory:** `/` (repo root)
3. The `SESSION` KV binding is wired via `wrangler.toml` and baked into the
   generated `dist/server/wrangler.json`.
4. Add `CMS_OWNER_SECRET`, `CMS_GITHUB_PAT`, `CMS_DEPLOY_CALLBACK_URL`, and
   `CMS_DEPLOY_CALLBACK_SECRET` as encrypted Worker secrets.
5. **Save and Deploy.** Preview at `*.workers.dev`, then add a custom domain
   under **Settings → Domains** if desired.

## 5. Verify the CMS

1. Visit `/admin/login`, enter `CMS_OWNER_SECRET`; you land on `/admin`.
2. Edit a post and choose **Save revision & open PR** — a `cms/<slug>/r<N>`
   branch + draft PR appears on GitHub.
3. Review and merge the PR on GitHub. Actions auto-deploys and the callback
   records the deployed SHA; the dashboard upgrades the revision to Published.

## Troubleshooting

- **`The provided Wrangler config main field (.../dist/server/entry.mjs)`
  doesn't point to an existing file** → `wrangler.toml` still declares
  `main`/`assets`. Remove them; the adapter supplies them.
- **`CMS authentication is not configured`** → add `CMS_OWNER_SECRET` and
  `CMS_GITHUB_PAT` Worker secrets, then redeploy.
- **`CMS session storage is unavailable`** → check that the `SESSION` KV id in
  `wrangler.toml` matches a real namespace and that the Worker has access to it.
- **`kv namespace SESSION ... has no id`** → paste the KV id into `wrangler.toml`.
- **PR creation returns 422** → the revision branch already exists or conflicts.
  Reconcile the PR; revision branches are written once per revision.
- **Callback returns 401** → timestamp too old or HMAC mismatch; callbacks must
  be freshly signed (`x-bsm-deploy-timestamp`, `x-bsm-deploy-signature`).
- **Merged but not Published** → inspect the Actions run's callback step;
  verify both callback secrets are byte-for-byte identical.
- **404 on `/_astro/*` or unstyled page** → make sure `base` is removed and
  deploy the current build.
- **HTTP 500 on every route with `Buffer is not defined`** → ensure
  `nodejs_compat` is present in `wrangler.toml`.
- **Hydration mismatches** → disable Cloudflare **Auto Minify** under Speed.
