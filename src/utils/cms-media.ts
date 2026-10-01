// Cover-path resolution for the CMS dashboard.
//
// This was an effect that mutated `post.image` and set `dirty: true` whenever a
// cover path failed to resolve against the loaded asset lists. That was wrong
// twice over: the check ran before `mainAssets` had been fetched (they were only
// loaded when the media dialog opened), so every cover uploaded through the CMS
// — stored as `blog/<slug>/<file>` — looked missing; and the "fix" silently
// replaced the owner's cover with a stock photo and marked the post dirty, with
// no discard control anywhere in the dashboard. The only offered exit was
// "Kirim revisi": one click from publishing the wrong cover to production.
//
// The rule is now that the dashboard never edits a cover on its own. It reports
// what it found and lets the owner act, so the decision lives here as a pure
// function that can be tested without a DOM.

export type MediaRef = { path?: string; filename?: string };

export type CoverStatus = "none" | "ok" | "unknown" | "missing";

export type CoverResolution = {
  status: CoverStatus;
  /** The repo path the cover points at, normalised to a comparable form. */
  path: string;
};

/** `blog/<slug>/cover.jpg` and `cover.jpg` name the same file. */
function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

// Matching is directional, because every article's uploaded cover is called
// `cover.jpg`: a post holding a full path may only match that exact path, or a
// reference that names it as a bare filename. Falling back to basename on both
// sides would let `blog/b-sdk/cover.jpg` satisfy `blog/a-sdk/cover.jpg` and
// report a missing cover as present — the same class of silent lie, inverted.
function matches(ref: MediaRef, path: string): boolean {
  const isPath = path.includes("/");
  if (isPath) {
    if (ref.path === path) return true;
    return Boolean(ref.filename && ref.filename === basename(path));
  }
  if (ref.filename === path) return true;
  if (ref.path === path) return true;
  return Boolean(ref.path && basename(ref.path) === path);
}

/**
 * Classify a post's cover against the assets known for that article.
 *
 * `loaded` must be false until the article's asset list has actually arrived.
 * While it is false the answer is "unknown" — never "missing" — so a cover that
 * is perfectly fine cannot be reported as broken just because the fetch has not
 * landed yet (or failed, or the owner is working offline).
 */
export function resolveCover(
  image: string,
  refs: readonly MediaRef[],
  loaded: boolean,
): CoverResolution {
  const path = image.trim();
  if (!path) return { status: "none", path: "" };
  if (!loaded) return { status: "unknown", path };
  const found = refs.some((ref) => matches(ref, path));
  return { status: found ? "ok" : "missing", path };
}

/** True only for a cover the dashboard positively failed to find. */
export function isCoverMissing(resolution: CoverResolution): boolean {
  return resolution.status === "missing";
}
