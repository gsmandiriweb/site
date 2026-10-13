import { bindings, defineConfig } from "cf/config";

/**
 * Secret-like files were detected but not read or migrated: .env. Only `secrets.required` entries are migrated.
 * @see https://developers.cloudflare.com/workers/configuration/secrets/
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
    },
  },
});
