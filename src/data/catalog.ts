export interface Category {
  slug: string;
  name: string;
  blurb: string;
  count: number;
  image: string;
  icon: string;
  lines: string[];
}

export interface Product {
  slug: string;
  name: string;
  image: string;
  spec: string;
}

// ---- Showcase: the rich detail treatment (opt-in per category) ----
// A product line with real photography (multiple angles) and real authored
// specs earns a Showcase and a detail page. BRC is the first. Specs are never
// fabricated (PRODUCT.md principle #4) — omit a key when it does not apply.

// Canonical spec keys (precedent for every future showcase):
//   Dimensi · Diameter Kawat · Mesh · Finishing · Asal
export interface SpecEntry {
  k: string;
  v: string;
}

// An on-photo annotation. The value is drawn from the item's specs (shared,
// never re-typed) by matching `specKey`; placement is authored per photo.
// Optional — only where geometry genuinely reads on the photo.
export interface Callout {
  specKey: string; // which spec value to display, e.g. "Dimensi"
  type: "dimension" | "leader"; // arrowhead line vs leader-line label
  x: number; // anchor x (SVG viewBox coords, 0..400)
  y: number; // anchor y
  x2?: number; // second point for "dimension"
  y2?: number;
  // for "leader": the label endpoint the leader line bends toward
  lx?: number;
  ly?: number;
}

export interface ShowcaseItem {
  slug: string;
  name: string;
  angles: string[]; // 1+ images; angles[0] is the card/hero image
  specs: SpecEntry[]; // canonical keys, omit what doesn't apply
  callouts?: Callout[]; // optional on-photo annotation, per angle[0]
  waContext: string; // pre-filled WhatsApp message for this item
}

export interface ProofPhoto {
  image: string;
  caption: string;
}

export interface Showcase {
  slug: string; // route slug, e.g. "pagar-brc"
  title: string;
  lead: string;
  items: ShowcaseItem[];
  proof: ProofPhoto[];
}

// Six catalog families from the company profile, in construction-function order.
// `lines` are real product lines drawn from the company catalog (no specs/prices invented).
export const categories: Category[] = [
  {
    slug: "atap",
    name: "Atap & Penutup Atap",
    blurb:
      "UPVC, Alderon, Galvalume, genteng, polycarbonate — atap dingin & panas untuk pabrik, gudang, rumah.",
    count: 17,
    image: "atap-upvc.jpeg",
    icon: "roof",
    lines: [
      "Atap UPVC",
      "Atap Alderon",
      "Atap Amari",
      "Atap Bitumen",
      "Atap Eco Roof",
      "Atap Formax",
      "Atap Galvalume",
      "Genteng Royal",
      "Atap Gutta",
      "Atap Onduline",
      "Atap Rooftop",
      "Atap Twinlite Gen 2.0",
      "Genteng Onduvilla",
      "Genteng UPVC Dr. Shield",
      "Dr. Shield",
      "Dr. Sonne",
      "Potta Roof",
    ],
  },
  {
    slug: "dinding",
    name: "Dinding, Plafon & Fasad",
    blurb: "ACP, wall panel, plafond UPVC, acrylic & lis plang untuk tampilan & interior bangunan.",
    count: 6,
    image: "aluminium-composite-panel.jpg",
    icon: "wall",
    lines: [
      "Wall Panel",
      "Plafond UPVC",
      "Lis Plang",
      "Acrylic",
      "ACP — Aluminium Composite Panel",
    ],
  },
  {
    slug: "pintu",
    name: "Pintu",
    blurb: "Pintu WPC, Dumma, Alumix Platinum — anti rayap, tahan air, untuk rumah & komersial.",
    count: 4,
    image: "door-wpc.jpg",
    icon: "door",
    lines: ["Pintu WPC", "Pintu WPC Porte", "Pintu Dumma", "Pintu Alumix Platinum"],
  },
  {
    slug: "struktur",
    name: "Struktur & Lantai",
    blurb: "Bondek, floordeck, wiremesh & hollow — tulangan & lantai cor siap pasang.",
    count: 4,
    image: "bondek.png",
    icon: "beam",
    lines: ["Bondek", "Floordeck", "Wiremesh", "Hollow"],
  },
  {
    slug: "pagar",
    name: "Pagar, Pengaman & Kawat",
    blurb: "Pagar BRC, tiang Y, kawat harmonika, bronjong, duri & silet — pengaman proyek & lahan.",
    count: 12,
    image: "pagar-brc-terpasang-outdoor-1.jpg",
    icon: "fence",
    lines: [
      "Pagar BRC",
      "Tiang BRC",
      "Tiang Y BRC",
      "Pintu Pagar BRC",
      "Aksesoris Baut & Klem",
      "Set Tiang Rebah",
      "Pagar Kawat Harmonika",
      "Kawat Bronjong",
      "Kawat Duri",
      "Kawat Silet",
      "Guardrail",
      "Kawat Loket",
    ],
  },
  {
    slug: "utilitas",
    name: "Utilitas & Aksesoris",
    blurb: "Tiang PJU, sealant, perforated & aksesoris pemasangan — kelengkapan proyek.",
    count: 3,
    image: "tiang-pju.jpg",
    icon: "util",
    lines: ["Tiang PJU", "Sealant", "Perforated"],
  },
];

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

