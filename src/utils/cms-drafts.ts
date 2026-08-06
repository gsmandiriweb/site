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

// The allowlist remains the interim identity guard until the CMS derives valid
// storage slugs from the repository's actual `src/content/blog/*` files.
const ALLOWED_STORAGE_SLUGS = new Set([
  "cara-memilih-pagar-brc",
  "atap-upvc-vs-alderon",
  "bondek-vs-wiremesh",
]);
const MAX_TEXT_LENGTH = 200_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStatus(value: unknown): value is DraftStatus {
  return value === "draft" || value === "ready" || value === "published" || value === "archived";
}

export function isSafeStorageSlug(value: unknown): value is string {
  return typeof value === "string" && ALLOWED_STORAGE_SLUGS.has(value);
}

export function validateMutationOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) throw new DraftActionError("A same-origin CMS mutation is required.", 403);
  try {
    if (new URL(origin).origin !== new URL(request.url).origin) {
      throw new DraftActionError("Cross-origin CMS mutations are not allowed.", 403);
    }
  } catch (error) {
    if (error instanceof DraftActionError) throw error;
    throw new DraftActionError("The CMS mutation origin is invalid.", 403);
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

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
  });
}
