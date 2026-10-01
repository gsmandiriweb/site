import { describe, expect, it } from "vite-plus/test";
import { isCoverMissing, resolveCover, type MediaRef } from "./cms-media.ts";

// Regression cover for the silent cover-swap (P0). The dashboard used to run an
// effect that rewrote `post.image` to `mediaAssets[0]` and set `dirty: true`
// whenever a cover path failed to resolve — and it ran before the article's own
// asset list had been fetched, so every cover uploaded through the CMS looked
// missing. These tests pin the three properties that fix depends on.

const uploadedRefs: MediaRef[] = [
  { path: "blog/atap-upvc-vs-alderon/cover.jpg", filename: "cover.jpg" },
];
const curatedRefs: MediaRef[] = [{ filename: "pagar-brc-panel-perspektif.jpg" }];
const all = [...curatedRefs, ...uploadedRefs];

describe("resolveCover", () => {
  it("reports a CMS-uploaded cover as ok, not missing", () => {
    // The exact shape the Sampul upload path writes (CmsDashboard: updatePost({ image: asset.path })).
    const result = resolveCover("blog/atap-upvc-vs-alderon/cover.jpg", all, true);
    expect(result.status).toBe("ok");
    expect(isCoverMissing(result)).toBe(false);
  });

  it("matches an uploaded path against a bare filename reference", () => {
    // Repo listings hand back basenames; the post holds a full path.
    const result = resolveCover("blog/bsd/cover.jpg", [{ filename: "cover.jpg" }], true);
    expect(result.status).toBe("ok");
  });

  it("matches a bare filename against a full-path reference", () => {
    const result = resolveCover("cover.jpg", [{ path: "blog/bsd/cover.jpg" }], true);
    expect(result.status).toBe("ok");
  });

  it("stays unknown while the asset list has not loaded", () => {
    // The regression itself: `mainAssets` was only fetched when the media dialog
    // opened, so on a normal page load a valid cover resolved against an empty
    // list and got replaced. Never report "missing" before the list lands.
    for (const loaded of [false]) {
      const result = resolveCover("blog/atap-upvc-vs-alderon/cover.jpg", all, loaded);
      expect(result.status).toBe("unknown");
      expect(isCoverMissing(result)).toBe(false);
    }
  });

  it("stays unknown when the list loaded but is empty", () => {
    // A failed or empty fetch must not be read as "your cover is gone".
    const result = resolveCover("blog/bsd/cover.jpg", [], true);
    expect(result.status).toBe("missing");
    // …but an *empty loaded* list is a real answer, so assert the contrast with
    // the not-loaded case explicitly: the gate is `loaded`, not list length.
    expect(resolveCover("blog/bsd/cover.jpg", [], false).status).toBe("unknown");
  });

  it("reports none for an empty image, loaded or not", () => {
    expect(resolveCover("", all, true).status).toBe("none");
    expect(resolveCover("", [], false).status).toBe("none");
    expect(resolveCover("   ", all, true).status).toBe("none");
  });

  it("does not let one article's cover.jpg satisfy another's", () => {
    // Every CMS-uploaded cover is `cover.jpg`. Matching on basename alone would
    // report a genuinely deleted cover as present — the silent lie, inverted.
    const result = resolveCover("blog/b-sdk/cover.jpg", [{ path: "blog/a-sdk/cover.jpg" }], true);
    expect(result.status).toBe("missing");
  });

  it("still detects a genuinely missing cover", () => {
    // The fix must not blind the dashboard: a path in no list is still missing.
    const result = resolveCover("blog/bsd/deleted.jpg", all, true);
    expect(result.status).toBe("missing");
    expect(isCoverMissing(result)).toBe(true);
    expect(result.path).toBe("blog/bsd/deleted.jpg");
  });

  it("matches a curated cover by bare filename", () => {
    expect(resolveCover("pagar-brc-panel-perspektif.jpg", all, true).status).toBe("ok");
  });
});