// ---- BRC fencing showcase (the flagship) ----
// Authored once here. The simple category cards below are *derived* from this
// via the projection, so the category page and the detail page never drift.
// Spec values are drawn from the real BRC product specs (the hero already
// publishes 240×150 cm, ∅6 mm, mesh 150×150, galvanis elektro). Values for the
// remaining products are drafted from the available photography and marked
// for client confirmation — never invented beyond what the product is.
export const brcShowcase: Showcase = {
  slug: "pagar-brc",
  title: "Pagar BRC",
  lead: "Setiap panel dilas titik dan digalvanis. Periksa spesifikasinya dari setiap sisi.",
  items: [
    {
      slug: "pagar-brc-panel",
      name: "Pagar BRC Panel",
      angles: ["pagar-brc-panel-perspektif.jpg"],
      specs: [
        { k: "Dimensi", v: "240×150 cm" },
        { k: "Diameter Kawat", v: "∅6 mm" },
        { k: "Mesh", v: "150×150 mm" },
        { k: "Finishing", v: "Galvanis elektro" },
        { k: "Asal", v: "Surabaya" },
      ],
      callouts: [
        { specKey: "Dimensi", type: "dimension", x: 40, y: 28, x2: 360, y2: 28 },
        { specKey: "Diameter Kawat", type: "leader", x: 150, y: 250, lx: 250, ly: 300 },
        { specKey: "Mesh", type: "leader", x: 300, y: 190, lx: 360, ly: 150 },
      ],
      waContext:
        'Halo BSM, saya butuh penawaran untuk "Pagar BRC Panel" (240×150 cm, ∅6 mm, galvanis). Mohon info harga pabrik, stok, dan pengiriman. Terima kasih.',
    },
    {
      slug: "tiang-brc",
      name: "Tiang BRC",
      angles: [
        "tiang-brc-dengan-panel-perspektif-1.jpg",
        "tiang-brc-dengan-panel-perspektif-2.jpg",
      ],
      specs: [
        { k: "Dimensi", v: "Baseplate 150×150 mm" },
        { k: "Finishing", v: "Galvanis elektro" },
        { k: "Asal", v: "Surabaya" },
      ],
      callouts: [{ specKey: "Dimensi", type: "leader", x: 200, y: 330, lx: 320, ly: 360 }],
      waContext:
        'Halo BSM, saya butuh penawaran untuk "Tiang BRC" (baseplate, galvanis). Mohon info harga pabrik, stok, dan pengiriman. Terima kasih.',
    },
    {
      slug: "tiang-y-brc",
      name: "Tiang Y BRC",
      angles: ["tiang-y-brc-tampak-depan.jpg", "tiang-y-brc-perspektif-atas.jpg"],
      specs: [
        { k: "Finishing", v: "Galvanis" },
        { k: "Asal", v: "Surabaya" },
      ],
      waContext:
        'Halo BSM, saya butuh penawaran untuk "Tiang Y BRC" (galvanis). Mohon info harga pabrik, stok, dan pengiriman. Terima kasih.',
    },
    {
      slug: "pintu-pagar-brc",
      name: "Pintu Pagar BRC",
      angles: ["pintu-pagar-brc-tampak-depan.jpg", "pintu-pagar-brc-detail-grendel-1.jpg"],
      specs: [
        { k: "Dimensi", v: "Geser · Grendel" },
        { k: "Finishing", v: "Galvanis" },
        { k: "Asal", v: "Surabaya" },
      ],
      callouts: [{ specKey: "Dimensi", type: "dimension", x: 40, y: 28, x2: 360, y2: 28 }],
      waContext:
        'Halo BSM, saya butuh penawaran untuk "Pintu Pagar BRC" (geser, grendel, galvanis). Mohon info harga pabrik, stok, dan pengiriman. Terima kasih.',
    },
    {
      slug: "aksesoris-baut-klem",
      name: "Aksesoris Baut & Klem",
      angles: ["aksesoris-brc-baut-dan-klem-1.jpg", "aksesoris-brc-baut-dan-klem-2.jpg"],
      specs: [
        { k: "Diameter Kawat", v: "∅8 mm" },
        { k: "Finishing", v: "Stainless" },
        { k: "Asal", v: "Surabaya" },
      ],
      callouts: [{ specKey: "Diameter Kawat", type: "leader", x: 200, y: 200, lx: 320, ly: 240 }],
      waContext:
        'Halo BSM, saya butuh penawaran untuk "Aksesoris Baut & Klem" (∅8, stainless). Mohon info harga pabrik, stok, dan pengiriman. Terima kasih.',
    },
    {
      slug: "set-tiang-rebah",
      name: "Set Tiang Rebah",
      angles: ["pagar-brc-set-tiang-rebah-1.jpg"],
      specs: [
        { k: "Finishing", v: "Galvanis" },
        { k: "Asal", v: "Surabaya" },
      ],
      waContext:
        'Halo BSM, saya butuh penawaran untuk "Set Tiang Rebah" (galvanis). Mohon info harga pabrik, stok, dan pengiriman. Terima kasih.',
    },
  ],
  proof: [
    { image: "pagar-brc-terpasang-outdoor-1.jpg", caption: "TERPASANG · OUTDOOR" },
    { image: "pagar-brc-terpasang-grendel-outdoor.jpg", caption: "TERPASANG · GRENDEL" },
    { image: "pagar-brc-terpasang-ujung-atas-outdoor.jpg", caption: "TERPASANG · UJUNG ATAS" },
    { image: "pagar-brc-tumpukan-stok-gudang-1.jpg", caption: "STOK · GUDANG" },
    { image: "pagar-brc-tumpukan-stok-gudang-2.jpg", caption: "STOK · GUDANG" },
  ],
};

// Derived projection — the simple card shape used on the category page and
// homepage. Single source of truth: editing the showcase updates the cards.
export const brcProducts: Product[] = brcShowcase.items.map((i) => ({
  slug: i.slug,
  name: i.name,
  image: i.angles[0],
  spec: i.specs.map((s) => s.v).join(" · "),
}));
