import type { CollectionEntry } from "astro:content";

export type BlogStatus = "draft" | "published" | "archived";

export type BlogEntry = CollectionEntry<"blog">;

/**
 * Compatibility bridge while existing Markdown files migrate from `date` and
 * `draft` to the portable `publishedAt` and `status` contract.
 */
export function blogStatus(entry: BlogEntry): BlogStatus {
  if (entry.data.status) return entry.data.status;
  // Legacy files without either field are private until explicitly migrated.
  return entry.data.draft === false ? "published" : "draft";
}

export function blogPublishedAt(entry: BlogEntry): Date {
  return entry.data.publishedAt ?? entry.data.date ?? new Date(0);
}

/**
 * The canonical slug is serialized in frontmatter. Keystatic's separate
 * storage slug controls the Markdown filename projection.
 */
export function blogSlug(entry: BlogEntry): string {
  return entry.data.slug;
}

export function blogAliases(entry: BlogEntry): string[] {
  return (entry.data.aliases ?? []).filter((alias) => alias !== blogSlug(entry));
}

export function isPublicBlogEntry(entry: BlogEntry): boolean {
  return blogStatus(entry) === "published";
}

export function sortPublishedBlogs(entries: BlogEntry[]): BlogEntry[] {
  return entries
    .filter(isPublicBlogEntry)
    .sort((a, b) => blogPublishedAt(b).valueOf() - blogPublishedAt(a).valueOf());
}

/**
 * Fail the build with a useful message instead of allowing duplicate stable
 * identities or static routes during content migration.
 */
export function validateBlogRoutes(entries: BlogEntry[]): void {
  const ids = new Set<string>();
  const routes = new Map<string, string>();

  for (const entry of entries) {
    if (ids.has(entry.data.id)) {
      throw new Error(`Duplicate blog stable id "${entry.data.id}" in "${entry.id}".`);
    }
    ids.add(entry.data.id);

    if (!isPublicBlogEntry(entry)) continue;

    if (!entry.data.publishedAt && !entry.data.date) {
      throw new Error(
        `Published blog "${entry.id}" is missing publishedAt/date. Add a publication date before publishing.`,
      );
    }

    if (entry.id !== blogSlug(entry)) {
      throw new Error(
        `Published blog "${entry.id}" has canonical slug "${blogSlug(entry)}". ` +
          "Rename the Markdown file to match its canonical slug.",
      );
    }

    const candidates = [blogSlug(entry), ...blogAliases(entry)];
    for (const route of candidates) {
      const previous = routes.get(route);
      if (previous && previous !== entry.id) {
        throw new Error(
          `Duplicate blog route "${route}" claimed by "${previous}" and "${entry.id}". ` +
            "Use a unique slug or alias.",
        );
      }
      routes.set(route, entry.id);
    }
  }
}
