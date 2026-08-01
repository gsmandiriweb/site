# ADR 0003 — Quote configurator: intent collector, not a calculator

- **Status:** Accepted
- **Date:** 2025-07-29
- **Context:** ADR-0002 approved one honest borrow from the `bsm-website.vercel.app` prototype — a quote configurator. The prototype's version _computes_ tonnage, container-fill %, and fabrication lead time, all from fabricated formulas. This ADR scopes what ours does instead.

## Decision

Build a quote configurator at `/penawaran` that **collects buyer intent and composes a pre-filled WhatsApp RFQ message. It computes nothing** — no price, no tonnage, no stock, no lead time, no container fill.

- **Collected fields:** Category, Product/line (dependent on category), Quantity + unit (lembar/batang/m²/m), Project location/city, Buyer role (Kontraktor/Procurement/Arsitek/Tukang/Pribadi), Notes (freeform). Name is optional; WhatsApp carries identity.
- **No structured Dimensions/Finishing fields.** They're product-specific (a BRC panel has dimensions; a sealant doesn't). Instead, when the selected product has a Showcase, its known specs are auto-injected into the composed message as context. Anything else goes in Notes.
- **Output is a WhatsApp message, never a number.** The configurator's job ends at composing an RFQ; BSM's sales team answers the actual quote.
- **Route:** dedicated `/penawaran` page first (linkable, SEO target for "penawaran material"). Inline pre-fill from product surfaces comes later as a query-string deep-link (`?produk=...`), not a second implementation.

## Considered Options

- **Compute tonnage/lead-time like the prototype (rejected).** Requires real formulas and real lead-time data the client has not supplied; violates PRODUCT.md principle #4 and the Absences list. The prototype's numbers are aspirational, not factual.
- **Structured Dimensions/Finishing fields on every product (rejected).** Forces empty fields on products they don't apply to — decoration, which `DESIGN.md` forbids. Auto-injecting known specs from the Showcase is the honest equivalent.
- **Inline-only configurator on product pages (rejected as the first cut).** A dedicated page is linkable from every CTA and works for any product; the inline version is a deep-link into it, not a separate build.

## Consequences

- New route `/penawaran` + a configurator component. The composed WhatsApp message format becomes a shared concern (the catalog browser's line-row CTAs and the BRC showcase CTA should converge on the same message shape over time).
- The configurator depends on the catalog data (categories + lines + Showcase specs) already in `src/data/catalog.ts` — no new data source, but the "inject known specs" behavior couples it to the Showcase model.
- Any future request to "show estimated price/weight/lead time" in the configurator is blocked until the client supplies real figures. This ADR is the reference for that refusal.
