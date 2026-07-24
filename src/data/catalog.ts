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

// Six catalog families from the company profile, in construction-function order.
// `lines` are real product lines drawn from the company catalog (no specs/prices invented).
export const categories: Category[] = [
  {
    slug: "atap",
    name: "Atap & Penutup Atap",
    blurb:
      "UPVC, Alderon, Galvalume, genteng, polycarbonate — atap dingin & panas untuk pabrik, gudang, rumah.",
    count: 17,
    image: "/images/ref/atap-upvc.jpeg",
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
    image: "/images/ref/aluminium-composite-panel.jpg",
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
    image: "/images/ref/door-wpc.jpg",
    icon: "door",
    lines: ["Pintu WPC", "Pintu WPC Porte", "Pintu Dumma", "Pintu Alumix Platinum"],
  },
  {
    slug: "struktur",
    name: "Struktur & Lantai",
    blurb: "Bondek, floordeck, wiremesh & hollow — tulangan & lantai cor siap pasang.",
    count: 4,
    image: "/images/ref/bondek.png",
    icon: "beam",
    lines: ["Bondek", "Floordeck", "Wiremesh", "Hollow"],
  },
  {
    slug: "pagar",
    name: "Pagar, Pengaman & Kawat",
    blurb: "Pagar BRC, tiang Y, kawat harmonika, bronjong, duri & silet — pengaman proyek & lahan.",
    count: 12,
    image: "/images/bsm/pagar-brc-terpasang-outdoor-1.jpg",
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
    image: "/images/ref/tiang-pju.jpg",
    icon: "util",
    lines: ["Tiang PJU", "Sealant", "Perforated"],
  },
];

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

// BRC fencing — the hero product line, with the richest real photography.
export const brcProducts: Product[] = [
  {
    slug: "pagar-brc-panel",
    name: "Pagar BRC Panel",
    image: "/images/bsm/pagar-brc-panel-perspektif.jpg",
    spec: "Panel 240×150 cm · ∅6 mm · Galvanis",
  },
  {
    slug: "tiang-brc",
    name: "Tiang BRC",
    image: "/images/bsm/tiang-brc-dengan-panel-perspektif-1.jpg",
    spec: "Baseplate · Galvanis elektro",
  },
  {
    slug: "tiang-y-brc",
    name: "Tiang Y BRC",
    image: "/images/bsm/tiang-y-brc-tampak-depan.jpg",
    spec: "Cabang Y · Galvanis",
  },
  {
    slug: "pintu-pagar-brc",
    name: "Pintu Pagar BRC",
    image: "/images/bsm/pintu-pagar-brc-tampak-depan.jpg",
    spec: "Geser · Grendel · Galvanis",
  },
  {
    slug: "aksesoris-baut-klem",
    name: "Aksesoris Baut & Klem",
    image: "/images/bsm/aksesoris-brc-baut-dan-klem-1.jpg",
    spec: "Baut & klem ∅8 · Stainless",
  },
  {
    slug: "set-tiang-rebah",
    name: "Set Tiang Rebah",
    image: "/images/bsm/pagar-brc-set-tiang-rebah-1.jpg",
    spec: "Set tiang + panel · Galvanis",
  },
];
