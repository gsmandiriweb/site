# Client Prototype Conversion Patterns Audit

**Source audited:** <https://bsm-website.vercel.app/>

**Date:** 2026-08-03

## Scope and policy

This audit extracts reusable interaction and information-architecture patterns only. It deliberately does **not** recommend copying the client prototype's metrics, certifications, testimonials, legal identifiers, contact details, addresses, or product-performance claims. Those facts are outside this map's scope and require separate client verification before publication.

## Observed client structure

The client prototype presents a long, single-page B2B material-supplier experience with these structural acts:

1. **Header and entry routes**
   - Navigation exposes Beranda, Katalog Material, Tentang BSM, Wawasan & SEO Blog, and Hubungi Kami.
   - A direct phone action is visible.
   - Additional Admin Mode and Portal B2B Inquiries controls are present.

2. **Hero with audience segmentation**
   - The first view combines a material-supplier value proposition with segmented persona controls:
     - Project Manager / Kontraktor
     - Toko Besi & Agen Retail
     - Arsitek & Desainer Pro
     - Pengembang / Pemilik Rumah
   - The persona controls are an interaction pattern: they imply that the next information or CTA can be tailored to the buyer's job.

3. **Technical-detail / certification area**
   - A dedicated section frames technical specifications and documentation as a reason to contact sales.
   - The reusable pattern is to make technical confidence an explicit conversion step, not bury specs inside a product card.

4. **Product-pillar cards**
   - Three major material/product pillars are presented as large cards.
   - Each card combines product title, feature list, technical specification block, and a direct action such as viewing technical detail or requesting a quote.

5. **Interactive B2B estimator**
   - A material selector exposes product/category choices.
   - Dimension and wire-thickness controls are presented as explicit choices.
   - A range input changes an estimated quantity/volume output.
   - The result can be exported to WhatsApp sales.
   - An upload-project-drawing CTA appears alongside the estimator.

6. **Operational/project proof**
   - A project gallery maps material use to named places and project contexts.
   - This is a proof hierarchy pattern: show what material was used, where it was used, and what role it played.

7. **Social proof and closing CTA**
   - Testimonials are given a dedicated section.
   - The closing CTA returns to estimator/contact behavior rather than ending on a passive footer.

## What the local app already does better or differently

The local app already has several structurally stronger, truth-preserving equivalents:

- `src/pages/penawaran.astro` is a guided RFQ builder with category, dependent product, quantity/unit, project location, buyer role, notes, known-spec context, and a prefilled WhatsApp message. It explicitly computes no price, stock, tonnage, or lead time.
- `src/data/catalog.ts` provides six categories, catalog-line projections, BRC showcase items, multi-angle imagery, canonical spec entries, and per-item WhatsApp context.
- `src/pages/index.astro` and `src/pages/pagar-brc.astro` already combine real BRC/product photography, inspectable specs, direct WhatsApp CTAs, and field/warehouse proof imagery.
- `src/pages/katalog.astro` already provides searchable/filterable breadth across all catalog lines.

## Reusable patterns recommended for follow-up decisions

### 1. Buyer-entry segmentation

Evaluate whether a small buyer-intent choice improves the first-view journey for BSM's actual audiences (trade/professional buyers and individual/renovators). It should not block the primary WhatsApp path or create four separate content systems without evidence.

**Candidate shape:** one compact choice such as `Saya membeli untuk proyek` / `Saya mencari material untuk rumah atau renovasi`, with either a focused scroll target or CTA context—not a full account/persona system.

### 2. Estimator as a bounded RFQ accelerator

Evaluate whether a lightweight estimator should augment `/penawaran`, not become a pricing/calculation engine. It may collect dimensions, quantity, unit, product choice, location, and notes when the local data supports the fields. Every output should be labeled as an estimate or inquiry context and flow to WhatsApp. No invented engineering, compliance, weight, stock, price, or delivery result.

### 3. Proof hierarchy

Evaluate a claim-free proof sequence using existing local evidence:

1. real product/specification;
2. warehouse or installed field photo;
3. category/catalog breadth;
4. operational explanation of how a quote becomes a shipment.

Do not add testimonials, project names, certification badges, or numerical milestones unless independently confirmed and explicitly approved.

### 4. Technical detail as a conversion module

Consider a reusable technical-detail block that pairs known specs with a clear next action (`Lihat spesifikasi` / `Minta penawaran`). This can build on the existing Showcase and RFQ data rather than introducing a second product model.

## Recommendation

Do not copy the client page wholesale. Continue with three focused decisions:

- choose whether buyer-entry segmentation earns its friction;
- define the honest boundary between an estimator and the existing RFQ configurator;
- choose a claim-free proof system built from local photography and known specs.

The prototype's strongest transferable idea is not any individual claim or visual treatment; it is the explicit sequence from **buyer intent → technical confidence → bounded estimate/RFQ → operational proof → WhatsApp action**.

## Evidence sources

- Client prototype homepage: <https://bsm-website.vercel.app/>
- Local landing: `src/pages/index.astro`
- Local RFQ builder: `src/pages/penawaran.astro`
- Local catalog browser: `src/pages/katalog.astro`
- Local BRC showcase: `src/pages/pagar-brc.astro`, `src/components/BrcShowcase.astro`
- Local catalog model: `src/data/catalog.ts`
- Domain glossary: `CONTEXT.md`
- Product constraints and honesty principles: `PRODUCT.md`
