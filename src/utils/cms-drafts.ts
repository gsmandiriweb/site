export type DraftStatus = "draft" | "ready" | "published" | "archived";

export type DraftPost = {
  id: string;
  title: string;
  kicker: string;
  excerpt: string;
  body: string;
  date: string;
  publishedAt: string;
  slug: string;
  aliases: string[];
  image: string;
  imageAlt: string;
  storageSlug: string;
  status: DraftStatus;
  draft?: boolean;
};

// Storage slugs are validated by shape (ADR 0013: derive from the repository's
// actual blog files rather than a hard-coded allowlist). The slug character set
// doubles as the path-traversal guard: storageSlug is interpolated into
// `src/content/blog/<slug>.md`, branch names, and media folder paths, and
// `[a-z0-9-]` cannot escape those paths.
const STORAGE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_STORAGE_SLUG_LENGTH = 80;
const MAX_TEXT_LENGTH = 200_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStatus(value: unknown): value is DraftStatus {
  return value === "draft" || value === "ready" || value === "published" || value === "archived";
}

export function isSafeStorageSlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_STORAGE_SLUG_LENGTH &&
    STORAGE_SLUG_PATTERN.test(value)
  );
}

export function validateMutationOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) throw new DraftActionError("Mutasi CMS wajib berasal dari origin yang sama.", 403);
  try {
    if (new URL(origin).origin !== new URL(request.url).origin) {
      throw new DraftActionError("Mutasi CMS lintas origin tidak diizinkan.", 403);
    }
  } catch (error) {
    if (error instanceof DraftActionError) throw error;
    throw new DraftActionError("Origin mutasi CMS tidak valid.", 403);
  }
}

export function validateDraftPost(value: unknown, storageSlug: string): DraftPost | null {
  if (!isRecord(value) || !isSafeStorageSlug(storageSlug)) return null;
  const aliases = value.aliases;
  const fields = [
    "id",
    "title",
    "kicker",
    "excerpt",
    "body",
    "date",
    "publishedAt",
    "slug",
    "image",
    "imageAlt",
  ];
  if (fields.some((field) => typeof value[field] !== "string")) return null;
  // ADR 0011: alt text is required whenever a featured image is set.
  if (value.image && !value.imageAlt) return null;
  if (
    !Array.isArray(aliases) ||
    aliases.some((alias) => typeof alias !== "string") ||
    !isStatus(value.status) ||
    value.storageSlug !== storageSlug ||
    (value.draft !== undefined && typeof value.draft !== "boolean")
  ) {
    return null;
  }
  if (fields.some((field) => (value[field] as string).length > MAX_TEXT_LENGTH)) return null;
  if (aliases.length > 50 || aliases.some((alias) => alias.length > 500)) return null;

  return {
    id: value.id as string,
    title: value.title as string,
    kicker: value.kicker as string,
    excerpt: value.excerpt as string,
    body: value.body as string,
    date: value.date as string,
    publishedAt: value.publishedAt as string,
    slug: value.slug as string,
    aliases: [...aliases] as string[],
    image: value.image as string,
    imageAlt: value.imageAlt as string,
    storageSlug,
    status: value.status,
    draft: value.draft as boolean | undefined,
  };
}

export class DraftActionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "DraftActionError";
  }
}

/**
 * Emits a YAML scalar: JSON-quoted when it contains quotes, backslashes, or
 * control characters; bare otherwise. An empty value becomes `""` — a bare
 * `image: ` would parse as YAML null, which the blog schema rejects.
 */
function yamlScalar(value: string): string {
  const needsQuotes = value === "" || /["\\]/.test(value) || /\p{C}/u.test(value);
  return needsQuotes ? JSON.stringify(value) : value;
}

/**
 * `image`/`imageAlt` are optional strings. Empty values serialize as `""`
 * rather than being dropped or left bare, so every CMS-written file has a
 * stable, round-trippable frontmatter shape.
 */
function yamlOptionalText(value: string | undefined): string {
  return yamlScalar(value?.trim() ? value : "");
}

export function serializeDraftMarkdown(post: DraftPost): string {
  const status = post.status === "ready" ? "draft" : post.status;
  return `---
id: ${yamlScalar(post.id)}
slug: ${yamlScalar(post.slug)}
title: ${JSON.stringify(post.title)}
kicker: ${JSON.stringify(post.kicker)}
excerpt: ${JSON.stringify(post.excerpt)}
publishedAt: ${post.publishedAt}
status: ${status}
aliases: ${JSON.stringify(post.aliases)}
image: ${yamlOptionalText(post.image)}
imageAlt: ${JSON.stringify(post.imageAlt)}
date: ${post.date}
draft: ${post.draft ? "true" : "false"}
---

${post.body.trim()}
`;
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
  });
}
