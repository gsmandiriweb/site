import { bindings, defineConfig } from "cf/config";

/**
 * Secret-like files were detected but not read or migrated: .env. Only `secrets.required` entries are migrated.
 * @see https://developers.cloudflare.com/workers/configuration/secrets/
 *
 * The CMS_* values below are declared as secrets (never commit values).
 * Set each at runtime with `wrangler secret put <NAME> --name site`
 * (`cf` cannot set a single secret yet), or upload them with a new version
 * via `cf deploy --secrets-file <PATH>`.
 */

export default defineConfig({
  worker: {
    name: "site",
    compatibilityDate: "2026-04-15",
    compatibilityFlags: ["nodejs_compat"],
    env: {
      SESSION: bindings.kv({
        id: "21a01da3e6264da0a9f7e7dc42c1e874",
      }),
      CMS_OWNER_USERNAME: bindings.secret(),
      CMS_OWNER_PASSWORD: bindings.secret(),
      CMS_OWNER_SECRET: bindings.secret(),
      CMS_GITHUB_PAT: bindings.secret(),
      CMS_GITHUB_API_URL: bindings.secret(),
      CMS_DEPLOY_CALLBACK_URL: bindings.secret(),
      CMS_DEPLOY_CALLBACK_SECRET: bindings.secret(),
    },
  },
});
