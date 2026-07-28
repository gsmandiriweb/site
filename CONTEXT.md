# Context — Bangun Sarana Makmur (BSM) site

A glossary for the BSM marketing site. Implementation-free; terms only.
When a term is resolved, capture it here. See `docs/adr/` for decisions.

## Glossary

### Catalog & products

- **Category** — one of six construction-function families (atap, dinding, pintu, struktur, pagar, utilitas). The breadth view. A category page lists its product _lines_; it does not show specs unless it has a Showcase.
- **Line** — a named product within a category (e.g. "Atap Alderon", "Bondek"). Listed as text on the category page. A line has no rich data until it becomes a Showcase.
- **Product (simple)** — the flat card shape shown on category pages: `{ slug, name, image, spec }`. A _projection_ derived from a Showcase when one exists; otherwise a hand-authored entry.

### Showcase (the rich detail treatment)

- **Showcase** — a product line rich enough to earn its own detail page: it has real photography (multiple angles) and real authored specs. Opt-in per category. BRC is the first and current showcase (`/pagar-brc`). A category opts into the showcase treatment only when it has a `specs` field per item — never fabricated (PRODUCT.md principle #4).
- **ShowcaseItem** — one product within a showcase: its `angles` (1+ photos), `specs` (key/value), optional `callouts`, and `waContext` (the pre-filled WhatsApp message for that item).
- **SpecEntry** — a key/value spec pair. Canonical keys (the precedent for every future showcase): `Dimensi`, `Diameter Kawat`, `Mesh`, `Finishing`, `Asal`. Keys are optional per product — omit what does not apply; never use a `—` placeholder.
- **Callout** — an on-photo dimension or leader annotation on a specimen image. Its _value_ is drawn from the item's `specs` (shared, never re-typed); its _placement_ (coordinates, callout type) is authored per photo. Optional — only where the geometry genuinely reads on the photo.
- **ProofPhoto** — a contextual "in the field" photo (installed outdoors, warehouse stock) belonging to the _line_, not to a single product. Rendered in the "Di Lapangan" grid, distinct from specimen photography.

### Page surfaces

- **Specimen stage** — the interactive zone of a showcase page: product selector + angle carousel + on-photo callout overlay + spec table + per-product WhatsApp CTA. The "inspect the spec" surface. All four render from one `selectedProduct` state.
- **Di Lapangan** — the static proof-photo grid on a showcase page ("in the field"). Pinned photographs on a drafting sheet, not a second slider. Distinct from the specimen stage.
- **Projection** — the function deriving simple category cards from a showcase (`angles[0]` → card image, `specs` → `·`-joined spec string). Guarantees a single source of truth: the category card is a read-only summary of the detail page, never an independent fact.

### Image roles (from DESIGN.md)

- **Specimen photography** — a dimensioned product shot, treated as an engineering drawing (title block, dimension lines, callouts). The "proof" image.
- **Proof / contextual photography** — installed or warehouse stock photos showing the product exists in the real world. Belongs to the line, not a single product.
