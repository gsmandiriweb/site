# ADR 0014 — Batch publish and scheduled publish

- **Status:** Accepted
- **Date:** 2026-10-14
- **Context:** Publishing is one revision PR per approve-and-merge. Owners need (1) merging several ready revisions at once and (2) unattended publishing at a chosen time, both without new infrastructure or stores.

## Decision

- **Batch publish** loops the exact single-merge path per post (fingerprint guard, ready-for-review promotion, merge commit), sequentially, cap 10 per request. One post's failure never aborts the rest; per-post results return to the dashboard for a summary notice. Each merge pushes to `main`, so CI deploys serialize behind the workflow concurrency group.
- **Scheduled publish = scheduled merge, not scheduled content.** The schedule lives on the open revision PR as a `cms-schedule:<UTC ISO>` label — no new store, visible on GitHub, dies with the PR. A new revision carries a still-pending schedule forward with a dashboard notice; schedules on already-merged PRs never leak onto fresh work.
- **The ticker is GitHub Actions cron (every 5 min), not a Worker cron.** It POSTs a shared-secret-authenticated tick endpoint; the Worker lists due schedules and merges with the dashboard's merge function, so scheduled and manual publishes are indistinguishable downstream (same push, deploy, callback, Terbit flip). Worker cron was rejected pending an adapter spike; the endpoint makes the trigger swappable later.
- **Callback ordering guard.** Concurrent deploys (batch/scheduled bursts) can post callbacks out of order, so a callback only moves the live boundary when its SHA is equal to or newer than the stored one (compare API); otherwise the previous confirmation stands. Unverifiable ordering fails open to the plain overwrite.

## Consequences

- New Worker secret + GitHub Actions secret: `CMS_SCHEDULE_SECRET` (shared tick auth). Past instants mean "publish ASAP" on the next tick — no special case.
- Published expectation: live within ~5–7 min of the scheduled time (tick granularity + deploy), never the exact minute.
- GitHub disables cron after 60 days of zero repo activity; the CMS repo merges regularly, so this is a runbook note, not a risk.
