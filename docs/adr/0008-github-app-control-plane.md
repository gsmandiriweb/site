# ADR 0008 — GitHub App control plane for the static CMS

- **Status:** Accepted
- **Date:** 2026-08-06
- **Context:** BSM's public Astro site is fully static and GitHub is the canonical source for Markdown posts and repository-backed images. The custom CMS needs a server-side mutation boundary to create branches, commit content, and open pull requests without exposing a repository credential to the browser. A fine-grained PAT is tied to one person's account; GitHub OAuth authenticates a human but is the wrong identity for unattended repository mutation.

## Decision

Use a GitHub App installation token as the CMS's repository mutation identity.

- Store the App ID and private key only as Cloudflare Worker secrets.
- Mint short-lived installation access tokens server-side when calling GitHub.
- Request only the target repository permissions needed by the workflow: `Contents: read/write` and `Metadata: read`; add `Pull requests: read/write` when the CMS creates or reconciles PRs.
- Keep human editor authentication separate from the App identity. The existing owner-secret session is an interim access gate; production roles and authorization must be enforced server-side, not by the dashboard's cosmetic role selector.
- Protect every cookie-authenticated mutation with secure HttpOnly cookies, same-origin/CSRF defenses, and rate limiting. GitHub credentials never reach the browser.

## Rejected alternatives

- **Fine-grained PAT:** acceptable for a short-lived bootstrap, but tied to a human account and manually rotated; not the production mutation identity.
- **GitHub OAuth user token:** appropriate for authenticating a human, but not as the CMS's repository-wide automation identity; its permissions and lifecycle follow the user.
- **Direct browser-to-GitHub calls:** rejected because they expose repository credentials and make the CMS boundary impossible to enforce.

## Consequences

The public site remains static and GitHub remains the only durable content source. The admin mutation layer still requires a small Cloudflare Worker runtime. Future implementation must add GitHub App JWT signing/token exchange, server-side role mapping, token caching with expiry safety, rate limiting, and deployment-secret validation. The current PAT-based code is transitional and must be removed before production use.
