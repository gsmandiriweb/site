import { configuredGitHubPat, readAdminSession, runtimeEnv } from "./admin-session.ts";
import {
  DraftActionError,
  isSafeStorageSlug,
  validateDraftPost,
  validateMutationOrigin,
  type DraftPost,
} from "./cms-drafts.ts";
import { imageAsset } from "./images.ts";
import {
  extractMarkdownImageReferences,
  mediaFolder,
  mediaRepoPath,
  normalizeMediaReference,
  sanitizeMediaBaseName,
  type MediaType,
} from "./media.ts";

const REPOSITORY = "gsmandiriweb/site";
const DEFAULT_BRANCH = "main";
const GITHUB_API_VERSION = "2022-11-28";

export type DraftPullRequest = {
  storageSlug: string;
  revision: number;
  branch: string;
  prNumber: number;
  prUrl: string;
  headSha: string;
  status: "open" | "merged" | "closed";
  updatedAt: string;
  contentFingerprint?: string;
};

type GitHubPull = {
  number?: unknown;
  html_url?: unknown;
  state?: unknown;
  merged_at?: unknown;
  title?: unknown;
  body?: unknown;
  head?: { ref?: unknown; sha?: unknown };
};

function storagePath(storageSlug: string): string {
  return `src/content/blog/${storageSlug}.md`;
}

function branchName(storageSlug: string, revision: number): string {
  return `cms/${storageSlug}/r${revision}`;
}

function revisionFromBranch(branch: string): number | null {
  const match = /^cms\/[^/]+\/r(\d+)$/.exec(branch);
  return match ? Number(match[1]) : null;
}

function apiUrlFor(env: Awaited<ReturnType<typeof runtimeEnv>>): string {
  return import.meta.env.DEV
    ? (env.CMS_GITHUB_API_URL ?? "https://api.github.com")
    : "https://api.github.com";
}

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value: string): string {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function serializeDraftMarkdown(post: DraftPost): string {
  const status = post.status === "ready" ? "draft" : post.status;
  return `---
id: ${post.id}
slug: ${post.slug}
title: ${JSON.stringify(post.title)}
kicker: ${JSON.stringify(post.kicker)}
excerpt: ${JSON.stringify(post.excerpt)}
publishedAt: ${post.publishedAt}
status: ${status}
aliases: ${JSON.stringify(post.aliases)}
image: ${post.image}
imageAlt: ${JSON.stringify(post.imageAlt)}
date: ${post.date}
draft: ${post.draft ? "true" : "false"}
---

${post.body.trim()}
`;
}

export function prMetadataBlock(
  storageSlug: string,
  revision: number,
  fingerprint: string,
  media: string[],
): string {
  return [
    "<!-- bsm-cms:revision v1",
    `storageSlug: ${storageSlug}`,
    `revision: ${revision}`,
    `contentFingerprint: sha256:${fingerprint}`,
    `media: [${media.join(", ")}]`,
    "-->",
  ].join("\n");
}

export function parsePrMetadata(body: string): {
  storageSlug?: string;
  revision?: number;
  contentFingerprint?: string;
  media?: string[];
} {
  const result: {
    storageSlug?: string;
    revision?: number;
    contentFingerprint?: string;
    media?: string[];
  } = {};
  const match = body.match(/<!--\s*bsm-cms:revision\s+v1\s*\n([\s\S]*?)\n-->/);
  const block = match ? match[1] : body;
  for (const line of block.split("\n")) {
    const separator = line.indexOf(":");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key === "storageSlug") {
      result.storageSlug = value;
    } else if (key === "revision" && /^\d+$/.test(value)) {
      result.revision = Number(value);
    } else if (key === "contentFingerprint") {
      result.contentFingerprint = value.replace(/^sha256:/, "");
    } else if (key === "media") {
      result.media = value
        .replace(/^\[/, "")
        .replace(/\]$/, "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  }
  return result;
}

export async function computeContentFingerprint(markdown: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(markdown));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function githubHeaders(pat: string, includeJson = false): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${pat}`,
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    "User-Agent": "bsm-cms",
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
  };
}

async function githubRequest(
  apiUrl: string,
  pat: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${apiUrl}/repos/${REPOSITORY}${path}`, {
    ...init,
    headers: { ...githubHeaders(pat, Boolean(init.body)), ...init.headers },
  });
}

async function githubJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as T | null;
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `GitHub returned HTTP ${response.status}.`;
    throw new DraftActionError(message, response.status === 422 ? 409 : 502);
  }
  return payload as T;
}

