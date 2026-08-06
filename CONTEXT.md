# Context — Bangun Sarana Makmur (BSM) site

A glossary for the BSM marketing site. Implementation-free; terms only.
When a term is resolved, capture it here. See `docs/adr/` for decisions.

## Glossary

### Catalog & products

- **Category** — one of six construction-function families (atap, dinding, pintu, struktur, pagar, utilitas). The breadth view. A category page lists its product _lines_; it does not show specs unless it has a Showcase.
- **Line** — a named product within a category (e.g. "Atap Alderon", "Bondek"). Listed as text on the category page. A line has no rich data until it becomes a Showcase.
- **Product (simple)** — the flat card shape shown on category pages: `{ slug, name, image, spec }`. A _projection_ derived from a Showcase when one exists; otherwise a hand-authored entry.

### Showcase (the rich detail treatment)

- **Showcase** — a product line rich enough to earn its own detail page: it has real photography (multiple angles) and real authored specs. Opt-in per category. BRC is the first and current showcase (`/pagar-brc`). A category opts into the showcase treatment only when it has a `specs` field per item — never fabricated (PRODUCT.md principle #4). A line earns a Showcase only when the client supplies real multi-angle photography + confirmed specs; a single stock thumbnail is not enough (a thin single-image "showcase" is worse than an honest line row).
- **ShowcaseItem** — one product within a showcase: its `angles` (1+ photos), `specs` (key/value), optional `callouts`, and `waContext` (the pre-filled WhatsApp message for that item).
- **SpecEntry** — a key/value spec pair. Canonical keys (the precedent for every future showcase): `Dimensi`, `Diameter Kawat`, `Mesh`, `Finishing`, `Asal`. Keys are optional per product — omit what does not apply; never use a `—` placeholder.
- **Callout** — an on-photo dimension or leader annotation on a specimen image. Its _value_ is drawn from the item's `specs` (shared, never re-typed); its _placement_ (coordinates, callout type) is authored per photo. Optional — only where the geometry genuinely reads on the photo.
- **ProofPhoto** — a contextual "in the field" photo (installed outdoors, warehouse stock) belonging to the _line_, not to a single product. Rendered in the "Di Lapangan" grid, distinct from specimen photography.
- **Claim-free proof system** — BSM's evidence-first proof hierarchy: (1) real product photography paired with confirmed specs, (2) contextual warehouse or installed photography with neutral captions describing only what is visible, (3) the real catalog breadth and category structure, and (4) a short operational handoff explaining that the buyer sends product, quantity, and location through WhatsApp and the sales team verifies the quote, stock, and delivery details. It does not include testimonials, named projects, client logos, certification badges, performance guarantees, or unverified numerical milestones.

### Buyer intent

- **Buyer intent** — the lightweight context a visitor gives before requesting a quote. The landing offers two secondary paths: **untuk proyek / pengadaan** and **untuk rumah / renovasi**. Both continue to the same RFQ/WhatsApp flow; the choice may tailor context, but never creates separate product systems or blocks the primary quote path.

### CMS & publishing

- **CMS control plane** — the authenticated server-side boundary that lets human editors manage repository content without exposing GitHub credentials to the browser. It is not the public site and does not own content independently of GitHub.
- **Repository mutation identity** — the GitHub App installation identity used by the CMS control plane to read and write this repository. It is separate from the human editor identity and from editorial roles.
- **Draft revision** — a version of a Markdown post and its repository-backed media intended for review in a GitHub pull request. Git history is the durable revision record; no runtime content database is required.
- **Draft** — article state that exists only in the editor's browser (locally autosaved for recovery). Never on GitHub; the only path to GitHub is an explicit save.
- **Revision** — a snapshot of an article's content and its repository-backed media, captured to GitHub as its own branch (`cms/<slug>/r<N>`) and pull request. The unit of review: exactly one live PR per article at a time.
- **Superseded** — the status of a closed-unmerged pull request replaced by a newer revision's PR. Superseded PRs are never reopened; the newest revision owns the review.
- **Merged** — a revision whose pull request has been merged into `main`; queued for deployment.
- **Published** — a merged revision whose deployment is confirmed live. Never derived from GitHub alone; requires deployment confirmation.
- **Revert PR** — the rollback unit: a pull request carrying the inverse diff of a merged revision, reviewed and merged through the normal path.
- **Runtime surface** — the small enumerated set of on-demand routes of the CMS control plane (auth, CMS mutations, deployment callback) served by the Cloudflare Worker. Everything else on the public site is pre-rendered static output.
- **Deploy confirmation** — the signed callback from the CI deploy workflow recording the deployed commit SHA; it is what upgrades a revision from **Merged** to **Published**.
- **Media contract** — the rules governing images committed with Markdown posts: per-post folder under `src/images/blog/<slug>/`, explicit path references, JPEG/PNG/WebP only with file-size and dimension caps, sanitized CMS-generated filenames, required alt text, and no dangling references at pull-request creation.
- **Featured image** — a post's cover image: `cover.<ext>` in the post's media folder, referenced by the frontmatter `image` field with a required `imageAlt`.
- **Media upload** — the ADR 0011 endpoint (`/api/cms/media`): validates magic bytes and 5 MB / 8000 px limits server-side, commits the file into `src/images/blog/<slug>/` on the pending revision branch, and returns the CMS-generated filename.
- **Dangling-reference gate** — the PR-creation check (ADR 0011) that resolves every `image:` and `![…](…)` reference against the revision branch (with a legacy-pool basename fallback) and refuses to open the PR if any reference is unresolvable.
- **Dangling reference** — an image reference (frontmatter `image` or a Markdown `![...]`) with no matching file in the revision; the CMS refuses to create a pull request that contains one.
- **Canonical editor** — the BSM CMS dashboard, the sole authoring surface for Markdown posts and their media. Keystatic and Decap are not part of the CMS destination.
- **PR metadata block** — the versioned structured block in a pull request body (`<!-- bsm-cms:revision v1 -->`) carrying storage slug, revision number, content fingerprint, and media paths. GitHub itself is the durable metadata store.
- **Content fingerprint** — the SHA-256 of a revision's exact serialized Markdown, recorded in the PR metadata block and used for post-merge exact-match verification.

### Page surfaces

- **Specimen stage** — the interactive zone of a showcase page: product selector + angle carousel + on-photo callout overlay + spec table + per-product WhatsApp CTA. The "inspect the spec" surface. All four render from one `selectedProduct` state.
- **Di Lapangan** — the static proof-photo grid on a showcase page ("in the field"). Pinned photographs on a drafting sheet, not a second slider. Distinct from the specimen stage.
- **Projection** — the function deriving simple category cards from a showcase (`angles[0]` → card image, `specs` → `·`-joined spec string). Guarantees a single source of truth: the category card is a read-only summary of the detail page, never an independent fact.
- **Catalog browser** — the unified `/katalog` surface: every line across all six categories, searchable and filterable by category, in one view. Mixed density: lines with a Showcase render as rich specimen cards; lines without render as compact line rows. The "show the breadth" surface (PRODUCT.md principle #3).
- **Line row** — the compact card shape for a line that has no Showcase: name + category tag + WhatsApp RFQ CTA, no image, no specs. The row itself is the CTA. Upgrades to a rich card automatically when its line earns a Showcase (via the Projection).
- **Quote configurator** — the `/penawaran` surface that collects buyer intent (category, product, quantity+unit, location, buyer role, notes) and composes a pre-filled WhatsApp RFQ. It _collects_, never _computes_: no price, tonnage, stock, or lead time. When the selected product has a Showcase, its known specs are auto-injected into the message as context.
- **Bounded quantity helper** — the first deliberately narrow estimator enhancement: for a BRC panel request, it may estimate the minimum panel count from a visitor-supplied fence run length using the known 240 cm panel width (`ceil(length ÷ 2.4 m)`). It must show the assumption and label the result as an estimate; it excludes posts, gates, corners, slopes, waste, installation, engineering compliance, price, stock, and delivery. The result and assumptions flow into the existing `/penawaran` WhatsApp RFQ; it is not a separate calculator or product system.

### Image roles (from DESIGN.md)

- **Specimen photography** — a dimensioned product shot, treated as an engineering drawing (title block, dimension lines, callouts). The "proof" image.
- **Proof / contextual photography** — installed or warehouse stock photos showing the product exists in the real world. Belongs to the line, not a single product.
