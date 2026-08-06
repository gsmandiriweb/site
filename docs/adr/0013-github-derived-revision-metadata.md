# ADR 0013 — GitHub-derived PR and revision metadata

- **Status:** Accepted
- **Date:** 2026-08-06
- **Context:** With D1 removed, the lifecycle metadata from ADR 0009 — revision number, PR number/URL, branch, head SHA, and the content fingerprint for post-merge exact-match verification — needs a durable home. The metadata must survive squash merges, branch deletion, and PR closure. KV was already scoped to sessions and deploy confirmation only (ADR 0010).

## Decision

Derive everything from GitHub itself; no committed manifest, no KV.

- **Metadata home:** revision number from branch naming (`cms/<slug>/r<N>`); PR identity, status, merged state, and head SHA from the PR objects; revision number + content fingerprint from a **versioned structured block in the PR body** (invisible in the GitHub UI):

  ```
  <!-- bsm-cms:revision v1 -->
  storageSlug: <slug>
  revision: <N>
  contentFingerprint: sha256:<hex>
  media: [<path>, …]
  ```

  Written at PR creation, parsed for status reconciliation and the post-merge exact-match check, with a tolerant parser falling back to branch-name parsing when the block is absent.

- **Revision discovery:** list PRs filtered by head prefix `cms/<slug>/` (this survives branch deletion) plus branch listing while branches exist. The live revision is the highest `N` with an open PR; the maximum `N` overall determines the next revision number.
- **Content fingerprint:** SHA-256 of the exact serialized Markdown (frontmatter + body). Media is referenced by path in the block, presence-gated at PR creation (ADR 0011 dangling-reference gate) and verified via the merge tree; media bytes are witnessed by the PR diff, not hashed into the fingerprint.
- **Supersede linkage:** the CMS comments on the superseded PR linking the new one (ADR 0009); PRs are never reopened; merged PRs are immutable.
- **Persistence:** verified against GitHub's own API behavior — head ref/sha survive branch deletion, and title/body persist across squash merges, normal merges, and closure. The 65,536-char PR body limit is ample for the block.
- **Published status:** unchanged — the KV last-deployed SHA plus ancestry check (ADR 0010); orthogonal to this decision.
- **Migration:** none required — the D1 placeholder was never applied to production, so the first revision PR is created from current `main` content.

## Rejected alternatives

- **Committed manifest (`.cms/metadata.json`):** a second source of truth that every revision PR would need to update, introducing write conflicts across concurrent posts for no gain.
- **KV for PR metadata:** TTL'd and ephemeral — it cannot be the durable lifecycle record, and it would violate the ADR 0010 boundary.

## Consequences

`draft-publish.ts` drops its D1 reads and the `cms_draft_pull_requests` table; PR status reconciliation becomes a GitHub read. `publish.ts`'s exact-match check recomputes the SHA-256 of the merged file and compares it to the fingerprint in the PR metadata block (replacing the D1 revision lookup). The dashboard's status view derives Draft → In review → Merged → Published from GitHub plus the KV deployed SHA. `isSafeStorageSlug` derives from the repository's actual blog files instead of the hard-coded allowlist.
