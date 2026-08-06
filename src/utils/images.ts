// Resolves a catalog/blog image filename to an Astro ImageMetadata so it can be
// optimized by Astro's <Image> component (resize + WebP/AVIF + srcset).
// Files live in src/images/{bsm,ref}/ and are referenced by basename from
// catalog.ts and blog frontmatter.
import type { ImageMetadata } from "astro";

const modules = import.meta.glob<{ default: ImageMetadata }>(
  "../images/**/*.{jpeg,jpg,png,webp,avif,gif,svg}",
  { eager: true },
);

// Two indexes over the same glob: exact path (relative to `src/images/`, per
// ADR 0011 per-post folders) and basename (legacy pool references kept only for
// the catalog during migration).
const byPath = new Map<string, ImageMetadata>();
const byName = new Map<string, ImageMetadata>();
for (const [path, mod] of Object.entries(modules)) {
  const relative = path.replace(/^\.\.\/images\//, "").replace(/^\/src\/images\//, "");
  byPath.set(relative, mod.default);
  byName.set(path.split("/").pop() as string, mod.default);
}

export function imageAsset(name: string): ImageMetadata {
  // Accept a bare filename ("atap-upvc.jpeg") or an explicit path relative to
  // src/images ("blog/<slug>/cover.jpg", per ADR 0011). Explicit paths win;
  // basename resolution remains the legacy catalog fallback during migration.
  const normalized = name
    .replace(/^\/src\/images\//, "")
    .replace(/^src\/images\//, "")
    .replace(/^\/+/, "");
  const byExplicitPath = byPath.get(normalized);
  if (byExplicitPath) return byExplicitPath;
  const filename = normalized.split("/").pop() as string;
  const img = byName.get(filename);
  if (!img) throw new Error(`Missing image asset: ${name}`);
  return img;
}

export type MediaAsset = {
  filename: string;
  src: string;
  label: string;
  alt: string;
};

// Curated media library shown in the CMS dashboard's image picker. Kept as an
// explicit list so editors only see presentation-worthy assets.
export function mediaAssets(): MediaAsset[] {
  const curated: Array<[string, string, string]> = [
    ["pagar-brc-panel-perspektif.jpg", "Pagar BRC panel", "Pagar BRC panel tampak perspektif"],
    ["pagar-brc-tumpukan-stok-gudang-1.jpg", "Stok BRC di gudang", "Tumpukan pagar BRC di gudang"],
    [
      "pagar-brc-terpasang-outdoor-1.jpg",
      "BRC terpasang outdoor",
      "Pagar BRC terpasang di luar ruangan",
    ],
    ["pagar-brc-set-tiang-rebah-1.jpg", "Set tiang BRC", "Set tiang pagar BRC siap dipasang"],
    [
      "pagar-brc-terpasang-grendel-outdoor.jpg",
      "Detail grendel BRC",
      "Detail grendel pada pagar BRC outdoor",
    ],
    ["atap-upvc.jpeg", "Atap UPVC", "Atap UPVC"],
    ["bondek.png", "Bondek", "Bondek untuk lantai cor"],
    ["hollow.jpg", "Hollow", "Material hollow"],
  ];
  return curated.map(([filename, label, alt]) => ({
    filename,
    src: imageAsset(filename).src,
    label,
    alt,
  }));
}
