import { bindings, defineConfig } from "cf/config";

/**
 * Secret-like files were detected but not read or migrated: .env. Only `secrets.required` entries are migrated.
 * @see https://developers.cloudflare.com/workers/configuration/secrets/
 *
 * Only secrets ALREADY SET on the Worker may be declared below:
 * `bindings.secret()` means *required* — `cf deploy` refuses to ship when a
 * declared secret has no value. Set each with
 * `wrangler secret put <NAME> --name site` (`cf` cannot set a single secret
 * yet), or upload them with a version via `cf deploy --secrets-file <PATH>`.
 * Never commit values here.
 *
 * Deliberately NOT declared (read defensively by the code, so the Worker runs
 * without them):
 * - CMS_OWNER_USERNAME / CMS_OWNER_PASSWORD — pending, see deploy-runbook §1.1.
 *   Declare them here only AFTER setting them on the Worker.
 * - CMS_GITHUB_API_URL — optional, the code defaults to https://api.github.com.
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
      CMS_OWNER_SECRET: bindings.secret(),
      CMS_GITHUB_PAT: bindings.secret(),
      CMS_DEPLOY_CALLBACK_URL: bindings.secret(),
      CMS_DEPLOY_CALLBACK_SECRET: bindings.secret(),
    },
  },
});
