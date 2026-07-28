# ADR 0001 — BRC showcase: Embla + Showcase model + dedicated route

- **Status:** Accepted
- **Date:** 2025-07-27
- **Context:** BSM product catalog, BRC fencing flagship

## Context

The site had no detailed product showcasing — category pages showed a flat
`prod-row` of link-cards (one image, one spec string, a WhatsApp deep-link) and
no way to inspect a product's spec or see multiple angles. BRC fencing is the
declared flagship (PRODUCT.md) with the richest real photography (15 photos:
11 specimen angles across 6 products + 4 installed/stock proof shots) and real
authored specs.

A 3D / three.js approach was considered and rejected: it fights the
"Blueprint Field" design system (flat, drafting-sheet, anti-luxury-showroom,
"structure is never decoration") and adds ~600KB to a mobile-first WhatsApp
quote funnel. The job is _inspect the spec_, not _spin the product_.

## Decision

1. **Carousel library: Embla Carousel** (vanilla core, ~3KB, headless, zero-dep).
   Chosen over Splide/Swiper/Glider because the drafting-sheet aesthetic demands
   headless control over every pixel of chrome — styled sliders impose glossy
   bullets/arrows/fades that the design system explicitly rejects. Embla ships
   no ARIA; we wire tablist + arrow-key nav ourselves (~30 lines).

2. **Data model: a single-source-of-truth `Showcase` type.** BRC is authored
   once as a `Showcase`; the category page's simple `.prod` cards are _derived_
   from it via a projection (`angles[0]` → image, `specs` → `·`-joined string).
   This kills drift between the category card and the detail page, and makes
   "add specs to atap later" a data change (add a `Showcase`), not a redesign.
   Rejected: optional-fields-on-`Product` (branches every consumer) and a
   separate parallel `Showcase` (two sources of truth that drift).

3. **Route: a dedicated `/pagar-brc` page**, reachable from the homepage hero
   and `/kategori/pagar`, not in primary nav. BRC is a destination, not a nav
   peer. A focused page is also the natural SEO target for `pagar BRC` search
   intent. Rejected: inlining the viewer on the category page (distorts the
   breadth view; no room for the specimen stage to breathe).

4. **Structure: two-zone viewer.** (a) Specimen stage — product selector +
   Embla carousel (only when ≥2 angles; single-angle = static specimen) +
   on-photo callout overlay + spec table + per-product WhatsApp CTA; (b) a
   static "Di Lapangan" proof grid. Specimen and proof stay distinct, matching
   the design system's named split between specimen photography and contextual
   proof. All 15 photos get a purpose.

5. **Specs: key/value pairs** rendered as a mono spec table. Canonical key set
   (precedent for all future showcases): `Dimensi · Diameter Kawat · Mesh ·
Finishing · Asal`. Keys optional per product. Rejected: keeping the single
   spec string (leaves the showcase with a caption, not a spec sheet — the same
   problem we're solving).

6. **Interaction: one authored motion moment.** Selection drives the carousel,
   spec table, callout overlay, and WhatsApp CTA as pure functions of one
   `selectedProduct` state. GSAP redraws dimension lines + staggers spec rows
   on **product change only**; slide changes within a product are a calm
   crossfade. Honours "one authored motion moment; everything else is calm."

7. **On-photo callouts are optional and per-product.** Values are shared with
   the spec table (one truth); placement is authored per photo. Only where
   geometry reads on the photo — never forced onto products without geometric
   dimensions (Aksesoris, Pintu Pagar have no Mesh).

## Consequences

- A new route (`/pagar-brc`) and four new components (`BrcShowcase`,
  `SpecTable`, `DimensionOverlay`, plus the page). `embla-carousel` added as a
  dependency.
- The category page's `brcProducts` is now a derived projection, not
  hand-authored — editing BRC happens in one place (`brcShowcase`).
- Adding a showcase for another category (atap, bondek) is: author a
  `Showcase`, add a detail page, point the category page at the projection.
  No consumer branching.
- Per-product WhatsApp CTA must stay in sync with selection — mitigated by
  driving everything from one state variable in a single `onSelect` handler.