function pullStatus(pull: GitHubPull): DraftPullRequest["status"] {
  return pull.merged_at ? "merged" : pull.state === "closed" ? "closed" : "open";
}

function toDraftPullRequest(
  storageSlug: string,
  revision: number,
  pull: GitHubPull,
  fingerprint?: string,
): DraftPullRequest {
  const prNumber = typeof pull.number === "number" ? pull.number : 0;
  const prUrl = typeof pull.html_url === "string" ? pull.html_url : "";
  const headSha = typeof pull.head?.sha === "string" ? pull.head.sha : "";
  return {
    storageSlug,
    revision,
    branch: branchName(storageSlug, revision),
    prNumber,
    prUrl,
    headSha,
    status: pullStatus(pull),
    updatedAt: new Date().toISOString(),
    contentFingerprint: fingerprint,
  };
}

async function listRevisionPulls(
  apiUrl: string,
  pat: string,
  storageSlug: string,
): Promise<GitHubPull[]> {
  const response = await githubRequest(
    apiUrl,
    pat,
    `/pulls?state=all&base=${DEFAULT_BRANCH}&sort=updated&direction=desc&per_page=100`,
  );
  const pulls = await githubJson<GitHubPull[]>(response);
  const prefix = `cms/${storageSlug}/r`;
  return pulls.filter(
    (pull) => typeof pull.head?.ref === "string" && pull.head.ref.startsWith(prefix),
  );
}

// Reads the current `main` content of a blog post so the editor can load the
// live repository source (the seeded demo content is the offline fallback).
export async function readMainPostSource(
  request: Request,
  storageSlug: string,
): Promise<string | null> {
  if (!(await readAdminSession(request))) return null;
  if (!isSafeStorageSlug(storageSlug)) return null;
  const pat = await configuredGitHubPat();
  if (!pat) return null;
  const env = await runtimeEnv();
  const apiUrl = apiUrlFor(env);
  const response = await githubRequest(
    apiUrl,
    pat,
    `/contents/${storagePath(storageSlug)}?ref=${DEFAULT_BRANCH}`,
  );
  if (!response.ok) return null;
  const file = (await response.json().catch(() => null)) as {
    content?: unknown;
    encoding?: unknown;
  } | null;
  if (!file || file.encoding !== "base64" || typeof file.content !== "string") return null;
  return decodeBase64(file.content);
}

export type MediaAssetEntry = {
  path: string; // repo-relative to src/images: blog/<slug>/cover.jpg
  filename: string;
  bytes: number;
  url: string;
};

export type MediaListing = {
  revision: number;
  branch: string;
  assets: MediaAssetEntry[]; // present on the pending revision branch
  mainAssets: MediaAssetEntry[]; // merged assets on main
};

export type UploadedMediaAsset = MediaAssetEntry & {
  revision: number;
  branch: string;
  width?: number;
  height?: number;
  type?: MediaType;
};

export type UploadMediaInput = {
  kind: "cover" | "body";
  rawName: string;
  bytes: Uint8Array;
  type: MediaType;
  width: number;
  height: number;
};

function rawMediaUrl(branch: string, path: string): string {
  return `https://raw.githubusercontent.com/${REPOSITORY}/${branch}/src/images/${path}`;
}

// ADR 0013: uploads belong to the *pending* revision — the branch that the next
// save-revision-and-open-PR action will promote. An open PR is never mutated;
// the next save always opens a fresh revision (superseding the older PR).
export async function pendingMediaRevision(
  request: Request,
  storageSlug: string,
): Promise<{ revision: number; branch: string }> {
  const latest = await currentDraftPullRequest(request, storageSlug);
  const revision = (latest?.revision ?? 0) + 1;
  return { revision, branch: branchName(storageSlug, revision) };
}

async function ensureRevisionBranch(apiUrl: string, pat: string, branch: string): Promise<void> {
  const baseRef = await githubJson<{ object?: { sha?: unknown } }>(
    await githubRequest(apiUrl, pat, `/git/ref/heads/${DEFAULT_BRANCH}`),
  );
  const baseSha = baseRef && typeof baseRef.object?.sha === "string" ? baseRef.object.sha : null;
  if (!baseSha) throw new DraftActionError("GitHub returned no base branch SHA.", 502);
  const response = await githubRequest(apiUrl, pat, "/git/refs", {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
  });
  if (!response.ok && response.status !== 422) await githubJson(response);
}

