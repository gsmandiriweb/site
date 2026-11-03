# ADR 0014 — Batch publish and scheduled publish

- **Status:** Accepted
- **Date:** 2026-10-14
- **Context:** Publishing is one revision PR per approve-and-merge. Owners need (1) merging several ready revisions at once and (2) unattended publishing at a chosen time, both without new infrastructure or stores.

## Decision

- **Batch publish** loops the exact single-merge path per post (fingerprint guard, ready-for-review promotion, merge commit), sequentially, cap 10 per request. One post's failure never aborts the rest; per-post results return to the dashboard for a summary notice. Each merge pushes to `main`, so CI deploys serialize behind the workflow concurrency group.
- **Scheduled publish = scheduled merge, not scheduled content.** The schedule lives on the open revision PR as a `cms-schedule:<UTC ISO>` label — no new store, visible on GitHub, dies with the PR. A new revision carries a still-pending schedule forward with a dashboard notice; schedules on already-merged PRs never leak onto fresh work.
- **The ticker is GitHub Actions cron (every 5 min), not a Worker cron.** _(Superseded — see the second amendment: GitHub's `schedule` is best-effort and ran ~4×/day here; the tick now runs on a Cloudflare Cron Trigger.)_ It POSTs a shared-secret-authenticated tick endpoint; the Worker lists due schedules and merges with the dashboard's merge function, so scheduled and manual publishes are indistinguishable downstream (same push, deploy, callback, Terbit flip). Worker cron was rejected pending an adapter spike; the endpoint makes the trigger swappable later.
- **Callback ordering guard.** Concurrent deploys (batch/scheduled bursts) can post callbacks out of order, so a callback only moves the live boundary when its SHA is equal to or newer than the stored one (compare API); otherwise the previous confirmation stands. Unverifiable ordering fails open to the plain overwrite.

## Consequences

- New Worker secret + GitHub Actions secret: `CMS_SCHEDULE_SECRET` (shared tick auth). Past instants mean "publish ASAP" on the next tick — no special case.
- Published expectation: live within ~5–7 min of the scheduled time (tick granularity + deploy), never the exact minute.
- GitHub disables cron after 60 days of zero repo activity; the CMS repo merges regularly, so this is a runbook note, not a risk.

## Amendment (2026-11-03) — the scheduled revision must be publishable, and early merge is explicit

Scheduled publishing worked as designed on the GitHub side and still read as broken from the dashboard, for two reasons worth writing down:

- **A schedule on a `status: draft` revision merged into an invisible article.** The public site renders only `status: published` (`utils/blog.ts:isPublicBlogEntry`), and the revision PR carried whatever the editor's Status select said — "Draf · tidak tampil di situs" by default. Merging it produced a merged PR, a deploy, a green callback, and no article on the site. Scheduling is therefore now a _single action_ that (1) saves the current article as a revision, opening the PR if none is open, authored as `status: published`; (2) attaches the schedule label to that PR. The revision, not the live file, is what changes state "right away" — the article stays absent from the site until the merge lands, which is the promise the editor actually made.
- **The only approval button published immediately.** "Setujui & gabungkan" merged the PR on the spot, ahead of the schedule, with no indication it had overridden it. `mergeDraftPullRequest` now refuses a merge while a schedule is still pending (`scheduleIsPending`) unless the caller passes an explicit override, and the dashboard only passes it from a distinct "Terbitkan sekarang" action after a confirmation that names the schedule being cancelled.

The dashboard also reports whether the ticker can authenticate at all (`scheduleTickerReady`, from whether `CMS_SCHEDULE_SECRET` is set): a schedule that nobody will ever read is a false promise, so the publication panel says so instead of showing a countdown.

Removal is a separate pair of operations and is deliberately not a revision: `POST /api/cms/posts/remove` with `mode: "draft"` rewrites `status: draft` on `main` (the file stays, the site stops rendering it), and `mode: "delete"` deletes the Markdown file from `main`. Both close the post's open revision PRs — which also drops the schedule label — so a pending tick cannot put the article back minutes later. Post media under `src/images/blog/<slug>/` is left in place: it is inert without the file, and a wrong deletion is not recoverable from the CMS.

## Amendment (2026-11-03, second) — the ticker moves from GitHub cron to a Cloudflare Cron Trigger

The ticker was correct and the trigger was not. Measured on this repository: `.github/workflows/schedule.yml` declares `cron: "*/5 * * * *"`, but the workflow ran **4 times a day** — 30 runs in 7 days with gaps of 3–10 hours (last run 01:48Z, then nothing until a manual dispatch at 07:22Z). A post scheduled for 14:00 WIB (07:00Z) therefore sat unmerged at 14:16 WIB with every part of the pipeline healthy: PR open, draft, label `cms-schedule:2026-11-03T07:00:00.000Z`, secret set, and the tick endpoint returning `200` when invoked by hand. GitHub's `schedule` event is best-effort and, on a repo this size, it coalesces a 5-minute cron into a few runs a day. No amount of workflow editing fixes that; the granularity simply is not available.

The Worker now runs the tick itself:

- `cloudflare.config.ts` sets `worker.triggers = [triggers.scheduled({ schedule: "*/5 * * * *" })]` and `worker.entrypoint = "./src/worker.ts"`.
- `src/worker.ts` exports `{ fetch: handle, scheduled }`: the adapter's own request handler plus a `scheduled` handler that calls `runScheduledTick()` in-process (no HTTP hop, no shared secret, no second Worker). Without a custom entry the adapter's generated module exports `fetch` only, so a cron invocation would find no `scheduled` handler and be dropped.
- The cron fires on a minute-granular scheduler that is part of the deployment, so the schedule travels with the app and cannot silently stop. `cf deploy --prebuilt` reproduces the trigger from the build output.
- `.github/workflows/schedule.yml` is kept as a **fallback**, not the primary: the tick is idempotent (it merges only PRs whose label is due and re-lists before merging), so two triggers racing is a no-op, and a GitHub run still covers a period when the Worker cron is unavailable.

The ~5-minute expectation still holds, now bounded by the cron granularity plus the deploy (~1–2 min), and it is actually met: a scheduled publish merges within ~5 minutes of its instant instead of waiting for a lucky GitHub run.
