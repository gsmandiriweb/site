# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two overlapping audiences, both reached through WhatsApp / phone inquiry:

- **Trade & professional buyers (primary):** contractors, project procurement managers, builders, architects, and consultants sourcing materials for real construction projects (warehouses, factories, schools, hospitals, hotels, roads, perimeter fencing). They buy in volume, compare factory pricing, and care about stock readiness and reliable nationwide delivery.
- **Individual & renovator buyers (secondary):** homeowners and small renovators buying for a house, fence, roof, or interior fit-out. They arrive via search (e.g. "pagar BRC murah", "atap UPVC Surabaya") and need clear product info plus an easy way to ask for a price.

Both audiences are mobile-first and use WhatsApp as the dominant contact channel in Indonesia.

## Product Purpose

CV Bangun Sarana Makmur (BSM) is a Surabaya-based distributor and supplier of building-construction materials, selling at "harga pabrik" (factory price) with delivery across all of Indonesia. The site exists to (1) present the full product catalog so BSM reads as a single sourcing partner, (2) make it effortless to request a quote, and (3) publish helpful blog content (buying guides, material explainers) that earns search traffic and trust.

## Positioning

A direct factory-price distributor in Surabaya offering unusual catalog breadth from one source — roofing, walls/facades, doors, structure/flooring, fencing/safety/wire, and utilities — backed by real field/project experience and free Surabaya delivery. Competitors typically specialize in one material line; BSM's defensible position is one-stop breadth + factory pricing + nationwide shipping + free consultation, not a single hero product. BRC fencing is the current visual flagship because it is the richest available photography, but the catalog is the point.

## Operating Context

- Sales happen over **WhatsApp and phone** (the published 0812… numbers are mobile = WhatsApp) and email; there is no e-commerce checkout. Every product interaction ends in a quote request, not a cart.
- The company previously offered installation/aplicator services (ACP, atap, pintu WPC, plafon PVC, perforasi) but has **discontinued installation** and now focuses on distribution & sales. Do not present installation as a current service.
- Materials are organized by construction function (6 categories). Buyers think in categories ("atap", "pagar", "bondek"), not brand SKUs.
- Factory/warehouse stock and on-site installed photography is real and available; this is the preferred imagery over generic stock.

## Capabilities and Constraints

- **Static site built with Astro 7**; output is fully static.
- **Blog CMS: custom BSM dashboard** — the canonical editor at `/admin` (markdown-first WYSIWYG). It edits Markdown posts and repository images, commits each revision to its own GitHub branch and pull request (`cms/<slug>/r<N>`), and publishes by merging to `main`, which auto-deploys the static site. GitHub is the durable source of truth; the public site stays fully static. Keystatic and Decap are not part of the destination. [Confirmed]
- **Language: Indonesian only** (`lang="id"`). No i18n routing. [Confirmed]
- **No public price list.** Prices/stock fluctuate and must not be hardcoded or fabricated; the pattern is "request a quote" via WhatsApp/phone. [Confirmed]
- **Product display: all 6 reference categories browsable, BRC fencing as hero/flagship.** [Confirmed]
- React is used only where needed (the CMS dashboard / interactive admin surfaces), not as the default rendering model for the marketing site.
- **Deployment: Cloudflare Workers + Assets** — GitHub Actions builds and deploys automatically on every push to `main`; the signed callback records the deployed commit to mark content as live. Auth and CMS mutation APIs are the only runtime routes; everything else is pre-rendered static output. [Confirmed]

## Brand Commitments

- **Name:** CV Bangun Sarana Makmur, short name **BSM**. Business form: CV (Commanditaire Vennootschap). Category: Distributor / Supplier Material Bangunan.
- **Vision:** Menjadi salah satu penyedia material bahan bangunan dan aplikator terbaik dalam pembangunan Indonesia.
- **Mission:** Menyediakan berbagai macam material dengan kualitas yang prima, serta memberikan pelayanan dalam memenuhi kebutuhan pelanggan secara maksimal dan inovatif.
- **Promises to preserve in copy:** harga pabrik (factory price), pengiriman ke seluruh Indonesia (nationwide delivery), free delivery for Surabaya area, konsultasi gratis (free consultation).
- **Contact (real, from company profile — verify before launch):**
  - Address: Jl. Prapen Indah Gg. 6 Blok C–22, Rt. 003 / Rw. 07, Kel. Panjang Jiwo, Kec. Tenggilis Mejoyo, Surabaya 60299, Jawa Timur
  - Office phone: 031 – 99853472
  - Sales online: 0812 4934 3303 · 0878 5123 4221
  - Hotline: 0812 3111 1660 · 0812 2200 1911
  - Email: bsmbangun@yahoo.co.id
  - Website: www.bangunsaranamakmur.com
- **No binding visual identity was provided** (no logo, brand colors, or type system supplied). The incumbent public favicon is the Astro default and is not a brand asset. Visual world, logo, and palette are deliberately undecided and belong to the new-work/design phase, not here.

## Evidence on Hand

- **Company profile + full product catalog (auto-compiled):** `docs/reference/bangun-sarana-makmur.html` — vision/misi, contact, services, discontinued-installation note, and 6 categories / ~40 product lines with source links.
- **Reference product thumbnails:** `docs/reference/images/` — ~50 category images (atap, ACP, acrylic, pintu, hollow, kawat, guardrail, tiang PJU, sealant, perforated, dll).
- **Client-requested hero photography:** `~/Rice/BSM/docs/bsm-images/` — ~46 high-resolution photos, heavily BRC fencing (panels, tiang BRC, tiang Y BRC, pintu pagar BRC, aksesoris baut & klem, tiang rebah sets, stock/warehouse, and installed/outdoor shots). This is the primary imagery for the BRC hero and product pages.
- **Incumbent live site (source of truth):** https://www.bangunsaranamakmur.com/
- **Absences (do not fabricate):** no logo, brand guidelines, copy deck, testimonials, case-study metrics, or pricing data were provided. Prices and stock availability must come from the client on request, never invented.

## Product Principles

1. **Lead with real material, not stock fantasy.** Use actual factory / warehouse / installed photography (especially the BSM BRC set); avoid generic construction stock.
2. **Make inquiry effortless.** WhatsApp/phone first on every surface; each product and post drives to a quote, not a cart.
3. **Show the breadth.** Surface the full 6-category catalog so BSM reads as a one-stop sourcing partner, with BRC as the entry story.
4. **Factory-price honesty.** Quote-based, never fake precision pricing or invent discounts/specs.
5. **Indonesian, mobile-first, nationwide.** Meet buyers on their phone, in their language, wherever the project is.

## Accessibility & Inclusion

No formal WCAG/legal accessibility mandate was stated. Audience is mobile-first (WhatsApp/mobile), Indonesian-language. Baseline: responsive mobile-first layout, readable type, sufficient contrast, and accessible WhatsApp/phone CTAs. [Open — confirm if a specific standard (e.g., WCAG 2.1 AA) is required before hardening.]