async function listRepoFolder(
  apiUrl: string,
  pat: string,
  path: string,
  ref: string,
): Promise<Array<{ name: string; path: string; size: number }>> {
  const response = await githubRequest(apiUrl, pat, `/contents/${path}?ref=${ref}`);
  if (response.status === 404) return [];
  const payload = await githubJson<unknown>(response);
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    return typeof record.name === "string" &&
      typeof record.path === "string" &&
      typeof record.size === "number"
      ? [{ name: record.name, path: record.path, size: record.size }]
      : [];
  });
}

function nextAvailableName(base: string, extension: string, existing: Set<string>): string {
  let candidate = `${base}.${extension}`;
  let suffix = 2;
  while (existing.has(candidate)) {
    candidate = `${base}-${suffix}.${extension}`;
    suffix += 1;
  }
  return candidate;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

// Lists the media folder for a post: what is staged on the pending revision
// branch (uploaded this session) and what is already merged on main.
export async function listMediaAssets(
  request: Request,
  storageSlug: string,
): Promise<MediaListing> {
  if (!(await readAdminSession(request)))
    throw new DraftActionError("Authentication required.", 401);
  if (!isSafeStorageSlug(storageSlug))
    throw new DraftActionError("The draft identity is invalid.", 400);
  const pat = await configuredGitHubPat();
  const env = await runtimeEnv();
  const apiUrl = apiUrlFor(env);
  const { revision, branch } = await pendingMediaRevision(request, storageSlug);
  const folder = mediaFolder(storageSlug);
  if (!pat) return { revision, branch, assets: [], mainAssets: [] };
  const [pendingEntries, mainEntries] = await Promise.all([
    listRepoFolder(apiUrl, pat, folder, branch),
    listRepoFolder(apiUrl, pat, folder, DEFAULT_BRANCH),
  ]);
  const toEntry = (
    entry: { name: string; path: string; size: number },
    ref: string,
  ): MediaAssetEntry => ({
    path: entry.path,
    filename: entry.name,
    bytes: entry.size,
    url: rawMediaUrl(ref, entry.path),
  });
  return {
    revision,
    branch,
    assets: pendingEntries.map((entry) => toEntry(entry, branch)),
    mainAssets: mainEntries.map((entry) => toEntry(entry, DEFAULT_BRANCH)),
  };
}

// Commits an uploaded image into `src/images/blog/<slug>/` on the pending
// revision branch (ADR 0011). Validation of type/limits happens upstream via
// `validateMediaBytes`; this function owns naming + the git write.
export async function uploadMediaFile(
  request: Request,
  storageSlug: string,
  input: UploadMediaInput,
): Promise<UploadedMediaAsset> {
  if (!(await readAdminSession(request)))
    throw new DraftActionError("Authentication required.", 401);
  validateMutationOrigin(request);
  if (!isSafeStorageSlug(storageSlug))
    throw new DraftActionError("The draft identity is invalid.", 400);

  const pat = await configuredGitHubPat();
  if (!pat) throw new DraftActionError("CMS GitHub access is not configured.", 503);
  const env = await runtimeEnv();
  const apiUrl = apiUrlFor(env);

  const { revision, branch } = await pendingMediaRevision(request, storageSlug);
  await ensureRevisionBranch(apiUrl, pat, branch);

  const folder = mediaFolder(storageSlug);
  const existingNames = new Set(
    (await listRepoFolder(apiUrl, pat, folder, branch)).map((entry) => entry.name),
  );
  const extension = input.type === "jpeg" ? "jpg" : input.type;
  const base = sanitizeMediaBaseName(input.rawName);
  let filename: string;
  if (input.kind === "cover") {
    filename = nextAvailableName("cover", extension, existingNames);
  } else {
    const bodyCount = [...existingNames].filter((name) => /^\d{2}-/.test(name)).length;
    const numberPrefix = String(bodyCount + 1).padStart(2, "0");
    filename = nextAvailableName(`${numberPrefix}-${base}`, extension, existingNames);
  }
  const path = `${folder}/${filename}`;

  const response = await githubRequest(apiUrl, pat, `/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `cms: upload media ${path} (${storageSlug} revision ${revision})`,
      content: bytesToBase64(input.bytes),
      branch,
    }),
  });
  await githubJson(response);

  return {
    revision,
    branch,
    path,
    filename,
    bytes: input.bytes.length,
    width: input.width,
    height: input.height,
    type: input.type,
    url: rawMediaUrl(branch, path),
  };
}

// ADR 0011 dangling-reference gate: every `image:` frontmatter and `![…](…)`
// body reference must resolve on the revision branch (or, for legacy pool
// basenames, in the repository's build-time asset pool) before a PR may open.
// Returns the unresolved references; callers throw to block PR creation.
export async function verifyImageReferences(
  apiUrl: string,
  pat: string,
  branch: string,
  references: string[],
): Promise<string[]> {
  const unresolved: string[] = [];
  for (const reference of references) {
    const normalized = normalizeMediaReference(reference);
    if (!normalized) continue; // external URLs / data URIs are not repo-bound
    const response = await githubRequest(
      apiUrl,
      pat,
      `/contents/${mediaRepoPath(normalized)}?ref=${branch}`,
    );
    if (response.ok) continue;
    if (response.status !== 404) await githubJson(response);
    // Legacy fallback: basename references to the pre-contract pool resolve via
    // the same build-time pool the public site uses (ADR 0011 migration keeps
    // this fallback alive for catalog references). `imageAsset`'s eager glob
    // brings image metadata into this chunk — accepted so the fallback can
    // never drift from the real asset pool.
    try {
      imageAsset(normalized);
    } catch {
      unresolved.push(reference.trim());
    }
  }
  return unresolved;
}

export async function currentDraftPullRequest(
  request: Request,
  storageSlug: string,
  revision?: number,
): Promise<DraftPullRequest | null> {
  if (!(await readAdminSession(request)))
    throw new DraftActionError("Authentication required.", 401);
  if (!isSafeStorageSlug(storageSlug))
    throw new DraftActionError("The draft identity is invalid.", 400);
  const pat = await configuredGitHubPat();
  if (!pat) return null;
  const env = await runtimeEnv();
  const apiUrl = apiUrlFor(env);

  const pulls = await listRevisionPulls(apiUrl, pat, storageSlug);
  let selected: GitHubPull | null = null;
  let selectedRevision = 0;
  for (const pull of pulls) {
    if (typeof pull.head?.ref !== "string") continue;
    const candidate = revisionFromBranch(pull.head.ref);
    if (candidate === null) continue;
    if (revision !== undefined) {
      if (candidate === revision) {
        selected = pull;
        selectedRevision = candidate;
        break;
      }
    } else if (candidate > selectedRevision) {
      selected = pull;
      selectedRevision = candidate;
    }
  }
  if (!selected || selectedRevision < 1) return null;
  const body = typeof selected.body === "string" ? selected.body : "";
  const metadata = parsePrMetadata(body);
  return toDraftPullRequest(storageSlug, selectedRevision, selected, metadata.contentFingerprint);
}

async function findPullRequestByHead(
  apiUrl: string,
  pat: string,
  storageSlug: string,
  revision: number,
  branch: string,
): Promise<DraftPullRequest | null> {
  const pulls = await listRevisionPulls(apiUrl, pat, storageSlug);
  const match = pulls.find(
    (pull) => typeof pull.head?.ref === "string" && pull.head.ref === branch,
  );
  if (!match || typeof match.number !== "number" || typeof match.html_url !== "string") return null;
  const body = typeof match.body === "string" ? match.body : "";
  const metadata = parsePrMetadata(body);
  return toDraftPullRequest(storageSlug, revision, match, metadata.contentFingerprint);
}

async function supersedeOlderPullRequests(
  apiUrl: string,
  pat: string,
  storageSlug: string,
  newPrNumber: number,
  newPrUrl: string,
): Promise<void> {
  const pulls = await listRevisionPulls(apiUrl, pat, storageSlug);
  for (const pull of pulls) {
    if (typeof pull.number !== "number" || pull.number === newPrNumber) continue;
    if (pull.state !== "open" || pull.merged_at) continue;
    try {
      await githubRequest(apiUrl, pat, `/pulls/${pull.number}`, {
        method: "PATCH",
        body: JSON.stringify({ state: "closed" }),
      });
      await githubRequest(apiUrl, pat, `/issues/${pull.number}/comments`, {
        method: "POST",
        body: JSON.stringify({
          body: `Superseded by a newer CMS revision. See PR #${newPrNumber}: ${newPrUrl}`,
        }),
      });
    } catch {
      // Best effort: a failed supersede must not abort the new revision.
    }
  }
}

