# ADR 0009 — GitHub-native draft-to-PR lifecycle

- **Status:** Accepted
- **Date:** 2026-08-06
- **Context:** The custom BSM CMS edits Markdown posts and repository-backed images, with GitHub as the only durable content source and the public Astro site fully static. The earlier D1-backed draft/PR metadata store was ruled out. This ADR fixes the lifecycle a CMS edit follows from the browser to a reviewed, merged, deployed change — the editorial authority model, the branch/PR topology, and how the CMS proves deployed content came from the reviewed revision.

## Decision

An edit travels: **browser → GitHub branch + PR → review → merge to `main` → CI deploy**.

- **Save semantics:** The editor autosaves continuously to browser storage (per-device, ephemeral, for recovery only). The only action that writes to GitHub is an explicit _save revision & open PR_; GitHub history stays deliberate.
- **Branch topology:** One branch and one pull request per revision: `cms/<slug>/r<N>`. Each revision is a clean, self-contained diff and review unit.
- **PR lifecycle:** Creating a revision while an older revision's PR is open closes the older PR as **superseded** (comment linking the new PR), keeping exactly one live PR per article. Closed-unmerged PRs are never reopened. Merged PRs are immutable — nothing ever writes to a merged revision's branch again.
- **Editorial authority:** Editors (server-enforced role) create revisions and PRs only. The owner merges — via an owner-only merge action in the CMS or directly on GitHub; the CMS deep-links to the PR either way. Deploys always originate from `main` via GitHub Actions; merge and deploy remain separate, auditable steps.
- **Status vocabulary:** **Draft** (browser-local) → **In review** (PR open) → **Merged** (in `main`, queued) → **Published** (deployment-confirmed live). _Published_ is never derived from GitHub alone; its confirmation mechanism is owned by the deployment-boundary decision.
- **Provenance:** At PR creation the CMS records the exact serialized revision content and the PR head SHA. After merge it re-reads the file from `main` and requires an exact content match with the reviewed revision; any drift flags the change _"changed since review"_ rather than presenting it as published.
- **Rollback:** Owner-triggered **revert PR** — the CMS computes the inverse diff of the merged revision and opens a revert PR through the same review/merge/deploy path. No history rewriting.

## Rejected alternatives

- **One branch per article:** keeps a single review thread but makes "what was reviewed" a moving target that would require SHA pinning at approval time; per-revision branches make provenance structural.
- **Autosave writing to GitHub:** fills GitHub history with noise and undermines explicit review.
- **Direct-to-main writes:** skips the reviewed, auditable path every production change must follow.
- **Reopening closed PRs:** blurs which revision owns the review; a fresh PR per revision is unambiguous.

## Consequences

PR/revision metadata (revision number, PR identity, head SHA, content fingerprint) can no longer live in D1; its GitHub-native home is a separate pending decision. Implementation must add: merge-time guard that refuses a PR whose head drifted from the reviewed revision, supersede comment behavior, revert-diff computation, and a deployment-confirmation hook for the _Published_ state.
