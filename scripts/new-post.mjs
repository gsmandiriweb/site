#!/usr/bin/env node
// Scaffolds a new blog post as a Markdown file in src/content/blog/.
//
//   bun scripts/new-post.mjs "Judul Artikel Baru" [--draft]
//
// Generates the stable `id`, slug from the title, today's date, and a valid
// frontmatter block that matches src/content.config.ts exactly. With --draft the
// post is saved as `status: draft` (invisible on the public site); without it,
// `status: published` (a push to `main` deploys it).
//
// Requirements for a hand-written post (see docs/blog-authoring.md):
// - File name must equal the frontmatter `slug`.
// - `id` must be a UUID (or 26-char nanoID) — generated here, never hand-typed.
// - A featured image requires `imageAlt`.
import { randomUUID } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const draftFlagIndex = args.indexOf("--draft");
const isDraft = draftFlagIndex !== -1;
if (draftFlagIndex !== -1) args.splice(draftFlagIndex, 1);
const title = args.join(" ").trim();

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(raw) {
  const slugged = raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slugged;
}

if (!title) {
  console.error('Usage: bun scripts/new-post.mjs "Judul Artikel" [--draft]');
  process.exit(1);
}

const slug = slugify(title);
if (!SLUG_PATTERN.test(slug)) {
  console.error(`"${title}" slugifies to "${slug}", which is not a valid slug.`);
  process.exit(1);
}

const target = join(process.cwd(), "src", "content", "blog", `${slug}.md`);
if (existsSync(target)) {
  console.error(`A post already exists at ${target}`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const frontmatter = [
  "---",
  `id: "${randomUUID()}"`,
  `slug: ${slug}`,
  `title: ${JSON.stringify(title)}`,
  'kicker: ""',
  'excerpt: ""',
  `publishedAt: ${today}`,
  `status: ${isDraft ? "draft" : "published"}`,
  "aliases: []",
  'image: ""',
  'imageAlt: ""',
  "---",
  "",
  "Tulis isi artikel di sini. Pasang gambar sesuai docs/blog-authoring.md:",
  "- Featured image: upload lewat dashboard CMS (Media) atau taruh di",
  "  src/images/blog/<slug>/cover.jpg lalu isi kolom image + imageAlt.",
  "- Gambar isi memakai bentuk relatif ../../images/… (lihat docs/blog-authoring.md).",
  "- Jalankan bun scripts/check-posts.mjs sebelum push.",
  "",
].join("\n");

writeFileSync(target, frontmatter, "utf8");
console.log(`Created ${target}`);
console.log("");
console.log(
  `Next steps (${isDraft ? "draft — invisible on the site" : "published — visible after deploy"}):`,
);
console.log("  1. Edit the file (title, excerpt, body, optional image fields).");
console.log("  2. Run `bun scripts/check-posts.mjs` to validate before pushing.");
console.log("  3. Commit and push to main — the Cloudflare deploy publishes it.");
