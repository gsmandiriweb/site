import { handle } from "@astrojs/cloudflare/handler";
import { runScheduledTick } from "./utils/schedule.ts";

// Cloudflare Worker entry: Astro's request handler, plus the `scheduled`
// handler that drains due publish schedules.
//
// `cloudflare.config.ts` points `worker.entrypoint` here. Without that, the
// adapter's generated entry exports `fetch` only and every cron invocation is
// dropped — which is why scheduled publishing had to lean on GitHub Actions
// cron, whose 5-minute schedule this repository only gets honoured for a few
// times a day (see ADR 0014 amendment).
//
// The tick runs in-process: no HTTP hop, no shared secret, no second Worker. It
// reuses the exact dashboard merge path, so a scheduled publish is
// indistinguishable downstream from an approval (same push, deploy, callback,
// Terbit flip).

type ScheduledController = { cron?: string; scheduledTime?: number };
type ScheduledContext = { waitUntil(promise: Promise<unknown>): void };

export default {
  fetch: handle,
  scheduled(_controller: ScheduledController, _env: unknown, ctx: ScheduledContext): void {
    // `waitUntil` keeps the invocation alive until the merges finish. The
    // ticker never throws into the runtime: a failed batch retries on the next
    // cron, and a schedule label stays on its open PR until it merges.
    ctx.waitUntil(
      runScheduledTick().catch((error: unknown) => {
        console.error("cms: scheduled tick failed", error);
      }),
    );
  },
};
