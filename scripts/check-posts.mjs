#!/usr/bin/env node
// Local validator for `src/content/blog/*.md` posts — mirrors the checks the
// Astro build (src/utils/blog.ts validateBlogRoutes + the content schema) runs,
// plus the ADR 0011 image-reference contract that the build does NOT catch for
// body images. Run before pushing:
//
//   bun scripts/check-posts.mjs
//
// Exit code 0 = safe to push. Errors are contract violations that will break
// the build or publish a broken page; warnings are footguns worth fixing.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BLOG_DIR = join(process.cwd(), "src", "content", "blog");
const IMAGES_DIR = join(process.cwd(), "src", "images");

const ID_PATTERN =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9a-hj-km-np-tv-z]{26})$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BODY_IMAGE_PATTERN = /!\[[^\]]*\]\(([^)]+)\)/g;

const errors = [];
const warnings = [];
const seenIds = new Set();
const seenSlugs = new Set();

function error(message) {
  errors.push(message);
}
function warn(message) {
  warnings.push(message);
}

function parseFrontmatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return null;
  const data = {};
  for (const line of match[1].split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf(":");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (value.startsWith('"') || value.startsWith("'")) {
      try {
        value = JSON.parse(value);
      } catch {
        value = value.slice(1, -1);
      }
    }
    data[key] = value;
  }
  return { data, body: source.slice(match[0].length) };
}

function collectImageFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectImageFiles(full, out);
    else out.push(full);
  }
  return out;
}

const imageFiles = collectImageFiles(IMAGES_DIR);
const byBasename = new Map();
for (const file of imageFiles) {
  const name = file.split("/").pop().toLowerCase();
  if (!byBasename.has(name)) byBasename.set(name, file);
}

function resolveReference(reference) {
  const trimmed = String(reference).trim();
  if (!trimmed || /^(?:https?:|data:|mailto:|#)/i.test(trimmed)) return true; // external, not gated
  const normalized = trimmed
    .replace(/^\/?src\/images\//, "")
    .replace(/^(?:\.\.\/)+(?:images\/)?/, "")
    .replace(/^\/+/, "")
    .replace(/^\.\//, "");
  if (!normalized) return true;
  const explicit = join(IMAGES_DIR, normalized);
  if (existsSync(explicit)) return true;
  const fallback = byBasename.get(normalized.split("/").pop().toLowerCase());
  if (fallback) return true;
  return false;
}

const entries = readdirSync(BLOG_DIR)
  .filter((name) => name.endsWith(".md"))
  .sort();

if (entries.length === 0) {
  console.log("No posts found under src/content/blog/.");
  process.exit(0);
}

for (const filename of entries) {
  const filePath = join(BLOG_DIR, filename);
  const label = `src/content/blog/${filename}`;
  const source = readFileSync(filePath, "utf8");
  const parsed = parseFrontmatter(source);
  if (!parsed) {
    error(`${label}: could not read the --- frontmatter block.`);
    continue;
  }
  const data = parsed.data;
  const slug = String(data.slug ?? "");

  if (!ID_PATTERN.test(String(data.id ?? ""))) {
    error(
      `${label}: \`id\` must be a UUID or 26-char nanoID — run \`bun scripts/new-post.mjs\` to generate one.`,
    );
  }
  if (!SLUG_PATTERN.test(slug)) {
    error(`${label}: \`slug\` must be lowercase letters, numbers, and hyphens.`);
  }
  if (seenIds.has(String(data.id))) {
    error(`${label}: duplicate stable id \`${data.id}\` (must be unique).`);
  }
  seenIds.add(String(data.id));
  if (seenSlugs.has(slug)) {
    error(`${label}: duplicate slug \`${slug}\` (must be unique).`);
  }
  seenSlugs.add(slug);

  const hasStatus = data.status !== undefined;
  const status = String(data.status ?? (data.draft === "false" ? "published" : "draft"));
  if (!hasStatus && data.draft === undefined) {
    warn(
      `${label}: no \`status\` or \`draft\` field — this post defaults to DRAFT and will NOT appear on the site. Add \`status: published\` to publish.`,
    );
  }
  const isPublished = status === "published";
  if (isPublished) {
    if (!data.publishedAt && !data.date) {
      error(`${label}: published posts need \`publishedAt\` (or legacy \`date\`).`);
    }
    const baseName = filename.replace(/\.md$/, "");
    if (baseName !== slug) {
      error(
        `${label}: the file name ("${baseName}") must equal the frontmatter \`slug\` ("${slug}"). Rename the file — the build fails otherwise.`,
      );
    }
  }

  if (data.image && !data.imageAlt) {
    error(`${label}: \`imageAlt\` is required whenever \`image\` is set.`);
  }
  if (data.image && !resolveReference(data.image)) {
    error(
      `${label}: featured image "${data.image}" does not resolve — expected a file under src/images/ (e.g. blog/${slug}/cover.jpg).`,
    );
  }

  const bodyReferences = [];
  const bodyMatch = parsed.body.match(BODY_IMAGE_PATTERN) ?? [];
  for (const match of bodyMatch) {
    const path = match
      .slice(match.indexOf("(") + 1, match.lastIndexOf(")"))
      .trim()
      .split(/\s+(?=["'])/)[0];
    if (path) bodyReferences.push(path);
  }
  for (const reference of bodyReferences) {
    if (!resolveReference(reference)) {
      error(
        `${label}: body image "${reference}" does not resolve — use the ../../images/… form (relative to the post file, pointing at src/images) or an external URL.`,
      );
    }
  }
}

if (errors.length || warnings.length) {
  for (const warn of warnings) console.log(`WARN  ${warn}`);
  for (const error of errors) console.log(`ERROR ${error}`);
  console.log("");
  console.log(
    `${errors.length} error(s), ${warnings.length} warning(s) — ${errors.length ? "fix errors before pushing." : "warnings are optional but worth a look."}`,
  );
  process.exit(errors.length ? 1 : 0);
}
console.log(`✅ All ${entries.length} post${entries.length === 1 ? "" : "s"} pass the contract.`);
