// Resolves a catalog/blog image filename to an Astro ImageMetadata so it can be
// optimized by Astro's <Image> component (resize + WebP/AVIF + srcset).
// Files live in src/images/{bsm,ref}/ and are referenced by basename from
// catalog.ts and blog frontmatter.
import type { ImageMetadata } from "astro";

const modules = import.meta.glob<{ default: ImageMetadata }>(
  "../images/**/*.{jpeg,jpg,png,webp,avif,gif,svg}",
  { eager: true },
);

const byName = new Map<string, ImageMetadata>();
for (const [path, mod] of Object.entries(modules)) {
  byName.set(path.split("/").pop() as string, mod.default);
}

export function imageAsset(name: string): ImageMetadata {
  // Accept either a bare filename ("atap-upvc.jpeg") or a Keystatic path
  // ("/src/images/ref/atap-upvc.jpeg") and resolve by basename.
  const filename = name.split("/").pop() as string;
  const img = byName.get(filename);
  if (!img) throw new Error(`Missing image asset: ${name}`);
  return img;
}
