# Photography & Spec Request List

To make each category read as **premium like BRC**, we need real photography
and confirmed specs — not stock images or invented numbers (PRODUCT.md
principles #1 & #4). This list is the concrete ask: what we have, what we need,
and the bar each category must clear to earn a Showcase.

## The benchmark: BRC (✅ already a Showcase)

BRC is the model. It earned a Showcase (`/pagar-brc`) because it has:

- **15 real photos** — 11 specimen angles across 6 products + 4 installed/stock
  proof shots, all from BSM's own warehouse/field.
- **Authored specs per product** — `Dimensi`, `Diameter Kawat`, `Mesh`,
  `Finishing`, `Asal` (canonical keys), confirmed against the real product.
- **Multi-angle coverage** — at least 2 angles for products where geometry
  reads (Tiang BRC, Tiang Y, Pintu Pagar, Aksesoris).

That is the bar. A category becomes a Showcase when it clears it.

## The bar (per product line)

For a line to render as a **rich specimen card** (image + spec + detail link)
instead of a **line row** (name + WhatsApp CTA), we need:

1. **≥ 2 real photos** of the actual product — a primary specimen shot + at
   least one alternate angle or detail. Phone photos from the warehouse are
   fine; stock imagery is not.
2. **Confirmed specs** for the canonical keys that apply — `Dimensi`,
   `Diameter Kawat` / `Mesh` / `Finishing` / `Asal`. Omit keys that don't
   apply; never invent values or use `—` placeholders.
3. **1+ proof photo** (installed / in-field / warehouse stock) for the
   category's "Di Lapangan" grid — belongs to the line, not a single product.

Until a line clears the bar, it stays an honest line row. That is correct, not
a gap to fill with fabrication.

## Per-category ask

### Atap & Penutup Atap (17 lines) — highest priority after BRC

- **Today:** 1 stock thumbnail (`atap-upvc.jpeg`). No specs. No multi-angle.
- **Need (to make the top sellers rich):** for the 3–5 most-asked lines
  (Atap UPVC, Atap Alderon, Atap Galvalume, Genteng Royal, Atap Onduline):
  - 2+ real photos each (a laid-flat specimen + an installed/roof shot).
  - Confirmed specs: `Dimensi` (lebar·tebal·panjang), `Finishing` (warna/coating),
    `Asal`. (`Mesh`/`Diameter Kawat` don't apply — omit.)
  - 3–4 proof photos of installed roofing for the "Di Lapangan" grid.
- **Why first:** largest category (17 lines), strongest search intent
  ("atap upvc surabaya"), and roofing photographs well from the ground.

### Struktur & Lantai (4 lines)

- **Today:** 1 stock thumbnail each (`bondek.png`, `hollow.jpg`). No specs.
- **Need:** for Bondek, Floordeck, Wiremesh, Hollow:
  - 2+ real photos each (a flat specimen showing the profile + a stack/stock shot).
  - Confirmed specs: `Dimensi` (tebal·lebar), `Finishing`, `Asal`.
  - 2–3 proof photos of rebar/decking on a site.
- **Why:** only 4 lines — low effort to cover fully, high trade-buyer value.

### Pagar, Pengaman & Kawat (12 lines) — BRC subset already rich

- **Today:** BRC's 6 lines are a Showcase; the other 6 (Tiang Y, Kawat
  Harmonika, Bronjong, Kawat Duri, Kawat Silet, Guardrail, Kawat Loket) are rows.
- **Need:** for the non-BRC lines, same as the bar above. Several already have
  a reference thumbnail (`kawat-duri.jpg`, `guardrail.jpg`) — replace with real
  BSM stock photos + add specs (`Diameter Kawat`, `Mesh`, `Finishing`, `Asal`).
- **Note:** Tiang Y BRC already has 2 angles in the BRC set but is authored as
  a separate line — confirm whether it should fold into the BRC Showcase.

### Dinding, Plafon & Fasad (6 lines)

- **Today:** 1 stock thumbnail (`aluminium-composite-panel.jpg`, `wall-panel.jpg`).
- **Need:** for ACP, Wall Panel, Plafond UPVC, Lis Plang, Acrylic:
  - 2+ real photos each (a flat panel specimen + an installed wall/ceiling shot).
  - Confirmed specs: `Dimensi` (tebal·lebar), `Finishing` (warna/finishing), `Asal`.
  - 2–3 proof photos of installed facades/ceilings.

### Pintu (4 lines)

- **Today:** 1 stock thumbnail (`door-wpc.jpg`). No specs.
- **Need:** for Pintu WPC, WPC Porte, Dumma, Alumix Platinum:
  - 2+ real photos each (front face + edge/detail showing construction).
  - Confirmed specs: `Dimensi` (tebal), `Finishing`, `Asal`.
  - 1–2 proof photos of installed doors.

### Utilitas & Aksesoris (3 lines)

- **Today:** 1 stock thumbnail (`tiang-pju.jpg`). No specs.
- **Need:** for Tiang PJU, Sealant, Perforated:
  - 2+ real photos each.
  - Confirmed specs: `Dimensi`, `Finishing`/`Material`, `Asal`.
  - Lowest priority — small category, lower search volume.

## How to deliver

- **Format:** original phone photos are fine (JPG/HEIC). No editing needed.
- **Naming:** `kategori-produk-sudut.jpg` (e.g. `atap-upvc-spesimen.jpg`,
  `atap-upvc-terpasang.jpg`). We'll optimize on build.
- **Specs:** a simple list per product — we'll confirm keys against the
  canonical set. No need for a formal datasheet.
- **Where:** drop into `src/images/bsm/` (real BSM photography) — the same
  folder as the BRC set.

## What we will not do

Per PRODUCT.md principles #1 & #4 and ADR-0002: we will not use stock imagery
to fake rich cards, and we will not invent specs, prices, or metrics. A line
stays a row until the real material exists. This list is how we change that —
not a workaround.
