# Deploy to Cloudflare (Workers + Assets)

This site is an Astro 7 static site with the `@astrojs/cloudflare` adapter
(needed so the Keystatic `/keystatic` admin renders on-demand). The adapter
emits a **split build**: static assets in `dist/client/`, the Worker in
`dist/server/`. Deploy it as a **Cloudflare Worker + Assets** — not classic
Cloudflare Pages, which expects a flat `dist/_worker.js` and will not serve
this output.

## Why the CSS broke on the first try

The earlier GitHub-Pages config set `base: "/site"`, which prefixed every
asset URL with `/site/` (`/site/_astro/...`). Cloudflare serves at the root,
so those requests 404'd and the page loaded unstyled. `base` has been removed
in `astro.config.mjs`, so assets are now root-relative (`/_astro/...`).

## 1. Set the real site URL

In `astro.config.mjs`, replace the placeholder with your Cloudflare domain:

```js
site: "https://second-shepherd.pages.dev", // or your custom domain
```

(This only affects canonical URLs, not asset paths — those are already root-relative.)

## 2. Create the SESSION KV namespace

The adapter requires a `SESSION` KV binding for on-demand rendering. Create it
once and copy the id into `wrangler.toml`:

```bash
npx wrangler kv namespace create SESSION
# → copy the "id" value and paste it into wrangler.toml:
#   kv_namespaces = [{ binding = "SESSION", id = "xxxx" }]
```

(Cloudflare Images is optional and disabled — this site serves images from the
repo. Uncomment the `[images]` block in `wrangler.toml` only if you adopt
Cloudflare Images.)

> `wrangler.toml` deliberately contains **only** `name`, `compatibility_date`
> and bindings. Do **not** add `main` or `assets` — `@astrojs/cloudflare`
> injects them from the build output into the generated
> `dist/server/wrangler.json`. Setting them manually breaks `astro build`,
> because the entry does not exist yet when the adapter validates the config.

## 3. Deploy

### Option A — Dashboard (Workers Builds, Git-connected)

1. Cloudflare dashboard → **Compute → Workers & Pages → Create application →
   Import a repository** → select `gsmandiriweb/site`.
2. Framework preset: leave blank / "Astro" if offered; set:
   - **Build command:** `npx astro build`
   - **Deploy command:** `npx wrangler deploy --config dist/server/wrangler.json`
   - **Root directory:** `/` (repo root)
3. (Optional) You can also add the `SESSION` KV binding under **Settings →
   Bindings**, but it is already wired via `wrangler.toml` and baked into the
   generated `dist/server/wrangler.json`, so the deploy above already includes
   it.
4. **Save and Deploy.** Preview at `*.workers.dev`, then add a custom domain
   under **Settings → Domains** if desired.

> The build image uses Node/npm. The repo's `package.json` build script is
> plain `astro build`, so `npx astro build` works without `bun` on CI.

### Option B — Wrangler CLI (local)

```bash
npx astro build
npx wrangler deploy --config dist/server/wrangler.json
```

For a local smoke test before pushing: `npx astro build && npx wrangler dev`.

## 4. Connect Keystatic (after the site is live)

Visit `/keystatic` on the deployed URL. The first load prompts **Create GitHub
App** — grant it access to `gsmandiriweb/site`. That finishes the GitHub-mode
auth (no Netlify involved). Locally you can do the same at
`http://localhost:4321/keystatic` with `bun run dev`.

## Troubleshooting

- **`The provided Wrangler config main field (.../dist/server/entry.mjs)
doesn't point to an existing file`** → `wrangler.toml` still declares
  `main`/`assets`. Remove them; the adapter supplies them and writes
  `dist/server/wrangler.json` at build end.
- **`kv namespace SESSION ... has no id`** → you deployed before pasting the
  KV id from step 2 into `wrangler.toml`.
- **404 on `/_astro/*` or unstyled page** → still on the old `base: "/site"`
  build; make sure you deployed the current commit (base removed).
- **`Could not resolve "node:..."`** → a dependency uses a Node API the
  Cloudflare runtime lacks; check the package for `node:` import support.
- **Hydration mismatches** → disable Cloudflare **Auto Minify** under Speed.
