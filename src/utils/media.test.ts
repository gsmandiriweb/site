import { describe, expect, it } from "vite-plus/test";
import {
  detectMediaType,
  mediaFolder,
  mediaReference,
  mediaRepoFolder,
  mediaRepoPath,
  normalizeMediaReference,
  sanitizeMediaBaseName,
} from "./media.ts";

// ADR 0011 media paths. Two different strings describe the same file and they
// must never be conflated:
//
//   reference            blog/<slug>/cover.jpg   (frontmatter, dashboard, gate)
//   repository path      src/images/blog/<slug>/cover.jpg   (GitHub contents API)
//
// The uploader once used the reference form as a repository path, which put
// every CMS image in a stray `blog/<slug>/` at the repo root while the gate
// resolved the reference somewhere else. These pin both directions.

describe("media folder paths", () => {
  it("keeps the reference form relative to src/images", () => {
    expect(mediaFolder("tes-5")).toBe("blog/tes-5");
  });

  it("addresses the post folder under src/images", () => {
    expect(mediaRepoFolder("tes-5")).toBe("src/images/blog/tes-5");
    expect(mediaRepoFolder("tes-5")).toBe(mediaRepoPath(mediaFolder("tes-5")));
  });

  it("never yields a repository path that is missing the src/images prefix", () => {
    for (const slug of ["tes-5", "cara-memilih-pagar-brc", "a"]) {
      const repoFolder = mediaRepoFolder(slug);
      expect(repoFolder.startsWith("src/images/")).toBe(true);
      expect(repoFolder).not.toBe(mediaFolder(slug));
    }
  });

  it("converts a repository path back to a reference", () => {
    expect(mediaReference("src/images/blog/tes-5/cover.png")).toBe("blog/tes-5/cover.png");
  });

  it("round-trips reference -> repo path -> reference", () => {
    const reference = "blog/tes-5/01-foto-gudang.jpg";
    expect(mediaReference(mediaRepoPath(reference))).toBe(reference);
  });

  it("leaves an already-relative path alone instead of doubling the prefix", () => {
    expect(mediaReference("blog/tes-5/cover.png")).toBe("blog/tes-5/cover.png");
    expect(mediaRepoPath(mediaReference("src/images/blog/tes-5/cover.png"))).toBe(
      "src/images/blog/tes-5/cover.png",
    );
  });
});

describe("normalizeMediaReference", () => {
  it("reduces repo paths and noisy forms to the reference form", () => {
    for (const input of [
      "blog/tes-5/cover.jpg",
      "/blog/tes-5/cover.jpg",
      "src/images/blog/tes-5/cover.jpg",
      "/src/images/blog/tes-5/cover.jpg",
      "../images/blog/tes-5/cover.jpg",
    ]) {
      expect(normalizeMediaReference(input)).toBe("blog/tes-5/cover.jpg");
    }
  });

  it("ignores references that are not repo-bound", () => {
    expect(normalizeMediaReference("https://example.com/a.png")).toBeNull();
    expect(normalizeMediaReference("data:image/png;base64,AAAA")).toBeNull();
    expect(normalizeMediaReference("   ")).toBeNull();
  });
});

describe("detectMediaType", () => {
  it("reads magic bytes, not extensions", () => {
    expect(detectMediaType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(detectMediaType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      "png",
    );
    expect(detectMediaType(new TextEncoder().encode("<svg></svg>"))).toBeNull();
  });
});

describe("sanitizeMediaBaseName", () => {
  it("produces a lowercase, hyphenated, url-safe base", () => {
    expect(sanitizeMediaBaseName("Foto Gudang (1).JPG")).toBe("foto-gudang-1");
    expect(sanitizeMediaBaseName("../../etc/passwd")).toBe("etc-passwd");
  });

  it("drops the extension the caller re-appends with the detected type", () => {
    expect(sanitizeMediaBaseName("foto.webp")).toBe("foto");
    expect(sanitizeMediaBaseName("foto.jpeg")).toBe("foto");
    expect(sanitizeMediaBaseName("foto.JPG")).toBe("foto");
    // A name that is only an extension has nothing left to use.
    expect(sanitizeMediaBaseName(".png")).toBe("image");
  });
});
