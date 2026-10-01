import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  Inbox,
  LoaderCircle,
  LogOut,
  Moon,
  Plus,
  Sun,
  Upload,
  WifiOff,
  X,
} from "lucide-react";
import { Badge, Button, Card, Input } from "./ui";
import MarkdownWysiwyg from "./MarkdownWysiwyg";
import { serializeDraftMarkdown } from "../utils/cms-drafts.ts";
import { isCoverMissing, resolveCover } from "../utils/cms-media.ts";

// Posts are keyed by storage slug (the filename without .md): the repository
// listing (ADR 0013) plus locally created browser drafts. `dirty` marks a post
// whose local copy diverges from its last loaded/saved GitHub state; the repo
// source is only ever overlaid onto a post that is not dirty.
type PostKey = string;
type ContentStatus = "draft" | "ready" | "published" | "archived";
type DeployInfo = { commitSha?: string; deployedAt?: string };

type Post = {
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
  status: ContentStatus;
  draft?: boolean;
  // True while the local copy has edits not yet sent as a revision PR (or
  // reloaded from the repo). Persisted alongside the post in localStorage so
  // the repo listing never clobbers in-progress work across reloads.
  dirty?: boolean;
};

type DraftPullRequest = {
  storageSlug: string;
  revision: number;
  branch: string;
  prNumber: number;
  prUrl: string;
  headSha: string;
  status: "open" | "merged" | "closed";
  updatedAt: string;
};

type GithubState = {
  pullRequest: DraftPullRequest | null;
  live: boolean;
};

type MediaAsset = {
  filename: string;
  src: string;
  label: string;
  alt: string;
};

type UploadedMediaEntry = {
  path: string; // repo-relative to src/images: blog/<slug>/cover.jpg
  filename: string;
  bytes: number;
  url: string;
};

type PersistenceMode = "connecting" | "github" | "local";

type EditorSection = "konten" | "sampul" | "terbit";

// The article editor is split into three sections so the writing surface and
// its publishing controls never compete for attention at once.
const sectionTabs: Array<{ value: EditorSection; label: string }> = [
  { value: "konten", label: "Konten" },
  { value: "sampul", label: "Sampul" },
  { value: "terbit", label: "Terbit" },
];

