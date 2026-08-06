# BSM Claim-Free Proof System

**Decision:** Evidence + process

## Purpose

Give buyers confidence without importing unverified claims from the client prototype. The proof system should show what BSM can document, how the catalog is organized, and what happens after a buyer asks for a quote.

## Four-layer hierarchy

### 1. Product truth

Show real product photography beside canonical, confirmed specifications from the shared catalog model. For BRC, this is the existing Showcase data: product angles, dimensions where confirmed, wire diameter where confirmed, mesh where confirmed, finishing, and origin.

A specification is proof only when it comes from the same source as the product detail surface. Do not retype values into a second proof module.

### 2. Contextual proof

Show installed and warehouse photos as contextual evidence that the product exists beyond a clean product plate. Use neutral captions describing only what is visible, such as `TERPASANG · OUTDOOR`, `TERPASANG · GRENDEL`, or `STOK · GUDANG`.

These images should not imply a named client, project outcome, project scale, date, quantity, or performance result unless those facts are separately confirmed.

### 3. Catalog breadth

Show the six construction-material families and their current product-line structure. Breadth is a product-organizing fact, not a claim about market share, revenue, project count, or company scale.

The existing `/katalog` and landing category rail are the source surfaces. Do not create a second manually maintained category or product list.

### 4. Operational handoff

Explain the factual next step: the buyer sends category/product, quantity or dimensions when known, and location through WhatsApp; BSM sales verifies the official quote, stock, and delivery details. The site may promise the existing approved service language—factory-price quotation, nationwide inquiry path, free consultation, and free Surabaya delivery—but must not invent response times or availability.

The existing `/penawaran` RFQ builder is the canonical handoff. Proof modules should link to it or to a prefilled WhatsApp message rather than introducing a parallel lead system.

## Explicit exclusions

Do not add these from the client prototype without separate client verification and approval:

- testimonials or attributed endorsements;
- named projects, client names, or logos;
- certification badges or compliance claims;
- company-age, project-count, city-count, or other numerical milestones;
- product-performance guarantees, corrosion life, load claims, or engineering outcomes;
- public prices, stock promises, delivery times, or fabricated operational metrics.

## Minimum data/assets

A proof module may ship when it has:

- a real image asset;
- a neutral, accurate caption or accessible alt text;
- a link to the canonical product/spec data where relevant;
- a clear boundary between what the image visibly proves and what sales must verify;
- a direct RFQ or WhatsApp action.

No new CMS collection or claim database is needed for the first prototype slice.

## Existing local foundation

- `src/data/catalog.ts`: canonical categories, Showcase specs, and proof-photo records.
- `src/pages/index.astro`: hero specs, warehouse/installed breaks, category breadth, and operational close.
- `src/components/BrcShowcase.astro`: product specimen stage plus `Di Lapangan` proof grid.
- `src/pages/pagar-brc.astro`: detailed BRC surface and quote action.
- `src/pages/penawaran.astro`: canonical RFQ-to-WhatsApp handoff.
