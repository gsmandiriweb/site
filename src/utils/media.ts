// ADR 0011 media contract — pure validation helpers, no IO.
//
// - Only JPEG/PNG/WebP are accepted, detected by magic bytes (never extension).
// - Max 5 MB per file, 8000 px longest edge, read from the file header.
// - CMS-generated filenames: `[a-z0-9-]` only; featured image `cover.<ext>`,
//   body images `01-<name>.<ext>`, `02-…`; duplicates get a `-2` suffix.
// - References are repo-relative to `src/images/`: `blog/<slug>/cover.jpg`.

export const MEDIA_MAX_BYTES = 5 * 1024 * 1024;
export const MEDIA_MAX_EDGE_PX = 8000;

export type MediaType = "jpeg" | "png" | "webp";

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]
  );
}

function hasSignature(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

// Detect the image type from magic bytes. Returns null for anything else
// (SVG, GIF, AVIF, executables, text, …) — extension is never trusted.
export function detectMediaType(bytes: Uint8Array): MediaType | null {
  if (hasSignature(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (hasSignature(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (
    bytes.length >= 12 &&
    hasSignature(bytes, [0x52, 0x49, 0x46, 0x46]) && // "RIFF"
    hasSignature(bytes, [0x57, 0x45, 0x42, 0x50], 8) // "WEBP"
  ) {
    return "webp";
  }
  return null;
}

const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  let offset = 2;
  while (offset < bytes.length - 1) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xff || marker === 0x00) {
      offset += 1;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (offset + 3 > bytes.length) return null;
    const segmentLength = readUint16BE(bytes, offset + 2);
    if (JPEG_SOF_MARKERS.has(marker)) {
      if (offset + 9 > bytes.length) return null;
      return {
        height: readUint16BE(bytes, offset + 5),
        width: readUint16BE(bytes, offset + 7),
      };
    }
    offset += 2 + segmentLength;
  }
  return null;
}

function pngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  return {
    width: readUint32BE(bytes, 16),
    height: readUint32BE(bytes, 20),
  };
}

function webpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30) return null;
  // Chunk fourcc at offset 12. Valid: "VP8 " (lossy), "VP8L" (lossless), "VP8X" (extended).
  const fourcc = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (fourcc === "VP8 ") {
    // Lossy: 3-byte frame tag at 20, start code 0x9D 0x01 0x2A at 23–25, then
    // 14-bit little-endian width at 26, height at 28.
    if (!hasSignature(bytes, [0x9d, 0x01, 0x2a], 23)) return null;
    return {
      width: readUint16LE(bytes, 26) & 0x3fff,
      height: readUint16LE(bytes, 28) & 0x3fff,
    };
  }
  if (fourcc === "VP8L") {
    // Lossless: 0x2F signature at 20, then a 4-byte LE header — 14 bits
    // width-1, 14 bits height-1, 1 bit alpha, 2 bits version.
    if (bytes[20] !== 0x2f) return null;
    const b0 = bytes[21];
    const b1 = bytes[22];
    const b2 = bytes[23];
    const b3 = bytes[24];
    return {
      width: 1 + (b0 | ((b1 & 0x3f) << 8)),
      height: 1 + (((b1 & 0xc0) >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10)),
    };
  }
  if (fourcc === "VP8X") {
    // Extended: 0x0F at 20, then 24-bit LE (size-1) width at 24, height at 27.
    if (bytes[20] !== 0x0f) return null;
    return {
      width: 1 + readUint24LE(bytes, 24),
      height: 1 + readUint24LE(bytes, 27),
    };
  }
  return null;
}

export function readMediaDimensions(
  bytes: Uint8Array,
  type: MediaType,
): { width: number; height: number } | null {
  if (type === "jpeg") return jpegDimensions(bytes);
  if (type === "png") return pngDimensions(bytes);
  return webpDimensions(bytes);
}

// Returns a full validation verdict for an uploaded byte payload.
export function validateMediaBytes(bytes: Uint8Array):
  | {
      ok: true;
      type: MediaType;
      width: number;
      height: number;
    }
  | { ok: false; reason: string } {
  if (bytes.length === 0) return { ok: false, reason: "The uploaded file is empty." };
  if (bytes.length > MEDIA_MAX_BYTES) {
    return { ok: false, reason: "Files must be 5 MB or smaller." };
  }
  const type = detectMediaType(bytes);
  if (!type) {
    return {
      ok: false,
      reason: "Only JPEG, PNG, or WebP images are allowed (checked by content, not extension).",
    };
  }
  const dimensions = readMediaDimensions(bytes, type);
  if (!dimensions) {
    return { ok: false, reason: "The image header could not be read — the file may be corrupt." };
  }
  if (Math.max(dimensions.width, dimensions.height) > MEDIA_MAX_EDGE_PX) {
    return { ok: false, reason: "Images must be 8000 px or smaller on their longest edge." };
  }
  return { ok: true, type, width: dimensions.width, height: dimensions.height };
}

// Reduces any user-supplied name to the CMS character set: lowercase ASCII,
// digits, and single hyphens. Empty input falls back to "image".
export function sanitizeMediaBaseName(raw: string): string {
  const slugified = (raw || "image")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slugified || "image";
}

// Maps a frontmatter/body reference to a path relative to `src/images/`
// (`blog/<slug>/cover.jpg`). Accepts explicit paths with or without the
// `src/images/` or `/src/images/` prefix. Returns null for external URLs and
// data URIs, which are not repo-bound and are not gated.
export function normalizeMediaReference(reference: string): string | null {
  const trimmed = reference.trim();
  if (!trimmed || /^(?:https?:|data:|mailto:|#)/i.test(trimmed)) return null;
  const withoutPrefix = trimmed
    .replace(/^\/?src\/images\//, "")
    .replace(/^\/+/, "")
    .replace(/^\.\//, "");
  return withoutPrefix || null;
}

export function mediaFolder(storageSlug: string): string {
  return `blog/${storageSlug}`;
}

export function mediaRepoPath(reference: string): string {
  return `src/images/${reference.replace(/^\/?src\/images\//, "").replace(/^\/+/, "")}`;
}

// Extracts body image references from Markdown: `![alt](path)` links.
export function extractMarkdownImageReferences(markdown: string): string[] {
  const references: string[] = [];
  const pattern = /!\[[^\]]*\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) !== null) {
    const path = match[1]
      .trim()
      .split(/\s+(?=["'])/)[0]
      .trim();
    if (path) references.push(path);
  }
  return references;
}
