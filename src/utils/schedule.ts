import {
  configuredGitHubPat,
  configuredScheduleSecret,
  runtimeEnv,
  secretsMatch,
} from "./admin-session.ts";
import { DraftActionError } from "./cms-drafts.ts";
import { apiUrlFor, listScheduledRevisions, mergeDraftPullRequest } from "./draft-publish.ts";

// Unattended schedule ticker: merge every revision PR whose schedule label
// is due. Merges reuse the exact dashboard path (fingerprint guard,
// ready-for-review promotion, merge commit), so a scheduled publish is
// indistinguishable from an approval downstream: same push, same CI deploy,
// same signed callback, same Terbit flip.
export const TICK_BATCH_LIMIT = 10;

export type TickResult = {
  storageSlug: string;
  revision: number;
  prNumber: number;
  scheduledAt: string;
  ok: boolean;
  mergedRevision?: number;
  error?: string;
};

// The tick caller is GitHub Actions, not a browser: no admin session exists.
// Authentication is the shared schedule secret over a header, compared
// timing-safe like the deploy callback. A missing secret is a 503 (ticker
// not configured), never a silent pass.
export async function verifyTickSecret(request: Request): Promise<void> {
  const expected = await configuredScheduleSecret();
  if (!expected) throw new DraftActionError("Penjadwalan belum dikonfigurasi.", 503);
  const provided = request.headers.get("x-bsm-schedule-secret");
  if (!provided || !(await secretsMatch(provided, expected)))
    throw new DraftActionError("Invalid schedule tick signature.", 401);
}

export async function runScheduledTick(now: number = Date.now()): Promise<{
  checkedAt: string;
  results: TickResult[];
}> {
  const pat = await configuredGitHubPat();
  if (!pat) throw new DraftActionError("Akses GitHub CMS belum dikonfigurasi.", 503);
  const env = await runtimeEnv();
  const apiUrl = apiUrlFor(env);
  const due = (await listScheduledRevisions(apiUrl, pat))
    .filter((entry) => Date.parse(entry.scheduledAt) <= now)
    .slice(0, TICK_BATCH_LIMIT);
  const results: TickResult[] = [];
  for (const entry of due) {
    try {
      // Re-resolves the latest open PR per slug: a newer revision created
      // after the listing still merges correctly, and the report reflects
      // what actually merged rather than what was listed.
      const merged = await mergeDraftPullRequest(null, entry.storageSlug);
      results.push({
        storageSlug: entry.storageSlug,
        revision: entry.revision,
        prNumber: entry.prNumber,
        scheduledAt: entry.scheduledAt,
        ok: true,
        mergedRevision: merged.revision,
      });
    } catch (error) {
      // One post's failure never aborts the rest of the batch. The schedule
      // label stays on the open PR, so the next tick retries; the dashboard
      // surfaces the error on the next visit.
      results.push({
        storageSlug: entry.storageSlug,
        revision: entry.revision,
        prNumber: entry.prNumber,
        scheduledAt: entry.scheduledAt,
        ok: false,
        error: error instanceof Error ? error.message : "Tidak dapat menggabungkan revisi.",
      });
    }
  }
  return { checkedAt: new Date(now).toISOString(), results };
}
