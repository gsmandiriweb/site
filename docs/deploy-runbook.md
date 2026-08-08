# Deploy Runbook — BSM Site + CMS

Operational checklist for deploying the public site and the GitHub-native CMS.
Complements the full guide in [`deploy-cloudflare.md`](./deploy-cloudflare.md) —
use this when actually shipping.

> **Last verified:** 2026-08-07 (first production deploy succeeded).
> Worker secrets are set; GitHub Actions secrets are still pending (see §1.2).

## Architecture in one paragraph

Astro 7 static site on **Cloudflare Workers + Assets** (Worker `site`, account
`d2856251d33378b2df9c712b9bee40d6`, live at `https://site.gsmandiri-web.workers.dev`).
GitHub is the only durable content store — no D1/R2. The Worker runs only the CMS
control-plane routes (`/admin`, `/api/cms/*`, signed deploy callback). Every merge
to `main` triggers `.github/workflows/deploy.yml`, which builds, deploys, then POSTs
the deployed commit SHA to a signed callback so the CMS marks revisions **Published**
(ADR 0010).

---

## 1. Secrets checklist

### 1.1 Cloudflare Worker secrets — ✅ set (2026-08-07)

Set with `wrangler secret put <NAME> --name site` (value via stdin). Never commit values.

| Secret                       | Purpose                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `CMS_OWNER_SECRET`           | Owner key for `/admin/login` (64-char hex)                                    |
| `CMS_GITHUB_PAT`             | GitHub PAT, repo **Contents r/w + Pull requests r/w** (server-side mutations) |
| `CMS_DEPLOY_CALLBACK_URL`    | `https://site.gsmandiri-web.workers.dev/api/cms/deploy/callback`              |
| `CMS_DEPLOY_CALLBACK_SECRET` | HMAC key — **must match** the GitHub Actions secret byte-for-byte             |

The generated values are saved locally in the gitignored `.env`
(`CMS_OWNER_SECRET`, `CMS_DEPLOY_CALLBACK_SECRET`, `CMS_GITHUB_PAT`).

### 1.2 GitHub Actions secrets — ⚠️ pending (set in the UI)

Repo → **Settings → Secrets and variables → Actions**. The `gh` CLI token lacks the
repo-secrets permission (403), so these must be added in the dashboard:

| Secret                       | Value                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`       | Create: Cloudflare dashboard → My Profile → **API Tokens → Create Token** → "Edit Cloudflare Workers" template |
| `CLOUDFLARE_ACCOUNT_ID`      | `d2856251d33378b2df9c712b9bee40d6`                                                                             |
| `CMS_DEPLOY_CALLBACK_URL`    | `https://site.gsmandiri-web.workers.dev/api/cms/deploy/callback`                                               |
| `CMS_DEPLOY_CALLBACK_SECRET` | Copy from `.env` — identical to the Worker secret                                                              |

> If `CMS_DEPLOY_CALLBACK_SECRET` differs between the Worker and GitHub, merges deploy
> fine but revisions stay stuck at "Merged" instead of flipping to "Published".

### 1.3 Infrastructure (already provisioned)

- `SESSION` KV namespace: id `21a01da3e6264da0a9f7e7dc42c1e874` (in `wrangler.toml`)
- `site` Worker exists in the `gsmandiri-web` account (deploys update it)
- `nodejs_compat` compatibility flag in `wrangler.toml` (**required** — no `main`/`assets` keys; the Astro adapter injects them)

---

## 2. First deploy / manual redeploy

```bash
bun install
bun run build                 # emits dist/client + dist/server + dist/server/wrangler.json
bunx wrangler deploy --config dist/server/wrangler.json
```

- Auth: `wrangler login` (OAuth) or `CLOUDFLARE_API_TOKEN` env var.
- The deploy updates the existing `site` Worker; assets are content-addressed, so
  only changed files upload.
- Smoke-test locally first: `bun run build && bunx wrangler dev`.

**Automatic path** (normal operation): push/merge to `main` → `deploy.yml` builds with
bun, deploys, and reports the SHA via the signed callback. No manual step.

---

## 3. Verification flow

### 3.1 Live-site smoke checks

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://site.gsmandiri-web.workers.dev/          # 200
curl -s  https://site.gsmandiri-web.workers.dev/ | grep -o 'HARGA PABRIK[^<]*' | head -1 # current hero
curl -s -o /dev/null -w '%{http_code}\n' https://site.gsmandiri-web.workers.dev/admin/login
bunx wrangler deployments list --name site   # latest deployment is the newest row (list is oldest-first)
```

> Right after a deploy the edge may serve a stale HTML once (`Cache-Control: public,
max-age=0, must-revalidate`); re-request or add a query param to bypass.

### 3.2 CMS end-to-end (do after every secrets change)

1. Open `/admin/login`, enter `CMS_OWNER_SECRET` → lands on `/admin`.
2. Edit a post → **Save revision & open PR** → a `cms/<slug>/r<N>` branch + draft PR appears on GitHub.
3. Merge the PR → Actions deploys → callback records the SHA → revision flips to **Published**.

### 3.3 After pushing to main

- Watch the `Deploy BSM site` Actions run: build → deploy → callback step.
- The GitHub Pages fallback workflow (`deploy-gh-pages.yml`, static-only, CMS routes
  excluded) also runs on push — it is a fallback, not the canonical deploy.

---

## 4. Troubleshooting (quick)

| Symptom                                 | Fix                                                                |
| --------------------------------------- | ------------------------------------------------------------------ |
| `CMS authentication is not configured`  | Add `CMS_OWNER_SECRET` + `CMS_GITHUB_PAT` Worker secrets, redeploy |
| Merged but not Published                | Callback secrets differ — compare Worker vs GitHub value           |
| Callback 401                            | HMAC/timestamp mismatch; callback must be freshly signed           |
| Every route 500 `Buffer is not defined` | `nodejs_compat` missing from `wrangler.toml`                       |
| `main` field error at deploy            | `main`/`assets` present in `wrangler.toml` — remove them           |

Full troubleshooting and the optional Cloudflare dashboard (Workers Builds) setup:
see [`docs/deploy-cloudflare.md`](./deploy-cloudflare.md).