export async function createDraftPullRequest(
  request: Request,
  storageSlug: string,
  value: unknown,
): Promise<DraftPullRequest> {
  if (!(await readAdminSession(request)))
    throw new DraftActionError("Authentication required.", 401);
  validateMutationOrigin(request);
  // ADR 0011: alt text is required whenever a featured image is set. Checked
  // against the raw payload so the friendly message wins over the generic
  // invalid-payload rejection below.
  const rawPayload = value as Record<string, unknown> | null;
  if (
    rawPayload &&
    typeof rawPayload === "object" &&
    !Array.isArray(rawPayload) &&
    typeof rawPayload.image === "string" &&
    rawPayload.image &&
    typeof rawPayload.imageAlt !== "string"
  ) {
    throw new DraftActionError(
      "A featured image requires alt text (imageAlt) before a revision can be saved.",
      400,
    );
  }
  const post = validateDraftPost(value, storageSlug);
  if (!post) throw new DraftActionError("The draft payload is invalid.", 400);

  const pat = await configuredGitHubPat();
  if (!pat) throw new DraftActionError("CMS GitHub access is not configured.", 503);
  const env = await runtimeEnv();
  const apiUrl = apiUrlFor(env);

  const latest = await currentDraftPullRequest(request, storageSlug);
  const revision = (latest?.revision ?? 0) + 1;
  const branch = branchName(storageSlug, revision);
  const path = storagePath(storageSlug);
  const markdown = serializeDraftMarkdown(post);
  const fingerprint = await computeContentFingerprint(markdown);
  const media = [post.image, ...extractMarkdownImageReferences(post.body)]
    .map((reference) => normalizeMediaReference(reference))
    .filter((reference): reference is string => Boolean(reference));

  const existing = await findPullRequestByHead(apiUrl, pat, storageSlug, revision, branch);
  if (existing && (existing.status === "open" || existing.status === "merged")) return existing;

  // ADR 0011 dangling-reference gate: a broken PR cannot be created. Images must
  // have been uploaded to the pending revision branch (or resolve in the legacy
  // pool) before the revision may open.
  const references = [post.image, ...extractMarkdownImageReferences(post.body)];
  const unresolved = await verifyImageReferences(apiUrl, pat, branch, references);
  if (unresolved.length > 0) {
    throw new DraftActionError(
      `Cannot open the PR: unresolvable image reference${unresolved.length === 1 ? "" : "s"} on revision branch ${branch}: ${unresolved.join(", ")}. Upload the image in the Media workspace first.`,
      409,
    );
  }

  const baseRef = await githubJson<{ object?: { sha?: unknown } }>(
    await githubRequest(apiUrl, pat, `/git/ref/heads/${DEFAULT_BRANCH}`),
  );
  const baseSha = baseRef && typeof baseRef.object?.sha === "string" ? baseRef.object.sha : null;
  if (!baseSha) throw new DraftActionError("GitHub returned no base branch SHA.", 502);

  const branchResponse = await githubRequest(apiUrl, pat, "/git/refs", {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
  });
  if (!branchResponse.ok && branchResponse.status !== 422) {
    await githubJson(branchResponse);
  }

  const currentFileResponse = await githubRequest(
    apiUrl,
    pat,
    `/contents/${path}?ref=${encodeURIComponent(branch)}`,
  );
  let fileSha: string | undefined;
  if (currentFileResponse.ok) {
    const currentFile = await githubJson<{ sha?: unknown }>(currentFileResponse);
    if (typeof currentFile.sha === "string") fileSha = currentFile.sha;
  } else if (currentFileResponse.status !== 404) {
    await githubJson(currentFileResponse);
  }

  const commitResponse = await githubRequest(apiUrl, pat, `/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `cms: update ${storageSlug} revision ${revision}`,
      content: encodeBase64(markdown),
      branch,
      ...(fileSha ? { sha: fileSha } : {}),
    }),
  });
  const commit = await githubJson<{ commit?: { sha?: unknown } }>(commitResponse);
  const headSha = typeof commit.commit?.sha === "string" ? commit.commit.sha : null;
  if (!headSha) throw new DraftActionError("GitHub returned no draft commit SHA.", 502);

  const metadata = prMetadataBlock(storageSlug, revision, fingerprint, media);
  const created = await githubJson<GitHubPull>(
    await githubRequest(apiUrl, pat, "/pulls", {
      method: "POST",
      body: JSON.stringify({
        title: `CMS: ${post.title}`,
        head: branch,
        base: DEFAULT_BRANCH,
        body: `${metadata}\n\nAutomated CMS draft for **${storageSlug}** revision **${revision}**. Review the generated content before merging.`,
        draft: true,
      }),
    }),
  );
  if (typeof created.number !== "number" || typeof created.html_url !== "string") {
    throw new DraftActionError("GitHub returned an incomplete pull request.", 502);
  }

  await supersedeOlderPullRequests(apiUrl, pat, storageSlug, created.number, created.html_url);

  return toDraftPullRequest(storageSlug, revision, created, fingerprint);
}