// v4: posts are keyed by storage slug (v3 stored them under fixed editor keys).
const STORAGE_KEY = "bsm-cms-prototype-v4";
const LEGACY_STORAGE_KEY = "bsm-cms-prototype-v3";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSlugLike(value: string): boolean {
  return value.length > 0 && value.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function isContentStatus(value: unknown): value is ContentStatus {
  return value === "draft" || value === "ready" || value === "published" || value === "archived";
}

// crypto.randomUUID only exists in secure contexts (https / localhost), but the
// dashboard is also reachable over plain http on a LAN — so build a v4 UUID from
// crypto.getRandomValues (available on any origin). The shape matches the id
// schema in src/content.config.ts.
function createPostId(): string {
  const bytes = new Uint8Array(16);
  try {
    crypto.getRandomValues(bytes);
  } catch {
    // No Web Crypto available: degrade to a random v4-shaped UUID.
    for (let index = 0; index < bytes.length; index += 1)
      bytes[index] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant (10xx)
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Blank post template keyed by its storage slug (matches the frontmatter contract
// in src/content.config.ts). A fresh local draft is never dirty by default.
function emptyPost(storageSlug: string): Post {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: createPostId(),
    title: "",
    kicker: "",
    excerpt: "",
    body: "",
    date: today,
    publishedAt: today,
    slug: storageSlug,
    aliases: [],
    image: "",
    imageAlt: "",
    storageSlug,
    status: "draft",
    draft: true,
    dirty: false,
  };
}

function isPostRecord(value: unknown): value is Post {
  if (!isRecord(value)) return false;
  const candidate = value as unknown as Post;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.kicker === "string" &&
    typeof candidate.excerpt === "string" &&
    typeof candidate.body === "string" &&
    typeof candidate.date === "string" &&
    typeof candidate.publishedAt === "string" &&
    typeof candidate.slug === "string" &&
    typeof candidate.image === "string" &&
    typeof candidate.imageAlt === "string" &&
    typeof candidate.storageSlug === "string" &&
    isContentStatus(candidate.status) &&
    (candidate.draft === undefined || typeof candidate.draft === "boolean") &&
    (candidate.dirty === undefined || typeof candidate.dirty === "boolean") &&
    Array.isArray(candidate.aliases) &&
    (candidate.aliases as unknown[]).every((alias) => typeof alias === "string")
  );
}

// Restores a persisted post. Persisted posts are complete Post objects keyed by
// their storage slug, so the stored value is validated directly.
function normalizeStoredPost(key: string, value: unknown): [PostKey, Post] | null {
  if (!isSlugLike(key) || !isPostRecord(value) || value.storageSlug !== key) return null;
  return [key, { ...emptyPost(key), ...value }];
}

// Where an article actually is, as distinct from what its frontmatter wishes
// for. The header badge used to fall through to `post.status`, so setting
// Status to "Terbit" and sending a revision put a green "Terbit" badge directly
// above the line "Revisi r1 menunggu persetujuan owner" — the badge and the
// sentence underneath it disagreed, and the louder one was wrong. Publication
// state is derived from the PR and deploy state only; `archived` has no UI, so
// it never reaches here.
type PublicationState = "live" | "deploying" | "awaiting" | "edited" | "not-live" | "draft";

const publicationCopy: Record<
  PublicationState,
  { label: string; detail: string; tone: "success" | "warning" | "outline" }
> = {
  live: {
    label: "Terbit",
    detail: "Revisi ter-merge · live di situs ter-deploy",
    tone: "success",
  },
  deploying: {
    label: "Sedang deploy",
    detail: "Revisi ter-merge · auto-deploy sedang berjalan",
    tone: "warning",
  },
  awaiting: {
    label: "Menunggu persetujuan",
    detail: "Revisi menunggu persetujuan owner di tab Terbit",
    tone: "warning",
  },
  edited: {
    label: "Draf",
    detail: "Ada editan lokal · belum dikirim ke GitHub",
    tone: "outline",
  },
  "not-live": {
    label: "Belum tayang",
    detail: "Sudah ada di file artikel, tapi belum terlihat di situs ter-deploy",
    tone: "outline",
  },
  draft: {
    label: "Draf",
    detail: "Draf lokal · belum di GitHub",
    tone: "outline",
  },
};

// Dot hues, kept in step with the badge. `not-live` reads as amber: the file
// says published but the site does not show it, which is a "check this" state,
// not a green one.
const publicationDot: Record<PublicationState, ContentStatus> = {
  live: "published",
  deploying: "ready",
  awaiting: "ready",
  "not-live": "ready",
  edited: "draft",
  draft: "draft",
};

function publicationStateFor(entry: Post, state: GithubState | undefined): PublicationState {
  const live = Boolean(state?.live);
  const pullRequest = state?.pullRequest ?? null;
  if (live) return "live";
  if (pullRequest?.status === "merged") return "deploying";
  if (pullRequest?.status === "open") return "awaiting";
  if (entry.dirty) return "edited";
  // In the file, not on the site. Distinct from "draft" because the fix is not
  // "write it" — it is "merge it, or take it back out of the file".
  if (entry.status === "published") return "not-live";
  return "draft";
}

/**
 * An unsupported frontmatter key, carried out of the parser so the caller can
 * name the exact line instead of describing the required fields.
 */
export class FrontmatterKeyError extends Error {
  constructor(
    readonly key: string,
    readonly line: string,
  ) {
    super(`Bidang "${key}" tidak didukung.`);
    this.name = "FrontmatterKeyError";
  }
}

function parseMarkdownDocument(source: string): Partial<Post> | null {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?\n?([\s\S]*)$/);
  if (!match) return null;

  const frontmatterLines = match[1].split("\n");
  const supportedKeys = new Set([
    "id",
    "slug",
    "title",
    "kicker",
    "excerpt",
    "publishedAt",
    "status",
    "aliases",
    "image",
    "imageAlt",
    "date",
    "draft",
  ]);
  const frontmatterEntries: Array<[string, string]> = [];

  for (const line of frontmatterLines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    const separator = trimmedLine.indexOf(":");
    if (separator < 1) return null;
    const key = trimmedLine.slice(0, separator).trim();
    if (!supportedKeys.has(key)) {
      // Name the offending key. The error used to list only the *required*
      // fields, so an unsupported key produced "pertaining blok frontmatter…
      // judul, slug, ringkasan, status, publishedAt" with no hint that the real
      // problem was some other line entirely.
      throw new FrontmatterKeyError(key, trimmedLine);
    }
    const rawValue = trimmedLine.slice(separator + 1).trim();
    let value = rawValue;
    if (rawValue.startsWith('"')) {
      try {
        const decoded = JSON.parse(rawValue);
        if (typeof decoded !== "string") return null;
        value = decoded;
      } catch {
        return null;
      }
    } else if (rawValue.startsWith("'")) {
      if (!rawValue.endsWith("'")) return null;
      value = rawValue.slice(1, -1).replace(/''/g, "'");
    } else if (key === "aliases") {
      try {
        const decoded = JSON.parse(rawValue);
        if (!Array.isArray(decoded) || decoded.some((alias) => typeof alias !== "string"))
          return null;
        value = JSON.stringify(decoded);
      } catch {
        return null;
      }
    } else if (key === "draft" && rawValue !== "true" && rawValue !== "false") {
      return null;
    }
    frontmatterEntries.push([key, value]);
  }

  const frontmatter = Object.fromEntries(frontmatterEntries);
  if (!frontmatter.id || !frontmatter.title || !frontmatter.slug) return null;
  const body = match[2].trim();
  const status = frontmatter.status || (frontmatter.draft === "true" ? "draft" : "draft");
  if (status !== "draft" && status !== "published" && status !== "archived") return null;

  return {
    id: frontmatter.id ?? "",
    title: frontmatter.title ?? "",
    kicker: frontmatter.kicker ?? "",
    slug: frontmatter.slug ?? "",
    date: frontmatter.date ?? "",
    publishedAt: frontmatter.publishedAt ?? frontmatter.date ?? "",
    status: status === "draft" && frontmatter.draft === "true" ? "draft" : status,
    draft: frontmatter.draft === "true",
    excerpt: frontmatter.excerpt ?? "",
    aliases: JSON.parse(frontmatter.aliases ?? "[]") as string[],
    image: frontmatter.image ?? "",
    imageAlt: frontmatter.imageAlt ?? "",
    body,
  };
}

/**
 * Shared dialog behaviour: move focus into the dialog on open, keep Tab inside
 * it, close on Escape, lock background scroll, and restore focus to whatever
 * opened it.
 *
 * Every modal in the dashboard goes through this. It used to exist only for the
 * media picker, which left the irreversible merge confirmation with no focus
 * entry, no trap, no Escape, and no announcement — a keyboard user had to Tab
 * through the whole form (including the editor's contenteditable) to reach it,
 * and could not get out. WCAG 2.1.2 No Keyboard Trap, 2.4.3 Focus Order.
 *
 * `onClose` is held in a ref so an inline arrow cannot re-run the effect on
 * every render, which would yank focus back to the top of the dialog mid-edit.
 */
function useDialogFocus(
  open: boolean,
  dialogRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  initialFocusRef?: React.RefObject<HTMLElement | null>,
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Prefer an explicit first stop (the safe choice in a destructive confirm,
    // the text field in a rename); otherwise focus the dialog itself so its
    // `aria-labelledby` title is announced.
    const frame = window.requestAnimationFrame(() => {
      (initialFocusRef?.current ?? dialogRef.current)?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      // `[disabled]` elements and the visually-hidden file input are excluded:
      // parking focus on something with no pixels is the invisible-focus-stop
      // failure the media picker had.
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button:not([disabled]), a[href], input:not([disabled]):not([tabindex='-1']), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      // Only pull focus back if it is still inside the dialog: a merge that
      // closed on click has already moved focus on, and stealing it back would
      // fight the success path.
      if (dialogRef.current?.contains(document.activeElement)) trigger?.focus();
    };
  }, [open, dialogRef, initialFocusRef]);
}

export default function CmsDashboard({
  mediaAssets,
  isAuthenticated,
}: {
  mediaAssets: MediaAsset[];
  isAuthenticated: boolean;
}) {
  // No seed set (#43): the workspace boots empty and fills from browser-local
  // drafts plus the repository listing (ADR 0013).
  const [posts, setPosts] = useState<Record<PostKey, Post>>({});
  const [selectedPost, setSelectedPost] = useState<PostKey>("");
  const [isMarkdown, setIsMarkdown] = useState(false);
  const [markdownDraft, setMarkdownDraft] = useState("");
  const [markdownBaseline, setMarkdownBaseline] = useState("");
  const [isMediaOpen, setMediaOpen] = useState(false);
  const [githubStates, setGithubStates] = useState<Record<string, GithubState>>({});
  const [deployed, setDeployed] = useState<DeployInfo | null>(null);
  const [saveLabel, setSaveLabel] = useState("Menghubungkan ke GitHub…");
  const [persistenceMode, setPersistenceMode] = useState<PersistenceMode>("connecting");
  // Technical detail for the persistent local-fallback banner (secondary line).
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isBusy, setBusy] = useState(false);
  // Truth from the repository listing (ADR 0013): which slugs exist as repo
  // posts, and which legacy files are flagged needsRename (read-only until
  // renamed).
  const [repoSlugs, setRepoSlugs] = useState<string[]>([]);
  const [needsRenameSlugs, setNeedsRenameSlugs] = useState<string[]>([]);
  const [isHydrated, setHydrated] = useState(false);
  const [uploadedAssets, setUploadedAssets] = useState<UploadedMediaEntry[]>([]);
  const [mainAssets, setMainAssets] = useState<UploadedMediaEntry[]>([]);
  const [pendingRevision, setPendingRevision] = useState<number | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setDragOver] = useState(false);
  // In-dashboard merge confirmation (replaces window.confirm): a themed card
  // that states the consequence (auto-deploy to the live site) before the
  // irreversible action, dismissible without page-level blocking.
  const [isMergeConfirmOpen, setMergeConfirmOpen] = useState(false);
  // Locked-post rename (legacy filename → valid slug): the dialog targets one
  // locked post at a time; "renaming" marks the POST in flight.
  const [renameTarget, setRenameTarget] = useState<PostKey>("");
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isRenaming, setRenaming] = useState(false);
  // Media entries whose thumbnail failed to load (404 or corrupt): flagged so
  // the grid can disable their actions instead of letting the editor select a
  // cover that will be broken on the live site too.
  const [brokenMediaPaths, setBrokenMediaPaths] = useState<Set<string>>(new Set());
  const [showNewPostForm, setShowNewPostForm] = useState(false);
  const [newPostSlug, setNewPostSlug] = useState("");
  const [activeTab, setActiveTab] = useState<EditorSection>("konten");
  const [sectionIndicator, setSectionIndicator] = useState({ left: 0, width: 0 });
  const [modeIndicator, setModeIndicator] = useState({ left: 0, width: 0 });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaDialogRef = useRef<HTMLElement | null>(null);
  const mergeDialogRef = useRef<HTMLElement | null>(null);
  const renameDialogRef = useRef<HTMLElement | null>(null);
  // First focus stop per dialog. The merge confirm opens on "Batal", not on the
  // destructive choice: a reflexive Enter must never publish to production.
  const mergeCancelRef = useRef<HTMLButtonElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const sectionTabsRef = useRef<HTMLDivElement | null>(null);
  const selectedStorageSlugRef = useRef<PostKey>("");
  // The storage slug whose asset list has actually landed. Stays "" until then,
  // so a cover is never reported missing against an empty list.
  const [mediaLoadedFor, setMediaLoadedFor] = useState<PostKey>("");

  useEffect(() => {
    const root = document.documentElement;
    const button = document.querySelector<HTMLButtonElement>("[data-cms-theme-toggle]");
    const label = button?.querySelector<HTMLElement>("[data-cms-theme-label]");
    const applyTheme = (theme: "light" | "dark") => {
      const light = theme === "light";
      root.dataset.theme = theme;
      button?.setAttribute("aria-pressed", String(light));
      button?.setAttribute("aria-label", light ? "Aktifkan mode gelap" : "Aktifkan mode terang");
      button?.setAttribute("title", light ? "Aktifkan mode gelap" : "Aktifkan mode terang");
      if (label) label.textContent = light ? "Gelap" : "Terang";
    };
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem("bsm-theme");
    } catch {
      // Restricted storage should not prevent the dashboard from rendering.
    }
    applyTheme(stored === "light" || stored === "dark" ? stored : "light");
    const onClick = () => {
      const next = root.dataset.theme === "light" ? "dark" : "light";
      applyTheme(next);
      try {
        window.localStorage.setItem("bsm-theme", next);
      } catch {
        // Restricted storage should not prevent switching.
      }
    };
    button?.addEventListener("click", onClick);
    return () => {
      button?.removeEventListener("click", onClick);
    };
  }, []);

  // All three dialogs share one focus contract. The merge confirmation and the
  // rename prompt previously had none of it.
  useDialogFocus(isMediaOpen, mediaDialogRef, () => setMediaOpen(false));
  useDialogFocus(
    isMergeConfirmOpen,
    mergeDialogRef,
    () => setMergeConfirmOpen(false),
    mergeCancelRef,
  );
  useDialogFocus(Boolean(renameTarget), renameDialogRef, () => setRenameTarget(""), renameInputRef);

  // While no post is selected yet (boot, before drafts/repo listing land) the
  // editor renders a stable blank template instead of crashing on undefined.
  const fallbackPost = useMemo(() => emptyPost(selectedPost), [selectedPost]);
  const post = posts[selectedPost] ?? fallbackPost;
  // "Untouched" re-anchored (#45): a per-post dirty flag persisted alongside the
  // post, set on first edit and cleared on revision-PR creation / repo reload.
  const hasLocalEdits = Boolean(post.dirty);
  // State-model gates (#46): the main pane swaps between editor, connecting
  // hint, and empty panel; the topbar + sidebar chrome survive every state.
  const zeroPosts = Object.keys(posts).length === 0;
  const showEmptyPanel = zeroPosts && persistenceMode !== "connecting";
  const showLocalBanner = persistenceMode === "local" && isAuthenticated;
  const isLocked = needsRenameSlugs.includes(post.storageSlug);
  const currentMarkdown = useMemo(() => serializeDraftMarkdown(post), [post]);
  const hasUncommittedMarkdown = isMarkdown && markdownDraft !== markdownBaseline;
  const githubState = githubStates[post.storageSlug];
  const draftPullRequest = githubState?.pullRequest ?? null;

  // Keep the poller's slug ref in step with the selected post, whichever path
  // set the selection (boot restore, repo-listing fallback, explicit pick).
  // Manual setters remain authoritative within their tick; this only repairs
  // paths that call setSelectedPost directly.
  useEffect(() => {
    selectedStorageSlugRef.current = posts[selectedPost]?.storageSlug ?? selectedPost;
  }, [selectedPost, posts]);
  const isMerged = draftPullRequest?.status === "merged";
  const isAwaitingApproval = draftPullRequest?.status === "open";
  // No PR/live record for this article at all (a local browser draft, or a repo
  // post whose state has not been fetched yet). Reporting a publication state
  // from nothing is how the sidebar ended up claiming "Menunggu persetujuan"
  // and "Sedang deploy" for articles that had never been sent anywhere.
  const hasRepoRecord = Boolean(githubState);
  const publicationState = hasRepoRecord ? publicationStateFor(post, githubState) : "draft";
  const publication = publicationCopy[publicationState];
  // The PR number belongs in the sentence, not the badge, so it stays out of the
  // label the badge has to fit on one line.
  const contentDetail = isAwaitingApproval
    ? `${publication.detail} · PR #${draftPullRequest!.prNumber}`
    : !hasRepoRecord && post.status === "published"
      ? // The one case where the file's word is the only evidence there is.
        "Status Terbit di file · belum ada catatan deploy untuk artikel ini"
      : publication.detail;

  const updatePost = (patch: Partial<Post>, markDirty = true) => {
    if (isLocked) return; // legacy file pending rename: read-only
    setPosts((current) => ({
      ...current,
      [selectedPost]: {
        ...current[selectedPost],
        ...patch,
        ...(markDirty ? { dirty: true } : {}),
      },
    }));
    if (markDirty) {
      setSaveLabel(
        persistenceMode === "github" ? "Perubahan lokal · belum di GitHub" : "Tersimpan lokal",
      );
    }
  };

  const request = useCallback(
    async (path: string, method: "GET" | "POST" | "PUT", body?: unknown) => {
      const response = await fetch(path, {
        method,
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          ...(method === "POST" || method === "PUT" ? { "Content-Type": "application/json" } : {}),
        },
        body: method === "POST" || method === "PUT" ? JSON.stringify(body ?? {}) : undefined,
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        // A 401 from any CMS API means the admin session lapsed (cookie
        // expired server-side or revoked). Send the owner back to login;
        // every other failure keeps the existing local-fallback behavior.
        window.location.assign("/admin/login");
        throw new Error("Sesi kedaluwarsa. Masuk kembali untuk melanjutkan.");
      }
      if (!response.ok)
        throw new Error(payload.error ?? `Permintaan gagal (HTTP ${response.status}).`);
      return payload as {
        pullRequest?: DraftPullRequest | null;
        sourceMarkdown?: string | null;
        live?: boolean;
        deployed?: DeployInfo | null;
        posts?: Array<{ storageSlug: string; needsRename?: boolean }>;
        error?: string;
      };
    },
    [],
  );

  const fetchDeployStatus = async () => {
    if (!isAuthenticated) return;
    try {
      const result = await request("/api/cms/deploy/status", "GET");
      setDeployed(result.deployed ?? null);
    } catch (error) {
      setSaveLabel(error instanceof Error ? error.message : "Tidak dapat membaca status deploy.");
    }
  };

  // Single fetch-and-record for a post's PR state; shared by the boot loop and
  // the 30s poller. Errors propagate — callers decide how to handle them.
  const fetchPostState = async (storageSlug: string) => {
    const result = await request(
      `/api/cms/drafts/pr?storageSlug=${encodeURIComponent(storageSlug)}`,
      "GET",
    );
    setGithubStates((current) => ({
      ...current,
      [storageSlug]: {
        pullRequest: result.pullRequest ?? null,
        live: Boolean(result.live),
      },
    }));
    return result;
  };

  const refreshPostState = async (storageSlug: string) => {
    // The 30s poller runs against selectedStorageSlugRef, which stays "" until
    // the user picks a post — an empty slug only earns the endpoint's 400.
    if (!isAuthenticated || !storageSlug) return;
    try {
      await fetchPostState(storageSlug);
    } catch {
      // Transient polling failures must not disturb the editing surface.
    }
  };

  useEffect(() => {
    let stored: PostKey[] = [];
    try {
      const storedPostKeys = window.localStorage.getItem(STORAGE_KEY);
      const legacyStored = storedPostKeys ? null : window.localStorage.getItem(LEGACY_STORAGE_KEY);
      const storedValue = storedPostKeys ?? legacyStored;
      if (storedValue) {
        try {
          const saved: unknown = JSON.parse(storedValue);
          if (!isRecord(saved)) throw new Error("Stored CMS state is not an object.");
          const normalizedEntries = Object.entries(saved)
            .map(([key, value]) => normalizeStoredPost(key, value))
            .filter((entry): entry is [PostKey, Post] => entry !== null);
          stored = normalizedEntries.map(([key]) => key);
          const safeSaved: Record<string, Post> = Object.fromEntries(normalizedEntries);
          // Browser drafts restore as-is; their per-post dirty flags ride along,
          // so in-progress work survives the reload.
          setPosts(safeSaved);
          setSelectedPost((current) => (safeSaved[current] ? current : (stored[0] ?? "")));
        } catch {
          try {
            window.localStorage.removeItem(STORAGE_KEY);
          } catch {
            /* restricted storage */
          }
        }
      }
    } catch {
      // Private browsing or a restrictive storage policy should not block editing.
    }
    const loadGitHubState = async () => {
      if (!isAuthenticated) {
        setPersistenceMode("local");
        setPersistenceError(null);
        setSaveLabel("Draf tersimpan di browser ini");
        return;
      }
      setPersistenceMode("connecting");
      try {
        // ADR 0013: the repository listing is truth. Every slug it returns is a
        // repo post; browser drafts for those slugs merge on top unless dirty.
        const listed = await request("/api/cms/posts", "GET");
        const listedPosts = listed?.posts ?? [];
        setRepoSlugs(listedPosts.map((entry) => entry.storageSlug));
        setNeedsRenameSlugs(
          listedPosts.filter((entry) => entry.needsRename).map((entry) => entry.storageSlug),
        );
        const repoSlugs = listedPosts.map((entry) => entry.storageSlug);
        const knownKeys = Array.from(
          new Set<string>([...(Object.keys(posts) as PostKey[]), ...repoSlugs]),
        );
        // Fetch all post states in parallel: each fetchPostState records its
        // result via keyed functional updaters, so completion order is
        // irrelevant. Any rejection bubbles to the outer catch: a dead GitHub
        // connection must flip the dashboard to local-only mode, not fail
        // silently.
        await Promise.all(
          knownKeys.map(async (key) => {
            const result = await fetchPostState(key);
            const source = result.sourceMarkdown;
            if (!source) return;
            let parsed: Partial<Post> | null;
            try {
              parsed = parseMarkdownDocument(source);
            } catch {
              // A repo file with a key this dashboard does not model: leave the
              // local copy alone rather than clobbering it with a null parse.
              return;
            }
            if (!parsed) return;
            setPosts((current) => {
              const existing = current[key];
              // Repo source overlays only when the local copy is clean: not
              // dirty, or a fresh empty draft that has never been edited.
              const isClean =
                !existing || (!existing.dirty && existing.title === "" && existing.body === "");
              if (!isClean) return current;
              return {
                ...current,
                [key]: {
                  ...(existing ?? emptyPost(key)),
                  ...parsed,
                  storageSlug: key,
                  dirty: false,
                },
              };
            });
          }),
        );
        setPersistenceMode("github");
        setSaveLabel("Draf tersimpan · kirim revisi untuk terbit");
        // First paint of the editor once the listing has had its say.
        setSelectedPost((current) => {
          if (current && current !== "") return current;
          return stored[0] ?? repoSlugs[0] ?? "";
        });
      } catch (error) {
        setPersistenceMode("local");
        setPersistenceError(error instanceof Error ? error.message : null);
        setSaveLabel(
          error instanceof Error
            ? `${error.message} · mode lokal`
            : "GitHub tidak tersedia · mode lokal",
        );
      }
    };
    void loadGitHubState();
    setHydrated(true);
    void fetchDeployStatus();
    const interval = window.setInterval(() => {
      void fetchDeployStatus();
      void refreshPostState(selectedStorageSlugRef.current);
    }, 30000);
    return () => window.clearInterval(interval);
    // `posts` is intentionally read once at boot: the merge runs against the
    // just-restored browser drafts, not against live edit state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, request]);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      if (!isAuthenticated)
        setSaveLabel("Penyimpanan browser tidak tersedia · perubahan bersifat sementara");
    }
  }, [isAuthenticated, isHydrated, posts]);

  const createPullRequest = async () => {
    // ADR 0011: alt text is required whenever a featured image is set — checked
    // locally for instant feedback; the server gate enforces it again.
    if (post.image && !post.imageAlt.trim()) {
      setActionError("Teks alt wajib untuk gambar sampul sebelum menyimpan revisi.");
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const result = await request("/api/cms/drafts/pr", "POST", {
        storageSlug: post.storageSlug,
        post,
      });
      if (!result.pullRequest)
        throw new Error("GitHub tidak mengembalikan data revisi. Coba lagi.");
      setGithubStates((current) => ({
        ...current,
        [post.storageSlug]: { pullRequest: result.pullRequest!, live: false },
      }));
      // The revision PR now carries the work: clear the dirty flag so the repo
      // source can overlay this post again until the next local edit (#45).
      setPosts((current) => ({
        ...current,
        [selectedPost]: { ...current[selectedPost], dirty: false },
      }));
      setSaveLabel("Revisi terkirim · PR dibuka");
      setNotice(
        `Revisi r${result.pullRequest.revision} dikirim (PR #${result.pullRequest.prNumber}). Setujui di tab Terbit untuk menerbitkan.`,
      );
      // Close the loop on the workflow: the approval control lives in the
      // Terbit tab, so take the editor there instead of asking them to find it.
      setActiveTab("terbit");
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Tidak dapat mengirim revisi ke GitHub. Coba lagi.",
      );
    } finally {
      setBusy(false);
    }
  };

  // ADR 0009/0012 owner merge: approving a revision merges its open PR to `main`
  // straight from the dashboard (GitHub stays optional). Auto-deploy then flips
  // the revision to Terbit via the deploy-confirmation poll — no GitHub visit.
  const mergeRevision = async () => {
    if (!draftPullRequest) return;
    setBusy(true);
    setActionError(null);
    try {
      const result = await request("/api/cms/drafts/pr/merge", "POST", {
        storageSlug: post.storageSlug,
      });
      if (!result.pullRequest)
        throw new Error("GitHub tidak mengembalikan data revisi. Coba lagi.");
      setGithubStates((current) => ({
        ...current,
        [post.storageSlug]: { pullRequest: result.pullRequest!, live: false },
      }));
      setPosts((current) => ({
        ...current,
        [selectedPost]: { ...current[selectedPost], dirty: false },
      }));
      setSaveLabel("Revisi digabungkan");
      setNotice(
        `Revisi r${result.pullRequest.revision} digabungkan (PR #${result.pullRequest.prNumber}). Auto-deploy berjalan — jadi Terbit saat situs live.`,
      );
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Tidak dapat menggabungkan revisi. Coba lagi sebentar.",
      );
    } finally {
      setBusy(false);
    }
  };

  const selectPost = (key: PostKey) => {
    if (selectedPost === key) return;
    const target = posts[key];
    // Legacy flagged files are read-only until renamed; they can still be
    // selected and read.
    if (target && needsRenameSlugs.includes(target.storageSlug)) {
      setSelectedPost(key);
      selectedStorageSlugRef.current = target.storageSlug;
      setActiveTab("konten");
      setIsMarkdown(false);
      setActionError(null);
      setNotice(null);
      return;
    }
    if (post.dirty || hasUncommittedMarkdown) {
      setActionError("Kirim revisi artikel ini dulu sebelum berpindah ke artikel lain.");
      return;
    }
    setSelectedPost(key);
    selectedStorageSlugRef.current = target?.storageSlug ?? key;
    setActiveTab("konten");
    setIsMarkdown(false);
    setMarkdownDraft("");
    setMarkdownBaseline("");
    setActionError(null);
    setNotice(null);
  };

  // Navigation guard: warn before an unload (reload, close, external link)
  // that would lose un-persisted work. Mirrors the in-app selectPost guard so
  // every exit path gets the same protection. localStorage survives reloads,
  // but markdown-mode drafts are component state and do not.
  const hasUnsavedWork = hasLocalEdits || hasUncommittedMarkdown;
  useEffect(() => {
    if (!hasUnsavedWork) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Chrome requires returnValue to be set; legacy browsers read it.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedWork]);

  const createNewPost = () => {
    const slug = newPostSlug.trim().toLowerCase();
    if (!isSlugLike(slug)) {
      setActionError(
        "Slug harus pakai huruf kecil, angka, dan tanda hubung tunggal (contoh: panduan-atap-upvc).",
      );
      return;
    }
    // Guard against both visible posts and the full repo listing (#45): a slug
    // that exists on GitHub but whose source has not loaded yet must not be
    // shadowed by a local draft created in the async-fetch window.
    if (posts[slug] || repoSlugs.includes(slug)) {
      setActionError(`Artikel dengan slug "${slug}" sudah ada.`);
      return;
    }
    const post = emptyPost(slug);
    setPosts((current) => ({ ...current, [slug]: post }));
    setSelectedPost(slug);
    selectedStorageSlugRef.current = slug;
    setShowNewPostForm(false);
    setNewPostSlug("");
    setActionError(null);
    setNotice(`Draf "${slug}" dibuat. Isi kontennya, lalu kirim revisi untuk membuka PR GitHub.`);
  };

  // Locked-post rename: suggest a normalized slug from the legacy filename,
  // commit the rename on GitHub, then refresh the listing so the post unlocks.
  const openRename = (key: PostKey) => {
    const suggested = key
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    setRenameTarget(key);
    setRenameValue(suggested);
    setRenameError(null);
  };

  const submitRename = async () => {
    if (!renameTarget) return;
    const nextName = renameValue.trim().toLowerCase();
    if (!isSlugLike(nextName)) {
      setRenameError(
        "Nama baru harus huruf kecil, angka, dan tanda hubung tunggal (contoh: panduan-atap-upvc).",
      );
      return;
    }
    if (posts[nextName] || repoSlugs.includes(nextName)) {
      setRenameError(`Artikel dengan slug "${nextName}" sudah ada.`);
      return;
    }
    setRenaming(true);
    setRenameError(null);
    try {
      await request("/api/cms/posts/rename", "POST", {
        currentName: renameTarget,
        nextName,
      });
      // The rename commits to main: refresh the listing and this post's state
      // under its new identity. Local storage drops the stale locked key.
      setPosts((current) => {
        const renamed = current[renameTarget];
        if (!renamed) return current;
        const { [renameTarget]: _dropped, ...rest } = current;
        return { ...rest, [nextName]: { ...renamed, storageSlug: nextName, dirty: false } };
      });
      setRepoSlugs((current) => current.map((slug) => (slug === renameTarget ? nextName : slug)));
      setNeedsRenameSlugs((current) => current.filter((slug) => slug !== renameTarget));
      setGithubStates((current) => {
        const { [renameTarget]: _stale, ...rest } = current;
        return rest;
      });
      setSelectedPost((current) => (current === renameTarget ? nextName : current));
      selectedStorageSlugRef.current = nextName;
      setRenameTarget("");
      setRenameValue("");
      setNotice(
        `Artikel diganti nama menjadi "${nextName}". Sekarang bisa diedit dan dikirim seperti biasa.`,
      );
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : "Tidak dapat mengganti nama file.");
    } finally {
      setRenaming(false);
    }
  };

  const currentMedia = useMemo(() => {
    const fromCurated = mediaAssets.find(
      (asset) => asset.filename === post.image || asset.filename === post.image.split("/").pop(),
    );
    if (fromCurated) {
      return {
        filename: fromCurated.filename,
        src: fromCurated.src,
        label: fromCurated.label,
        alt: fromCurated.alt,
      };
    }
    const fromUploaded = [...uploadedAssets, ...mainAssets].find(
      (asset) => asset.path === post.image || asset.filename === post.image,
    );
    return fromUploaded
      ? {
          filename: fromUploaded.filename,
          src: fromUploaded.url,
          label: fromUploaded.filename,
          alt: post.imageAlt,
        }
      : null;
  }, [mediaAssets, uploadedAssets, mainAssets, post.image, post.imageAlt]);

  // Uploaded assets (pending revision + main), deduplicated by repo path.
  const postMedia = useMemo(
    () => [
      ...uploadedAssets,
      ...mainAssets.filter(
        (entry) => !uploadedAssets.some((uploaded) => uploaded.path === entry.path),
      ),
    ],
    [uploadedAssets, mainAssets],
  );

  // Cover resolution is a report, never an edit. This used to be an effect that
  // rewrote `post.image` to the first curated image and set `dirty: true` when
  // the cover could not be found — while the article's own asset list had not
  // even been fetched yet, so every CMS-uploaded cover (stored as
  // `blog/<slug>/cover.jpg`) looked missing. The owner was left with a replaced
  // cover, a dirty post that `selectPost` refused to let them leave, no discard
  // control, and "Kirim revisi" as the only way out: one click from publishing
  // the wrong image to production. The decision now lives in
  // `utils/cms-media.ts` and is covered by tests.
  const coverResolution = useMemo(
    () =>
      resolveCover(
        post.image,
        [
          ...mediaAssets.map((asset) => ({ filename: asset.filename })),
          ...[...uploadedAssets, ...mainAssets].map((asset) => ({
            path: asset.path,
            filename: asset.filename,
          })),
        ],
        mediaLoadedFor === post.storageSlug,
      ),
    [mediaAssets, uploadedAssets, mainAssets, mediaLoadedFor, post.image, post.storageSlug],
  );
  const coverMissing = isCoverMissing(coverResolution);

  const selectMedia = (asset: MediaAsset) => {
    updatePost({ image: asset.filename });
    setMediaOpen(false);
    setNotice(`Sampul diganti ke ${asset.label}. Terkomit saat revisi dikirim.`);
  };

  const loadMedia = async (storageSlug: string) => {
    if (!isAuthenticated) return;
    setUploadError(null);
    try {
      const response = await fetch(
        `/api/cms/media?storageSlug=${encodeURIComponent(storageSlug)}`,
        {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Tidak dapat memuat media.");
      setUploadedAssets(payload.assets ?? []);
      setMainAssets(payload.mainAssets ?? []);
      setPendingRevision(payload.revision ?? null);
      setMediaLoadedFor(storageSlug);
    } catch {
      setUploadError("Tidak dapat memuat media untuk artikel ini.");
    }
  };

  // The article's asset list loads on selection, not only when the media dialog
  // opens. Deferring it to the dialog is exactly what let the cover check run
  // against an empty list and declare a valid CMS-uploaded cover missing.
  // Switching articles clears the previous list first, so a path belonging to
  // another article can never be resolved — or reported missing — here.
  useEffect(() => {
    if (!isAuthenticated || !post.storageSlug) return;
    setUploadedAssets([]);
    setMainAssets([]);
    setMediaLoadedFor("");
    void loadMedia(post.storageSlug);
    // `loadMedia` is recreated each render; the slug is the only real trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, post.storageSlug]);

  // Re-read on open so a just-uploaded asset is present without a page reload.
  useEffect(() => {
    if (isMediaOpen && isAuthenticated) void loadMedia(post.storageSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMediaOpen, isAuthenticated, post.storageSlug]);

  // One upload path: the new asset lands in the article's media grid and
  // becomes the cover by default; per-asset actions handle the rest.
  const uploadImage = async (file: File) => {
    if (!isAuthenticated) return;
    setUploadBusy(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("storageSlug", post.storageSlug);
      form.append("kind", "cover");
      form.append("name", file.name);
      form.append("file", file);
      const response = await fetch("/api/cms/media", {
        method: "POST",
        credentials: "same-origin",
        body: form,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Gagal mengunggah gambar.");
      const asset = payload.asset;
      if (asset) {
        setUploadedAssets((current) =>
          current.some((entry) => entry.path === asset.path) ? current : [...current, asset],
        );
        updatePost({ image: asset.path });
        setNotice(`Sampul terunggah (${asset.path}). Tambahkan teks alt, lalu kirim revisi.`);
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Gagal mengunggah gambar.");
    } finally {
      setUploadBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const selectUploaded = (asset: UploadedMediaEntry) => {
    updatePost({ image: asset.path });
    setNotice(`Sampul diganti ke ${asset.path}. Terkomit saat revisi dikirim.`);
  };

  // Appends `![alt](path)` to the article body. `path` is repo-relative to
  // src/images (ADR 0011); the stored Markdown uses the `../../images/…` form
  // (relative to src/content/blog/<slug>.md) so Astro 7 resolves and optimizes
  // it natively. Editors can move or re-alt the image in Markdown source.
  const appendBodyImage = (path: string, label: string) => {
    const alt = (label || path.split("/").pop() || "image")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[-_]+/g, " ");
    const snippet = `![${alt}](../../images/${path})`;
    const body = post.body.trim();
    updatePost({ body: body ? `${body}\n\n${snippet}` : snippet });
    setNotice(
      `Gambar disisipkan di akhir artikel. Pindahkan atau edit alt-nya di sumber Markdown.`,
    );
  };

  const openMarkdown = () => {
    if (isMarkdown) return;
    const source = currentMarkdown;
    setMarkdownDraft(source);
    setMarkdownBaseline(source);
    setIsMarkdown(true);
    setActionError(null);
  };

  const closeMarkdown = () => {
    if (!isMarkdown) return;
    let parsed: Partial<Post> | null;
    try {
      parsed = parseMarkdownDocument(markdownDraft);
    } catch (error) {
      setActionError(
        error instanceof FrontmatterKeyError
          ? `Baris "${error.line}" memakai bidang "${error.key}" yang tidak didukung CMS. Hapus baris itu atau ganti nama field-nya.`
          : "Markdown tidak bisa dibaca. Periksa blok frontmatter.",
      );
      return;
    }
    if (!parsed) {
      setActionError(
        "Markdown harus mempertahankan blok frontmatter --- beserta bidang judul (title), slug, ringkasan (excerpt), status, dan tanggal terbit (publishedAt).",
      );
      return;
    }
    // `date` is the legacy twin of `publishedAt`; the site sorts by
    // `publishedAt` (utils/blog.ts: blogPublishedAt), so a hand-edited source
    // that moved only one of them would change the date shown without changing
    // the blog's order. Move them together.
    const normalized =
      parsed.date !== undefined && parsed.publishedAt !== undefined
        ? { ...parsed, date: parsed.publishedAt }
        : parsed;
    const contentChanged =
      normalized.id !== post.id ||
      normalized.title !== post.title ||
      normalized.kicker !== post.kicker ||
      normalized.excerpt !== post.excerpt ||
      normalized.body !== post.body ||
      normalized.slug !== post.slug ||
      normalized.date !== post.date ||
      normalized.publishedAt !== post.publishedAt ||
      normalized.status !== post.status ||
      normalized.image !== post.image ||
      normalized.imageAlt !== post.imageAlt ||
      JSON.stringify(normalized.aliases) !== JSON.stringify(post.aliases);
    if (contentChanged) updatePost(normalized);
    setMarkdownBaseline("");
    setIsMarkdown(false);
    setActionError(null);
  };

  const updateMarkdown = (source: string) => {
    setMarkdownDraft(source);
    try {
      if (parseMarkdownDocument(source)) setActionError(null);
    } catch {
      // Keep the previous error visible while the owner is still typing; the
      // exact offending line is named when they try to apply the source.
    }
  };

  const moveTab = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    ref: React.RefObject<HTMLDivElement | null>,
    onActivate: (index: number) => void,
  ) => {
    if (!ref.current || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = Array.from(ref.current.querySelectorAll<HTMLButtonElement>("[role=tab]"));
    const index = tabs.indexOf(event.currentTarget);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    tabs[nextIndex]?.focus();
    onActivate(nextIndex);
  };

  const nextAction: {
    label: string;
    variant: "default";
    disabled?: boolean;
    onClick: () => void;
  } | null = isMarkdown
    ? null
    : draftPullRequest?.status === "open"
      ? {
          label: "Setujui & gabungkan",
          variant: "default",
          disabled: isBusy || hasUncommittedMarkdown,
          // The approval opens a themed confirmation card, not the merge
          // itself: the consequence (auto-deploy to the live site) deserves a
          // deliberate, designed step.
          onClick: () => setMergeConfirmOpen(true),
        }
      : isMerged
        ? null
        : isAuthenticated && persistenceMode === "github"
          ? {
              label: "Kirim revisi & buka PR",
              variant: "default",
              disabled: isBusy || hasUncommittedMarkdown,
              onClick: () => void createPullRequest(),
            }
          : null;

  const deployedShort = deployed?.commitSha ? deployed.commitSha.slice(0, 7) : null;
  const deployedDate = deployed?.deployedAt ? new Date(deployed.deployedAt).toLocaleString() : null;

  // The status dot is live state, not decoration: it pulses while work is
  // uncommitted (or an action/upload is in flight) and rests green when the
  // local copy matches its last saved GitHub state.
  const isSaveActive = hasLocalEdits || hasUncommittedMarkdown || uploadBusy || isBusy;

  // The tab indicators slide from the active button, so they always sit under
  // exactly the tab they belong to — no fixed thirds that drift with length.
  useEffect(() => {
    const measure = () => {
      const sectionButton =
        sectionTabsRef.current?.querySelector<HTMLButtonElement>("button.is-active");
      if (sectionButton)
        setSectionIndicator({ left: sectionButton.offsetLeft, width: sectionButton.offsetWidth });
      const modeButton = tabsRef.current?.querySelector<HTMLButtonElement>("button.is-active");
      if (modeButton)
        setModeIndicator({ left: modeButton.offsetLeft, width: modeButton.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeTab, isMarkdown, posts, selectedPost]);

  return (
    <div className="cms-dashboard" data-cms-dashboard>
      <header className="cms-topbar">
        <a className="cms-brand" href="/" aria-label="Kembali ke situs BSM">
          <span className="cms-brand__mark">BSM</span>
          <span>
            <strong>Kontrol Editorial</strong>
            <small>Editorial CMS · BSM</small>
          </span>
        </a>
        <div className="cms-save-status" aria-live="polite">
          <span className={isSaveActive ? "is-saving" : ""} />
          {saveLabel}
        </div>
        <div className="cms-topbar__actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // POST /api/auth/logout invalidates the KV session and clears
              // the cookie, then 303s to /admin/login — land there explicitly
              // so the navigation happens even if the request fails.
              void fetch("/api/auth/logout", {
                method: "POST",
                credentials: "same-origin",
              }).finally(() => {
                window.location.assign("/admin/login");
              });
            }}
          >
            <LogOut data-icon="inline-start" />
            Keluar
          </Button>
          <button
            type="button"
            className="cms-theme-toggle"
            data-cms-theme-toggle
            aria-pressed="false"
            aria-label="Aktifkan mode gelap"
            title="Aktifkan mode gelap"
          >
            <Sun aria-hidden="true" className="cms-theme-toggle__light" />
            <Moon aria-hidden="true" className="cms-theme-toggle__dark" />
            <span data-cms-theme-label>Gelap</span>
          </button>
        </div>
      </header>

      <aside className="cms-sidebar" aria-label="Navigasi editorial">
        <div className="cms-sidebar__eyebrow">Artikel</div>
        {persistenceMode === "connecting" && (
          <div className="cms-connecting-hint" role="status">
            <LoaderCircle className="cms-spin" aria-hidden="true" />
            <span>Menghubungkan ke GitHub…</span>
          </div>
        )}
        <div className="cms-post-list">
          {/* Dirty-first, then newest-first: the work in progress and the most
              recent articles surface at the top of the navigation map. */}
          {(Object.keys(posts) as PostKey[])
            .sort((a, b) => {
              const entryA = posts[a];
              const entryB = posts[b];
              if (Boolean(entryA?.dirty) !== Boolean(entryB?.dirty)) return entryA?.dirty ? -1 : 1;
              return (entryB?.date ?? "").localeCompare(entryA?.date ?? "");
            })
            .map((key) => {
              const entry = posts[key];
              const locked = needsRenameSlugs.includes(entry.storageSlug);
              const isSelected = selectedPost === key;
              // The list reports the same publication state as the header, from
              // the same PR/deploy data — a sidebar dot is not a second opinion.
              // With no record for the article, it reports plain "Draf" and the
              // date rather than inventing a workflow state.
              const state = githubStates[key]
                ? publicationStateFor(entry, githubStates[key])
                : "draft";
              const showDate = state === "draft" || state === "live";
              return (
                <button
                  key={key}
                  className={isSelected ? "is-selected" : ""}
                  // Selection semantics, not toggle semantics: this list is a
                  // map of openable items, so aria-current is the honest state.
                  aria-current={isSelected ? "true" : undefined}
                  onClick={() => selectPost(key)}
                >
                  <span
                    className={`cms-post-dot cms-post-dot--${publicationDot[state]}${state === "edited" ? " cms-post-dot--dirty" : ""}`}
                    aria-hidden="true"
                  />
                  <span>
                    <strong>{entry.title || `(${key})`}</strong>
                    <small>
                      {locked
                        ? "Tidak dapat diedit sampai diganti nama"
                        : `${publicationCopy[state].label}${showDate ? ` · ${entry.date}` : ""}`}
                    </small>
                  </span>
                  {locked && (
                    <span className="cms-locked-actions">
                      <Badge variant="warning">Perlu ganti nama</Badge>
                      <button
                        type="button"
                        className="cms-rename-link"
                        onClick={(event) => {
                          event.stopPropagation();
                          openRename(key);
                        }}
                      >
                        Ganti nama
                      </button>
                    </span>
                  )}
                </button>
              );
            })}
        </div>
        <div className="cms-new-post">
          {!showNewPostForm ? (
            <button
              type="button"
              className="cms-new-post__toggle"
              onClick={() => setShowNewPostForm(true)}
            >
              <Plus data-icon="inline-start" aria-hidden="true" />
              Artikel baru
            </button>
          ) : (
            <div className="cms-new-post__form">
              <label htmlFor="new-post-slug">Slug (URL)</label>
              <div className="cms-new-post__row">
                <Input
                  id="new-post-slug"
                  value={newPostSlug}
                  placeholder="judul-artikel-baru"
                  aria-label="Slug artikel baru"
                  onChange={(event) => setNewPostSlug(event.target.value)}
                />
                <Button variant="default" onClick={createNewPost} disabled={!newPostSlug.trim()}>
                  Buat
                </Button>
              </div>
              <small>Huruf kecil, angka, dan tanda hubung saja.</small>
            </div>
          )}
        </div>
      </aside>

      <main className="cms-main">
        {showLocalBanner && (
          <div className="cms-local-banner" role="alert">
            <WifiOff aria-hidden="true" />
            <div className="cms-local-banner__text">
              <strong>
                GitHub tak terjangkau · perubahan tersimpan di browser ini. Kirim revisi saat
                koneksi pulih.
              </strong>
              {persistenceError && <small>{persistenceError}</small>}
            </div>
          </div>
        )}
        {showEmptyPanel ? (
          <section className="cms-empty-state" aria-labelledby="cms-empty-title">
            <Inbox aria-hidden="true" className="cms-empty-state__icon" />
            <h2 id="cms-empty-title">Belum ada artikel</h2>
            <p>
              Repositori belum memiliki artikel, dan browser ini tidak menyimpan draf lokal. Mulai
              dari yang pertama.
            </p>
            <Button variant="default" onClick={() => setShowNewPostForm(true)}>
              <Plus data-icon="inline-start" aria-hidden="true" />
              Artikel baru
            </Button>
          </section>
        ) : (
          <>
            <div className="cms-mobile-workspace">
              <label>
                <span>ARTIKEL</span>
                <select
                  value={selectedPost}
                  onChange={(event) => selectPost(event.target.value as PostKey)}
                  aria-label="Pilih artikel"
                >
                  {(Object.keys(posts) as PostKey[]).map((key) => (
                    <option key={key} value={key}>
                      {posts[key].title || `(${key})`}
                    </option>
                  ))}
                </select>
              </label>
              {!showNewPostForm ? (
                <Button
                  variant="outline"
                  onClick={() => setShowNewPostForm(true)}
                  aria-label="Buat artikel baru"
                >
                  <Plus data-icon="inline-start" aria-hidden="true" />
                  Artikel baru
                </Button>
              ) : (
                <div className="cms-new-post__form">
                  <label htmlFor="new-post-slug-mobile">Slug (URL)</label>
                  <div className="cms-new-post__row">
                    <Input
                      id="new-post-slug-mobile"
                      value={newPostSlug}
                      placeholder="judul-artikel-baru"
                      aria-label="Slug artikel baru"
                      onChange={(event) => setNewPostSlug(event.target.value)}
                    />
                    <Button
                      variant="default"
                      onClick={createNewPost}
                      disabled={!newPostSlug.trim()}
                    >
                      Buat
                    </Button>
                  </div>
                  <small>Huruf kecil, angka, dan tanda hubung saja.</small>
                </div>
              )}
            </div>
            {notice && (
              <div className="cms-notice" role="status">
                <Check />
                <span>{notice}</span>
                <button onClick={() => setNotice(null)} aria-label="Tutup pemberitahuan">
                  <X />
                </button>
              </div>
            )}
            {actionError && (
              <div className="cms-error" role="alert">
                <AlertCircle />
                <span>{actionError}</span>
                <button onClick={() => setActionError(null)} aria-label="Tutup pesan error">
                  <X />
                </button>
              </div>
            )}

            <div className="cms-heading">
              <div>
                {/* The filename is a spec key, not an eyebrow: it sits BELOW the
                    title now. Above it, a 12px mono string at 3.1:1 was the first
                    thing read in the heading, which put a filename above the
                    article's own name. */}
                <h1>{post.title || "Artikel tanpa judul"}</h1>
                <p>{contentDetail}</p>
                <div className="cms-kicker">{post.storageSlug}.md</div>
              </div>
              <div className="cms-heading__actions">
                <Badge variant={publication.tone}>{publication.label}</Badge>
                {nextAction && (
                  <Button
                    variant={nextAction.variant}
                    disabled={nextAction.disabled}
                    onClick={nextAction.onClick}
                  >
                    {isBusy ? <LoaderCircle className="cms-spin" data-icon="inline-start" /> : null}
                    {nextAction.label}
                  </Button>
                )}
              </div>
            </div>

            <Card className="cms-editor-card">
              <div
                className="cms-section-tabs"
                ref={sectionTabsRef}
                role="tablist"
                aria-label="Bagian artikel"
              >
                {sectionTabs.map((tab) => (
                  <button
                    key={tab.value}
                    id={`section-${tab.value}-tab`}
                    className={activeTab === tab.value ? "is-active" : ""}
                    role="tab"
                    aria-selected={activeTab === tab.value}
                    aria-controls={`section-${tab.value}-panel`}
                    tabIndex={activeTab === tab.value ? 0 : -1}
                    onClick={() => setActiveTab(tab.value)}
                    onKeyDown={(event) =>
                      moveTab(event, sectionTabsRef, (nextIndex) => {
                        const next = sectionTabs[nextIndex];
                        if (next) setActiveTab(next.value);
                      })
                    }
                  >
                    {tab.label}
                  </button>
                ))}
                <span
                  className="cms-section-tabs__indicator"
                  aria-hidden="true"
                  style={{ left: sectionIndicator.left, width: sectionIndicator.width }}
                />
              </div>
              <div className="cms-section-panels">
                <section
                  id="section-konten-panel"
                  className={activeTab === "konten" ? "is-active" : ""}
                  role="tabpanel"
                  aria-labelledby="section-konten-tab"
                >
                  <div className="cms-panel-toolbar">
                    <div
                      className="cms-segmented"
                      ref={tabsRef}
                      role="group"
                      aria-label="Mode editor"
                    >
                      <button
                        id="write-tab"
                        className={!isMarkdown ? "is-active" : ""}
                        onClick={closeMarkdown}
                        aria-pressed={!isMarkdown}
                      >
                        Editor visual
                      </button>
                      <button
                        id="markdown-tab"
                        className={isMarkdown ? "is-active" : ""}
                        onClick={openMarkdown}
                        aria-pressed={isMarkdown}
                      >
                        Sumber Markdown
                      </button>
                      <span
                        className="cms-segmented__indicator"
                        aria-hidden="true"
                        style={{ left: modeIndicator.left, width: modeIndicator.width }}
                      />
                    </div>
                  </div>
                  {!isMarkdown ? (
                    <div id="write-editor" className="cms-writing-surface">
                      <section className="cms-field-group">
                        <label className="cms-field-label" htmlFor="post-kicker">
                          Label kartu{" "}
                          <span>
                            Teks kecil di atas judul pada kartu blog · kosongkan bila tidak dipakai
                          </span>
                        </label>
                        <Input
                          id="post-kicker"
                          value={post.kicker}
                          onChange={(event) => updatePost({ kicker: event.target.value })}
                        />
                        <label className="cms-field-label" htmlFor="post-title">
                          Judul <span>Judul utama yang tampil di daftar dan pratinjau</span>
                        </label>
                        <Input
                          id="post-title"
                          className="cms-title-input"
                          value={post.title}
                          onChange={(event) => updatePost({ title: event.target.value })}
                        />
                        <label className="cms-field-label" htmlFor="post-excerpt">
                          Ringkasan <span>Ringkasan singkat yang tampil di daftar</span>
                        </label>
                        <textarea
                          id="post-excerpt"
                          className="cms-excerpt-input"
                          value={post.excerpt}
                          aria-label="Ringkasan artikel"
                          onChange={(event) => updatePost({ excerpt: event.target.value })}
                        />
                      </section>
                      <section className="cms-field-group">
                        <span className="cms-field-label">
                          Isi artikel <span>Rich text · disimpan lokal sampai revisi dikirim</span>
                        </span>
                        <MarkdownWysiwyg
                          key={`${post.storageSlug}:${isHydrated ? "hydrated" : "boot"}`}
                          markdown={post.body}
                          onChange={(body) => {
                            updatePost({ body });
                          }}
                        />
                      </section>
                    </div>
                  ) : (
                    <div id="markdown-editor" className="cms-markdown-panel">
                      <section className="cms-field-group">
                        <label className="cms-field-label" htmlFor="markdown-input">
                          Sumber <span>Editan tersinkron kembali ke editor visual</span>
                        </label>
                        <textarea
                          id="markdown-input"
                          className="cms-markdown-input"
                          value={markdownDraft}
                          onChange={(event) => updateMarkdown(event.target.value)}
                          aria-describedby="markdown-note"
                          spellCheck={false}
                        />
                        <p id="markdown-note" className="cms-source-note">
                          Isi artikel saat ini ditampilkan sebagai Markdown. Pertahankan blok
                          frontmatter <code>---</code>; bidang yang didukung dinormalkan saat editan
                          diterapkan.
                        </p>
                      </section>
                    </div>
                  )}
                </section>

                <section
                  id="section-sampul-panel"
                  className={activeTab === "sampul" ? "is-active" : ""}
                  role="tabpanel"
                  aria-labelledby="section-sampul-tab"
                >
                  <div className="cms-writing-surface">
                    <section className="cms-field-group">
                      <span className="cms-field-label">
                        Gambar sampul <span>Opsional</span>
                      </span>
                      {coverMissing && (
                        <p className="cms-field-error" role="alert">
                          Gambar <code>{coverResolution.path}</code> tidak ditemukan di repo, jadi
                          artikel ini akan terbit tanpa sampul. Unggah atau pilih gambar lain —
                          sampul Anda yang lama tidak dihapus.
                        </p>
                      )}
                      <figure className="cms-cover">
                        {currentMedia ? (
                          <img src={currentMedia.src} alt={currentMedia.alt} />
                        ) : coverMissing ? (
                          <div className="cms-cover__empty">
                            Sampul tidak ditemukan — pilih gambar lain.
                          </div>
                        ) : (
                          <div className="cms-cover__empty">Belum ada gambar sampul.</div>
                        )}
                        <figcaption>
                          <span className="cms-cover__action">
                            <button
                              type="button"
                              onClick={() => setMediaOpen(true)}
                              aria-haspopup="dialog"
                              aria-label={`Ganti gambar sampul${currentMedia ? `, pilihan saat ini ${currentMedia.label}` : ""}`}
                            >
                              Ganti gambar
                            </button>
                            <small id="media-picker-note">
                              Unggah atau pilih dari gambar yang didukung repo.
                            </small>
                          </span>
                        </figcaption>
                      </figure>
                      <label className="cms-field-label" htmlFor="post-image-alt">
                        Teks alt <span>Wajib saat gambar sampul dipasang</span>
                      </label>
                      <Input
                        id="post-image-alt"
                        value={post.imageAlt}
                        placeholder="Deskripsi singkat gambar untuk aksesibilitas…"
                        onChange={(event) => updatePost({ imageAlt: event.target.value })}
                      />
                      {post.image && !post.imageAlt.trim() && (
                        <p className="cms-field-error" role="alert">
                          Teks alt wajib sebelum revisi bisa disimpan.
                        </p>
                      )}
                    </section>
                  </div>
                </section>

                <section
                  id="section-terbit-panel"
                  className={activeTab === "terbit" ? "is-active" : ""}
                  role="tabpanel"
                  aria-labelledby="section-terbit-tab"
                >
                  <div className="cms-writing-surface">
                    <section className="cms-field-group">
                      <label className="cms-field-label" htmlFor="post-status">
                        Status <span>Menentukan apakah artikel muncul di situs publik</span>
                      </label>
                      <select
                        id="post-status"
                        className="cms-status-select"
                        value={post.status}
                        onChange={(event) =>
                          updatePost({
                            status: event.target.value as "draft" | "published" | "archived",
                          })
                        }
                      >
                        <option value="draft">Draf · tidak tampil di situs</option>
                        <option value="published">Terbit · tampil di situs</option>
                        <option value="archived">Arsip · disembunyikan dari situs</option>
                      </select>
                      <p className="cms-source-note">
                        Status tersimpan di file artikel. Mengubahnya di sini belum menerbitkan —
                        kirim revisi, lalu setujui di tab ini.
                      </p>
                      {draftPullRequest?.status === "open" && (
                        <a
                          className="cms-pr-link"
                          href={draftPullRequest.prUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Review PR #{draftPullRequest.prNumber}{" "}
                          <ArrowUpRight data-icon="inline-end" />
                        </a>
                      )}
                    </section>

                    <section className="cms-field-group">
                      <span className="cms-field-label">
                        Deploy <span>Otomatis</span>
                      </span>
                      <div className="cms-deploy-line">
                        <div>
                          <strong>
                            {deployedShort ? `Ter-deploy ${deployedShort}` : "Auto-deploy"}
                          </strong>
                          <small>
                            {deployedDate ??
                              "Setiap merge ke main menerbitkan situs; tidak ada langkah deploy manual."}
                          </small>
                        </div>
                      </div>
                    </section>

                    <section className="cms-field-group">
                      <label className="cms-field-label" htmlFor="post-slug">
                        Slug URL <span>Slug yang stabil melindungi tautan lama</span>
                      </label>
                      <div className="cms-slug">
                        <span>/blog/</span>
                        <Input
                          id="post-slug"
                          value={post.slug}
                          onChange={(event) => updatePost({ slug: event.target.value })}
                        />
                      </div>
                      <label className="cms-field-label" htmlFor="post-published-at">
                        Tanggal terbit{" "}
                        <span>
                          Menentukan urutan artikel di blog dan tanggal yang tampil di kartu
                        </span>
                      </label>
                      <Input
                        id="post-published-at"
                        type="date"
                        value={post.publishedAt || post.date}
                        onChange={(event) => {
                          const nextDate = event.target.value;
                          // `date` is the legacy field older posts still carry and
                          // `publishedAt` is what the site actually sorts by
                          // (utils/blog.ts: blogPublishedAt). Editing one and
                          // leaving the other stale is how a publication-date
                          // change silently failed to reorder the blog, so both
                          // move together.
                          updatePost({ publishedAt: nextDate, date: nextDate });
                        }}
                      />
                    </section>
                  </div>
                </section>
              </div>
            </Card>
          </>
        )}
      </main>

      {renameTarget && (
        <div
          className="cms-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRenameTarget("");
          }}
        >
          <section
            ref={renameDialogRef}
            tabIndex={-1}
            className="cms-modal cms-rename-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-title"
            aria-describedby="rename-desc"
          >
            <div className="cms-modal__body">
              <h2 id="rename-title">Ganti nama artikel</h2>
              <p id="rename-desc" className="cms-rename-modal__desc">
                File <code>{renameTarget}.md</code> memakai nama yang tidak valid untuk slug URL.
                Ganti nama untuk membuka artikel ini untuk diedit dan diterbitkan. Perubahan
                langsung dikomit ke GitHub.
              </p>
              <div className="cms-rename-modal__field">
                <label htmlFor="rename-input">Nama file baru (tanpa .md)</label>
                <Input
                  ref={renameInputRef}
                  id="rename-input"
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void submitRename();
                  }}
                />
                {renameError && (
                  <p className="cms-field-error" role="alert">
                    {renameError}
                  </p>
                )}
              </div>
              <div className="cms-rename-modal__actions">
                <Button
                  variant="default"
                  disabled={isRenaming || !renameValue.trim()}
                  onClick={() => void submitRename()}
                >
                  {isRenaming ? (
                    <LoaderCircle className="cms-spin" data-icon="inline-start" />
                  ) : null}
                  Ganti nama
                </Button>
                <Button variant="ghost" disabled={isRenaming} onClick={() => setRenameTarget("")}>
                  Batal
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}

      {isMergeConfirmOpen && draftPullRequest && (
        <div
          className="cms-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMergeConfirmOpen(false);
          }}
        >
          <section
            ref={mergeDialogRef}
            tabIndex={-1}
            className="cms-modal cms-merge-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="merge-confirm-title"
            aria-describedby="merge-confirm-desc"
          >
            <div className="cms-modal__body">
              <h2 id="merge-confirm-title">Setujui & gabungkan revisi?</h2>
              <p id="merge-confirm-desc" className="cms-merge-confirm__desc">
                Revisi <strong>r{draftPullRequest.revision}</strong> (PR #
                {draftPullRequest.prNumber}) akan digabungkan ke <code>main</code>, lalu auto-deploy
                menerbitkannya di situs publik. Tindakan ini memicu deploy baru.
              </p>
              <p className="cms-merge-confirm__warn">
                <strong>Tidak bisa dibatalkan.</strong> Konten otomatis akan tersimpan di branch
                revisi — Anda tetap bisa menutup artikel ini lewat Status Arsip di revisi
                berikutnya.
              </p>
              <div className="cms-merge-confirm__actions">
                <Button
                  variant="default"
                  disabled={isBusy}
                  onClick={() => {
                    setMergeConfirmOpen(false);
                    void mergeRevision();
                  }}
                >
                  {isBusy ? <LoaderCircle className="cms-spin" data-icon="inline-start" /> : null}
                  Ya, gabungkan & terbitkan
                </Button>
                <Button
                  ref={mergeCancelRef}
                  variant="ghost"
                  disabled={isBusy}
                  onClick={() => setMergeConfirmOpen(false)}
                >
                  Batal
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}

      {isMediaOpen && (
        <div
          className="cms-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMediaOpen(false);
          }}
        >
          <section
            ref={mediaDialogRef}
            tabIndex={-1}
            className="cms-modal cms-media-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="media-title"
            aria-describedby="media-description"
          >
            <Button
              variant="ghost"
              size="icon"
              className="cms-modal-close"
              aria-label="Tutup perpustakaan media"
              onClick={() => setMediaOpen(false)}
            >
              <X />
            </Button>
            <div className="cms-modal__body">
              <h2 id="media-title">Perpustakaan media</h2>
              <p id="media-description" className="cms-media-modal__intro">
                Unggah gambar baru (JPEG, PNG, WebP · ≤ 5 MB) atau pilih yang sudah ada. Klik gambar
                untuk jadi sampul; unggahan masuk ke{" "}
                <code>src/images/blog/{post.storageSlug}/</code> dan terkomit saat revisi dikirim.
              </p>
              <div
                className={`cms-upload-zone${isDragOver ? " is-dragover" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!isDragOver) setDragOver(true);
                }}
                onDragLeave={(event) => {
                  // Only clear when the pointer truly left the zone, not when
                  // it moved across a child element (dragleave bubbles).
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                    setDragOver(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOver(false);
                  if (uploadBusy) return;
                  const file = Array.from(event.dataTransfer.files).find((entry) =>
                    /^image\/(jpeg|png|webp)$/.test(entry.type),
                  );
                  if (file) void uploadImage(file);
                  else setUploadError("Hanya gambar JPEG, PNG, atau WebP yang bisa diunggah.");
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  // Visually clipped to 1px, so it must not be a tab stop: the
                  // focus trap could otherwise park focus on an element with no
                  // pixels. The visible "Unggah gambar" button is the real
                  // control and opens this picker programmatically.
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadImage(file);
                  }}
                />
                <div className="cms-upload-zone__hint" aria-hidden="true">
                  <Upload />
                  <span>Tarik & lepas gambar di sini</span>
                </div>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadBusy}
                >
                  {uploadBusy ? (
                    <LoaderCircle className="cms-spin" data-icon="inline-start" />
                  ) : (
                    <Upload data-icon="inline-start" />
                  )}
                  {uploadBusy ? "Mengunggah…" : "Unggah gambar"}
                </Button>
                {uploadError && (
                  <p className="cms-field-error" role="alert">
                    {uploadError}
                  </p>
                )}
              </div>
              {postMedia.length > 0 && (
                <div className="cms-media-uploads">
                  <h3>
                    Media untuk artikel ini
                    {pendingRevision ? <small> · revisi tertunda r{pendingRevision}</small> : null}
                  </h3>
                  <div className="cms-media-grid">
                    {postMedia.map((asset) => {
                      const isBroken = brokenMediaPaths.has(asset.path);
                      return (
                        <div
                          key={asset.path}
                          className={`cms-media-option${asset.path === post.image ? " is-selected" : ""}${isBroken ? " is-broken" : ""}`}
                        >
                          <img
                            src={asset.url}
                            alt=""
                            loading="lazy"
                            onError={() => {
                              setBrokenMediaPaths((current) => {
                                if (current.has(asset.path)) return current;
                                const next = new Set(current);
                                next.add(asset.path);
                                return next;
                              });
                            }}
                          />
                          {isBroken && <span className="cms-media-broken-badge">Gambar rusak</span>}
                          <strong>{asset.filename}</strong>
                          <small>{asset.path}</small>
                          <div className="cms-media-option__actions">
                            <button
                              type="button"
                              className={asset.path === post.image ? "is-active" : ""}
                              aria-pressed={asset.path === post.image}
                              disabled={isBroken}
                              onClick={() => selectUploaded(asset)}
                            >
                              Sampul
                            </button>
                            <button
                              type="button"
                              disabled={isBroken}
                              onClick={() => appendBodyImage(asset.path, asset.filename)}
                            >
                              Sisipkan
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <small className="cms-media-note">
                    "Sisipkan" menambah <code>![alt](path)</code> di akhir artikel.
                  </small>
                </div>
              )}
              {mediaAssets.length ? (
                <div className="cms-media-grid">
                  {mediaAssets.map((asset) => {
                    const isBroken = brokenMediaPaths.has(asset.filename);
                    return (
                      <button
                        key={asset.filename}
                        type="button"
                        className={`cms-media-option${asset.filename === post.image ? " is-selected" : ""}${isBroken ? " is-broken" : ""}`}
                        aria-pressed={asset.filename === post.image}
                        disabled={isBroken}
                        onClick={() => selectMedia(asset)}
                      >
                        <img
                          src={asset.src}
                          alt=""
                          loading="lazy"
                          onError={() => {
                            setBrokenMediaPaths((current) => {
                              if (current.has(asset.filename)) return current;
                              const next = new Set(current);
                              next.add(asset.filename);
                              return next;
                            });
                          }}
                        />
                        {isBroken && <span className="cms-media-broken-badge">Gambar rusak</span>}
                        <strong>{asset.label}</strong>
                        <small>{asset.filename}</small>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="cms-media-empty">
                  Tidak ada gambar repo yang tersedia untuk dipilih.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
