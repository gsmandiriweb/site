import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  FileText,
  HelpCircle,
  LoaderCircle,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  Upload,
  X,
} from "lucide-react";
import { Badge, Button, Card, Input } from "./ui";
import MarkdownWysiwyg from "./MarkdownWysiwyg";
import { serializeDraftMarkdown } from "../utils/cms-drafts.ts";

// Posts are keyed by storage slug (the filename without .md), seeded from the
// demo set and grown with the repository listing and locally created articles.
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

const initialBodies: Record<PostKey, string> = {
  brc: `Pagar BRC adalah pagar las galvanis yang diproduksi dari besi beton polos dilas membentuk mesh (kawat) persegi. Karena diproduksi di pabrik dengan cetakan presisi, ukuran dan kekuatannya seragam.\n\n## Perhatikan diameter besi (∅)\n\nDiameter besi menentukan kekuatan rangka. Pagar BRC umumnya menggunakan besi ∅6 mm untuk kebutuhan umum.\n\nMulai bagian berikutnya dengan menjelaskan kebutuhan proyek Anda…`,
  atap: `Atap UPVC dan Alderon sama-sama dirancang untuk kebutuhan penutup bangunan yang ringan dan tahan cuaca. Perbandingan yang tepat dimulai dari kondisi lokasi dan kebutuhan ruang.\n\n## Periksa kondisi pabrik\n\nPertimbangkan bentang, sirkulasi udara, pencahayaan, dan kebutuhan perawatan sebelum memilih material.\n\nTambahkan konteks proyek Anda untuk melanjutkan panduan ini…`,
  bondek: `Bondek dan wiremesh bekerja pada bagian yang berbeda dalam konstruksi lantai cor. Memahami fungsi masing-masing membantu tim memilih kombinasi material yang sesuai.\n\n## Mulai dari fungsi material\n\nBondek menjadi bekisting tetap, sementara wiremesh membantu membentuk tulangan pada pelat lantai.\n\nTambahkan kebutuhan bentang dan ketebalan untuk melanjutkan panduan ini…`,
};

const initialPosts: Record<PostKey, Post> = {
  brc: {
    id: "7bff2b31-948a-7426-9f1a-6c4d7a8b2e10",
    title: "Cara Memilih Pagar BRC: Ukuran, Ketebalan & Galvanis",
    kicker: "Panduan Material",
    excerpt: "Bedah spesifikasi pagar BRC supaya proyek pagar Anda tahan karat dan sesuai beban.",
    body: initialBodies.brc,
    date: "2026-07-18",
    publishedAt: "2026-07-18",
    slug: "cara-memilih-pagar-brc",
    aliases: [],
    image: "pagar-brc-panel-perspektif.jpg",
    imageAlt: "Panel pagar BRC galvanis tampak perspektif",
    storageSlug: "cara-memilih-pagar-brc",
    status: "draft",
  },
  atap: {
    id: "ed940a62-6272-4e1a-9d8e-5c7b3f0a6d21",
    title: "Atap UPVC vs Alderon: Mana yang Pas untuk Pabrik Anda?",
    kicker: "Banding Material",
    excerpt: "Atap dingin untuk gudang dan pabrik. Bandingkan material sebelum memesan.",
    body: initialBodies.atap,
    date: "2026-07-09",
    publishedAt: "2026-07-09",
    slug: "atap-upvc-vs-alderon",
    aliases: [],
    image: "atap-upvc.jpeg",
    imageAlt: "Atap UPVC untuk bangunan industri",
    storageSlug: "atap-upvc-vs-alderon",
    status: "published",
  },
  bondek: {
    id: "5445c8c9-b8a3-8e25-9d16-7f0a2b9e6c31",
    title: "Bondek vs Wiremesh: Solusi Lantai Cor yang Tepat",
    kicker: "Struktur & Lantai",
    excerpt: "Pahami perbedaan bondek dan wiremesh sebelum menentukan kebutuhan proyek.",
    body: initialBodies.bondek,
    date: "2026-06-27",
    publishedAt: "2026-06-27",
    slug: "bondek-vs-wiremesh",
    aliases: [],
    image: "bondek.png",
    imageAlt: "Bondek untuk lantai cor beton",
    storageSlug: "bondek-vs-wiremesh",
    status: "published",
  },
};

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
// in src/content.config.ts).
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

const statusCopy: Record<
  ContentStatus,
  { label: string; detail: string; variant: "secondary" | "warning" | "success" }
> = {
  draft: { label: "Draf", detail: "Draf lokal · belum di GitHub", variant: "secondary" },
  ready: {
    label: "Siap rilis",
    detail: "Menunggu persetujuan owner · terbit lewat dasbor ini",
    variant: "warning",
  },
  published: {
    label: "Terbit",
    detail: "Revisi ter-merge · live di situs ter-deploy",
    variant: "success",
  },
  archived: { label: "Arsip", detail: "Disembunyikan dari situs publik", variant: "secondary" },
};

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
    if (!supportedKeys.has(key)) return null;
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

export default function CmsDashboard({
  mediaAssets,
  isAuthenticated,
}: {
  mediaAssets: MediaAsset[];
  isAuthenticated: boolean;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [selectedPost, setSelectedPost] = useState<PostKey>("brc");
  const [isMarkdown, setIsMarkdown] = useState(false);
  const [markdownDraft, setMarkdownDraft] = useState("");
  const [markdownBaseline, setMarkdownBaseline] = useState("");
  const [isPreviewOpen, setPreviewOpen] = useState(false);
  const [isHelpOpen, setHelpOpen] = useState(false);
  const [isMediaOpen, setMediaOpen] = useState(false);
  const [githubStates, setGithubStates] = useState<Record<string, GithubState>>({});
  const [deployed, setDeployed] = useState<DeployInfo | null>(null);
  const [saveLabel, setSaveLabel] = useState("Menghubungkan ke CMS…");
  const [persistenceMode, setPersistenceMode] = useState<PersistenceMode>("connecting");
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isBusy, setBusy] = useState(false);
  const [hasLocalEdits, setHasLocalEdits] = useState(false);
  const [isHydrated, setHydrated] = useState(false);
  const [uploadedAssets, setUploadedAssets] = useState<UploadedMediaEntry[]>([]);
  const [mainAssets, setMainAssets] = useState<UploadedMediaEntry[]>([]);
  const [pendingRevision, setPendingRevision] = useState<number | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [bodyUploadBusy, setBodyUploadBusy] = useState(false);
  const [showNewPostForm, setShowNewPostForm] = useState(false);
  const [newPostSlug, setNewPostSlug] = useState("");
  const [activeTab, setActiveTab] = useState<EditorSection>("konten");
  const [sectionIndicator, setSectionIndicator] = useState({ left: 0, width: 0 });
  const [modeIndicator, setModeIndicator] = useState({ left: 0, width: 0 });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bodyFileInputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const previewDialogRef = useRef<HTMLElement | null>(null);
  const helpDialogRef = useRef<HTMLElement | null>(null);
  const mediaDialogRef = useRef<HTMLElement | null>(null);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const sectionTabsRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const selectedStorageSlugRef = useRef(initialPosts[selectedPost]?.storageSlug ?? selectedPost);

  useEffect(() => {
    const root = document.documentElement;
    const button = document.querySelector<HTMLButtonElement>("[data-cms-theme-toggle]");
    const label = button?.querySelector<HTMLElement>("[data-cms-theme-label]");
    const applyTheme = (theme: "light" | "dark") => {
      const light = theme === "light";
      root.dataset.theme = theme;
      button?.setAttribute("aria-pressed", String(light));
      button?.setAttribute("aria-label", light ? "Activate dark mode" : "Activate light mode");
      button?.setAttribute("title", light ? "Activate dark mode" : "Activate light mode");
      if (label) label.textContent = light ? "Dark" : "Light";
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

  useEffect(() => {
    if (!isPreviewOpen && !isHelpOpen && !isMediaOpen) return;
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const activeDialogRef = isPreviewOpen
      ? previewDialogRef
      : isHelpOpen
        ? helpDialogRef
        : mediaDialogRef;
    dialogRef.current = activeDialogRef.current;
    const frame = window.requestAnimationFrame(() => activeDialogRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewOpen(false);
        setHelpOpen(false);
        setMediaOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "button, a, input, textarea, select, [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (!focusable.length) return;
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
    document.body.style.overflow = "hidden";
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      restoreFocusRef.current?.focus();
    };
  }, [isPreviewOpen, isHelpOpen, isMediaOpen]);

  const post = posts[selectedPost];
  const currentMarkdown = useMemo(() => serializeDraftMarkdown(post), [post]);
  const hasUncommittedMarkdown = isMarkdown && markdownDraft !== markdownBaseline;
  const githubState = githubStates[post.storageSlug];
  const draftPullRequest = githubState?.pullRequest ?? null;
  const isLive = Boolean(githubState?.live);
  const isMerged = draftPullRequest?.status === "merged";
  const isPendingDeploy = isMerged && !isLive;
  const contentStatus: ContentStatus = isLive
    ? "published"
    : isPendingDeploy
      ? "ready"
      : post.status;
  const contentDetail = isLive
    ? "Revisi ter-merge · live di situs"
    : isPendingDeploy
      ? "Revisi ter-merge · auto-deploy sedang berjalan"
      : draftPullRequest?.status === "open"
        ? `Revisi r${draftPullRequest.revision} menunggu persetujuan owner · PR #${draftPullRequest.prNumber}`
        : hasLocalEdits
          ? "Local edits · not committed to GitHub yet"
          : statusCopy[contentStatus].detail;

  const updatePost = (patch: Partial<Post>, markDirty = true) => {
    if (markDirty) setHasLocalEdits(true);
    setPosts((current) => ({ ...current, [selectedPost]: { ...current[selectedPost], ...patch } }));
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
        throw new Error(payload.error ?? `Request failed with HTTP ${response.status}.`);
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

  const refreshPostState = async (storageSlug: string) => {
    if (!isAuthenticated) return;
    try {
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
    } catch {
      // Transient polling failures must not disturb the editing surface.
    }
  };

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const legacyStored = stored ? null : window.localStorage.getItem(LEGACY_STORAGE_KEY);
      const storedValue = stored ?? legacyStored;
      if (storedValue) {
        try {
          const saved: unknown = JSON.parse(storedValue);
          if (!isRecord(saved)) throw new Error("Stored CMS state is not an object.");
          const normalizedEntries = Object.entries(saved)
            .map(([key, value]) => normalizeStoredPost(key, value))
            .filter((entry): entry is [PostKey, Post] => entry !== null);
          const safeSaved: Record<string, Post> = Object.fromEntries(normalizedEntries);
          setPosts((current) => ({ ...current, ...safeSaved }));
          const savedActivePost = safeSaved[selectedPost];
          setHasLocalEdits(
            Boolean(
              savedActivePost &&
              JSON.stringify(savedActivePost) !== JSON.stringify(initialPosts[selectedPost]),
            ),
          );
        } catch {
          setHasLocalEdits(false);
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
        setSaveLabel("Ruang draf lokal");
        return;
      }
      setPersistenceMode("connecting");
      try {
        // The repo's actual posts (ADR 0013) plus the seeded demo posts; locally
        // created drafts live in browser storage and are merged above.
        const listed = isAuthenticated ? await request("/api/cms/posts", "GET") : null;
        const repoSlugs = (listed?.posts ?? []).map((entry) => entry.storageSlug);
        const knownKeys = Array.from(
          new Set<string>([...(Object.keys(posts) as PostKey[]), ...repoSlugs]),
        );
        for (const key of knownKeys) {
          const persistentSlug = initialPosts[key]?.storageSlug ?? key;
          const result = await request(
            `/api/cms/drafts/pr?storageSlug=${encodeURIComponent(persistentSlug)}`,
            "GET",
          );
          setGithubStates((current) => ({
            ...current,
            [persistentSlug]: {
              pullRequest: result.pullRequest ?? null,
              live: Boolean(result.live),
            },
          }));
          const source = result.sourceMarkdown;
          if (source) {
            const parsed = parseMarkdownDocument(source);
            if (parsed) {
              setPosts((current) => {
                // Only overlay the repository source when the post is untouched
                // (no browser edits), so local work is never clobbered.
                if (
                  !initialPosts[key] &&
                  current[key]?.storageSlug === persistentSlug &&
                  current[key]?.title === "" &&
                  current[key]?.body === ""
                )
                  return {
                    ...current,
                    [key]: { ...current[key], ...parsed, storageSlug: persistentSlug },
                  };
                if (JSON.stringify(current[key]) !== JSON.stringify(initialPosts[key]))
                  return current;
                return {
                  ...current,
                  [key]: { ...current[key], ...parsed, storageSlug: persistentSlug },
                };
              });
            }
          }
        }
        setPersistenceMode("github");
        setSaveLabel("Draf lokal · revisi GitHub");
      } catch (error) {
        setPersistenceMode("local");
        setSaveLabel(
          error instanceof Error
            ? `${error.message} · local only`
            : "GitHub unavailable · local only",
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
      if (!result.pullRequest) throw new Error("GitHub returned no pull request.");
      setGithubStates((current) => ({
        ...current,
        [post.storageSlug]: { pullRequest: result.pullRequest!, live: false },
      }));
      setHasLocalEdits(false);
      setNotice(
        `Revisi r${result.pullRequest.revision} dikirim sebagai PR #${result.pullRequest.prNumber}. Setujui & gabungkan dari dasbor ini untuk menerbitkan (opsional: via GitHub).`,
      );
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Tidak dapat membuat pull request GitHub.",
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
    if (
      !window.confirm(
        `Setujui dan gabungkan revisi r${draftPullRequest.revision} ke main? Artikel akan auto-deploy ke situs.`,
      )
    )
      return;
    setBusy(true);
    setActionError(null);
    try {
      const result = await request("/api/cms/drafts/pr/merge", "POST", {
        storageSlug: post.storageSlug,
      });
      if (!result.pullRequest) throw new Error("GitHub returned no pull request.");
      setGithubStates((current) => ({
        ...current,
        [post.storageSlug]: { pullRequest: result.pullRequest!, live: false },
      }));
      setHasLocalEdits(false);
      setNotice(
        `Revisi r${result.pullRequest.revision} disetujui & digabungkan ke main (PR #${result.pullRequest.prNumber}). Auto-deploy berjalan — artikel berubah menjadi Terbit begitu situs live.`,
      );
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Tidak dapat menggabungkan revisi GitHub.",
      );
    } finally {
      setBusy(false);
    }
  };

  const selectPost = (key: PostKey) => {
    if (selectedPost === key) return;
    if (
      hasLocalEdits ||
      hasUncommittedMarkdown ||
      (isMarkdown && !parseMarkdownDocument(markdownDraft))
    ) {
      setActionError("Selesaikan penyimpanan artikel ini sebelum berpindah ke artikel lain.");
      return;
    }
    setSelectedPost(key);
    selectedStorageSlugRef.current = posts[key]?.storageSlug ?? key;
    setActiveTab("konten");
    setIsMarkdown(false);
    setMarkdownDraft("");
    setMarkdownBaseline("");
    setHasLocalEdits(false);
    setActionError(null);
    setNotice(null);
  };

  const createNewPost = () => {
    const slug = newPostSlug.trim().toLowerCase();
    if (!isSlugLike(slug)) {
      setActionError(
        "Slug harus pakai huruf kecil, angka, dan tanda hubung tunggal (contoh: panduan-atap-upvc).",
      );
      return;
    }
    if (posts[slug]) {
      setActionError(`Artikel dengan slug "${slug}" sudah ada.`);
      return;
    }
    const post = emptyPost(slug);
    setPosts((current) => ({ ...current, [slug]: post }));
    setSelectedPost(slug);
    selectedStorageSlugRef.current = slug;
    setShowNewPostForm(false);
    setNewPostSlug("");
    setHasLocalEdits(false);
    setActionError(null);
    setNotice(
      `Draf "${slug}" dibuat. Tulis artikelnya, lalu simpan revisi untuk membuka pull request GitHub.`,
    );
  };

  const titleForPreview = post.title;
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

  useEffect(() => {
    const fallbackMedia = mediaAssets[0];
    if (!fallbackMedia) return;
    const resolvable = (path: string) =>
      !path ||
      mediaAssets.some(
        (asset) => asset.filename === path || asset.filename === path.split("/").pop(),
      ) ||
      uploadedAssets.some((asset) => asset.path === path) ||
      mainAssets.some((asset) => asset.path === path);
    if (resolvable(post.image)) return;
    setPosts((current) => ({
      ...current,
      [selectedPost]: { ...current[selectedPost], image: fallbackMedia.filename },
    }));
    setHasLocalEdits(true);
    setNotice(
      `Sampul yang hilang diganti dengan ${fallbackMedia.label}. Periksa sebelum menyimpan.`,
    );
  }, [mediaAssets, uploadedAssets, mainAssets, post.image, selectedPost]);

  const selectMedia = (asset: MediaAsset) => {
    updatePost({ image: asset.filename });
    setMediaOpen(false);
    setNotice(
      `Gambar sampul diganti ke ${asset.label}. Dikomit ke repo hanya saat Anda menyimpan revisi GitHub.`,
    );
  };

  const loadMedia = async () => {
    if (!isAuthenticated) return;
    setUploadError(null);
    try {
      const response = await fetch(
        `/api/cms/media?storageSlug=${encodeURIComponent(post.storageSlug)}`,
        { credentials: "same-origin", headers: { Accept: "application/json" } },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to load media.");
      setUploadedAssets(payload.assets ?? []);
      setMainAssets(payload.mainAssets ?? []);
      setPendingRevision(payload.revision ?? null);
    } catch {
      setUploadError("Unable to load media for this post.");
    }
  };

  useEffect(() => {
    if (isMediaOpen && isAuthenticated) void loadMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMediaOpen, isAuthenticated, post.storageSlug]);

  const uploadCover = async (file: File) => {
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
      if (!response.ok) throw new Error(payload.error ?? "Upload failed.");
      const asset = payload.asset;
      if (asset) {
        setUploadedAssets((current) =>
          current.some((entry) => entry.path === asset.path) ? current : [...current, asset],
        );
        updatePost({ image: asset.path });
        setNotice(
          `Sampul diunggah sebagai ${asset.path}. Tambahkan teks alt di bawah, lalu simpan revisi untuk mengomitenya.`,
        );
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploadBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const selectUploaded = (asset: UploadedMediaEntry) => {
    updatePost({ image: asset.path });
    setNotice(
      `Sampul diganti ke ${asset.path}. Dikomit ke repo hanya saat Anda menyimpan revisi GitHub.`,
    );
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
      `Gambar disisipkan di akhir artikel (${path}). Gunakan sumber Markdown untuk memindahkannya dan edit teks alt di sana.`,
    );
  };

  const uploadBody = async (file: File) => {
    if (!isAuthenticated) return;
    setBodyUploadBusy(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("storageSlug", post.storageSlug);
      form.append("kind", "body");
      form.append("name", file.name);
      form.append("file", file);
      const response = await fetch("/api/cms/media", {
        method: "POST",
        credentials: "same-origin",
        body: form,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Upload failed.");
      const asset = payload.asset as UploadedMediaEntry | undefined;
      if (asset) {
        setUploadedAssets((current) =>
          current.some((entry) => entry.path === asset.path) ? current : [...current, asset],
        );
        appendBodyImage(asset.path, asset.filename);
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBodyUploadBusy(false);
      if (bodyFileInputRef.current) bodyFileInputRef.current.value = "";
    }
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
    const parsed = parseMarkdownDocument(markdownDraft);
    if (!parsed) {
      setActionError(
        "Markdown harus mempertahankan blok frontmatter --- dengan bidang judul, slug, ringkasan, status, dan publishedAt.",
      );
      return;
    }
    const normalized =
      parsed.status === "draft" && post.status === "ready"
        ? { ...parsed, status: "ready" as const }
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
    if (parseMarkdownDocument(source)) setActionError(null);
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
    variant: "default" | "secondary" | "outline" | "destructive";
    disabled?: boolean;
    onClick: () => void;
  } | null = isMarkdown
    ? null
    : draftPullRequest?.status === "open"
      ? {
          label: "Setujui & gabungkan",
          variant: "default",
          disabled: isBusy || hasUncommittedMarkdown,
          onClick: () => void mergeRevision(),
        }
      : isMerged
        ? null
        : isAuthenticated && persistenceMode === "github"
          ? {
              label: "Simpan revisi & buka PR",
              variant: "default",
              disabled: isBusy || hasUncommittedMarkdown,
              onClick: () => void createPullRequest(),
            }
          : null;

  const deployedShort = deployed?.commitSha ? deployed.commitSha.slice(0, 7) : null;
  const deployedDate = deployed?.deployedAt ? new Date(deployed.deployedAt).toLocaleString() : null;

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
          <span className={saveLabel.includes("Saving") ? "is-saving" : ""} />
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
            aria-label="Activate light mode"
            title="Activate light mode"
          >
            <Sun aria-hidden="true" className="cms-theme-toggle__light" />
            <Moon aria-hidden="true" className="cms-theme-toggle__dark" />
            <span data-cms-theme-label>Dark</span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Buka catatan alur kerja"
            onClick={() => setHelpOpen(true)}
          >
            <HelpCircle />
          </Button>
        </div>
      </header>

      <aside className="cms-sidebar" aria-label="Navigasi editorial">
        <div className="cms-sidebar__eyebrow">Artikel</div>
        <div className="cms-post-list">
          {(Object.keys(posts) as PostKey[]).map((key) => (
            <button
              key={key}
              className={selectedPost === key ? "is-selected" : ""}
              aria-pressed={selectedPost === key}
              onClick={() => selectPost(key)}
            >
              <span
                className={`cms-post-dot cms-post-dot--${posts[key].status}`}
                aria-hidden="true"
              />
              <span>
                <strong>{posts[key].title || `(${key})`}</strong>
                <small>
                  {statusCopy[posts[key].status].label} · {posts[key].date}
                </small>
              </span>
            </button>
          ))}
        </div>
        <div className="cms-new-post">
          {!showNewPostForm ? (
            <button
              type="button"
              className="cms-new-post__toggle"
              onClick={() => setShowNewPostForm(true)}
            >
              ＋ Artikel baru
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
              ＋ Artikel baru
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
                <Button variant="default" onClick={createNewPost} disabled={!newPostSlug.trim()}>
                  Buat
                </Button>
              </div>
              <small>Huruf kecil, angka, dan tanda hubung saja.</small>
            </div>
          )}
        </div>
        {notice && (
          <div className="cms-notice">
            <Check />
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} aria-label="Tutup pemberitahuan">
              <X />
            </button>
          </div>
        )}
        {actionError && (
          <div className="cms-error" role="alert">
            <X />
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} aria-label="Tutup pesan error">
              <X />
            </button>
          </div>
        )}

        <div className="cms-heading">
          <div>
            <div className="cms-kicker">{post.storageSlug}.md</div>
            <h1>{post.title || "Artikel tanpa judul"}</h1>
            <p>{contentDetail}</p>
          </div>
          <div className="cms-heading__actions">
            <Badge
              variant={
                contentStatus === "published"
                  ? "success"
                  : contentStatus === "ready"
                    ? "warning"
                    : "outline"
              }
            >
              {statusCopy[contentStatus].label}
            </Badge>
            <Button variant="outline" onClick={() => setPreviewOpen(true)}>
              Pratinjau <ArrowUpRight data-icon="inline-end" />
            </Button>
            {draftPullRequest?.status === "open" && (
              <Button
                variant="ghost"
                onClick={() => window.open(draftPullRequest.prUrl, "_blank", "noopener,noreferrer")}
              >
                Lihat PR di GitHub <ArrowUpRight data-icon="inline-end" />
              </Button>
            )}
            {nextAction && (
              <Button
                variant={nextAction.variant}
                disabled={nextAction.disabled}
                onClick={nextAction.onClick}
              >
                {isBusy ? (
                  <LoaderCircle className="cms-spin" data-icon="inline-start" />
                ) : nextAction.variant === "secondary" ? (
                  <ShieldCheck data-icon="inline-start" />
                ) : null}
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
                <div className="cms-segmented" ref={tabsRef} role="group" aria-label="Mode editor">
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
                        setSaveLabel("Menyimpan lokal…");
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
                  <figure className="cms-cover">
                    {currentMedia ? (
                      <img src={currentMedia.src} alt={currentMedia.alt} />
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
                    Status <span>Disimpan di frontmatter artikel</span>
                  </label>
                  <select
                    id="post-status"
                    className="cms-status-select"
                    value={post.status}
                    onChange={(event) =>
                      updatePost({ status: event.target.value as "draft" | "ready" | "published" })
                    }
                  >
                    <option value="draft">Draf</option>
                    <option value="ready">Siap rilis</option>
                    <option value="published">Terbit</option>
                  </select>
                  {draftPullRequest?.status === "open" && (
                    <a
                      className="cms-pr-link"
                      href={draftPullRequest.prUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Review PR #{draftPullRequest.prNumber} <ArrowUpRight data-icon="inline-end" />
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
                  <label className="cms-field-label" htmlFor="post-date">
                    Tanggal terbit
                  </label>
                  <Input
                    id="post-date"
                    type="date"
                    value={post.date}
                    onChange={(event) => updatePost({ date: event.target.value })}
                  />
                </section>
              </div>
            </section>
          </div>
        </Card>
      </main>

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
                Pilih sampul dari repo, unggah gambar baru (JPEG, PNG, WebP · ≤ 5 MB · ≤ 8000 px),
                dan sisipkan gambar yang diunggah ke isi artikel. Unggahan masuk ke{" "}
                <code>src/images/blog/{post.storageSlug}/</code> dan hanya dikomit saat Anda
                menyimpan revisi GitHub.
              </p>
              <>
                <div className="cms-upload-zone">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="Pilih file gambar untuk diunggah sebagai sampul"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadCover(file);
                    }}
                  />
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
                    {uploadBusy ? "Mengunggah…" : "Unggah gambar sampul"}
                  </Button>
                </div>
                <div className="cms-upload-zone cms-upload-zone--body">
                  <input
                    ref={bodyFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="Pilih file gambar untuk diunggah ke isi artikel"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadBody(file);
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={() => bodyFileInputRef.current?.click()}
                    disabled={bodyUploadBusy}
                  >
                    {bodyUploadBusy ? (
                      <LoaderCircle className="cms-spin" data-icon="inline-start" />
                    ) : (
                      <Upload data-icon="inline-start" />
                    )}
                    {bodyUploadBusy ? "Mengunggah…" : "Unggah gambar ke isi artikel"}
                  </Button>
                  <small>Disisipkan sebagai Markdown di akhir artikel Anda.</small>
                </div>
                {uploadError && (
                  <p className="cms-field-error" role="alert">
                    {uploadError}
                  </p>
                )}
              </>
              {(uploadedAssets.length > 0 || mainAssets.length > 0) && (
                <div className="cms-media-uploads">
                  <h3>
                    Media untuk artikel ini
                    {pendingRevision ? <small> · revisi tertunda r{pendingRevision}</small> : null}
                  </h3>
                  <div className="cms-media-grid">
                    {[
                      ...uploadedAssets,
                      ...mainAssets.filter(
                        (entry) => !uploadedAssets.some((uploaded) => uploaded.path === entry.path),
                      ),
                    ].map((asset) => (
                      <button
                        key={asset.path}
                        type="button"
                        className={`cms-media-option${asset.path === post.image ? " is-selected" : ""}`}
                        aria-pressed={asset.path === post.image}
                        onClick={() => selectUploaded(asset)}
                      >
                        <img
                          src={asset.url}
                          alt=""
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.style.visibility = "hidden";
                          }}
                        />
                        <strong>{asset.filename}</strong>
                        <small>{asset.path}</small>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {mediaAssets.length ? (
                <div className="cms-media-grid">
                  {mediaAssets.map((asset) => (
                    <button
                      key={asset.filename}
                      type="button"
                      className={`cms-media-option${asset.filename === post.image ? " is-selected" : ""}`}
                      aria-pressed={asset.filename === post.image}
                      onClick={() => selectMedia(asset)}
                    >
                      <img src={asset.src} alt="" />
                      <strong>{asset.label}</strong>
                      <small>{asset.filename}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="cms-media-empty">
                  Tidak ada gambar repo yang tersedia untuk dipilih.
                </p>
              )}
              {(uploadedAssets.length > 0 || mainAssets.length > 0) && (
                <div className="cms-media-uploads">
                  <h3>Sisipkan gambar ke isi artikel</h3>
                  <ul className="cms-body-insert-list">
                    {[
                      ...uploadedAssets,
                      ...mainAssets.filter(
                        (entry) => !uploadedAssets.some((uploaded) => uploaded.path === entry.path),
                      ),
                    ].map((asset) => (
                      <li key={`insert-${asset.path}`}>
                        <span>
                          <strong>{asset.filename}</strong>
                          <small>{asset.path}</small>
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => appendBodyImage(asset.path, asset.filename)}
                        >
                          <FileText data-icon="inline-start" />
                          Sisipkan
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <small className="cms-media-note">
                    Menyisipkan <code>![alt](path)</code> di akhir artikel; pindahkan atau edit teks
                    alt di sumber Markdown.
                  </small>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
      {isPreviewOpen && (
        <div
          className="cms-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewOpen(false);
          }}
        >
          <section
            ref={previewDialogRef}
            tabIndex={-1}
            className="cms-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-title"
            aria-describedby="preview-description"
          >
            <Button
              variant="ghost"
              size="icon"
              className="cms-modal-close"
              aria-label="Tutup pratinjau"
              onClick={() => setPreviewOpen(false)}
            >
              <X />
            </Button>
            <div className="cms-modal__body">
              <div className="cms-content-kicker">PANDUAN MATERIAL · {post.date}</div>
              <h2 id="preview-title">{titleForPreview}</h2>
              <p id="preview-description">{post.excerpt}</p>
              <div className="cms-private-link">
                <span>TAUTAN PRIBADI</span>
                <strong>preview.bsm.local/p/{post.slug}</strong>
                <small>Prototipe saja · bukan rute pratinjau produksi</small>
              </div>
              <p>
                Konten draf tetap pribadi sampai owner menyetujui revisinya dari dasbor ini —
                mergenya otomatis menerbitkan situs.
              </p>
            </div>
          </section>
        </div>
      )}
      {isHelpOpen && (
        <div
          className="cms-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setHelpOpen(false);
          }}
        >
          <section
            ref={helpDialogRef}
            tabIndex={-1}
            className="cms-modal cms-help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            aria-describedby="help-description"
          >
            <Button
              variant="ghost"
              size="icon"
              className="cms-modal-close"
              aria-label="Tutup catatan"
              onClick={() => setHelpOpen(false)}
            >
              <X />
            </Button>
            <h2 id="help-title">Satu permukaan. Tanpa ujung longgar.</h2>
            <p id="help-description">
              Dasbor ini menjaga jalur konten tetap eksplisit: draf lokal → revisi (PR GitHub) →
              persetujuan &amp; merge owner → deploy otomatis. Semua langkah bisa dilakukan di sini;
              GitHub tidak wajib dibuka.
            </p>
            <ul>
              <li>
                Draf tersimpan otomatis di browser ini; revisi GitHub dibuat hanya saat Anda
                menyimpannya secara eksplisit.
              </li>
              <li>
                Owner menyetujui &amp; menggabungkan revisi langsung dari dasbor ini (GitHub
                opsional).
              </li>
              <li>
                Merge ke main otomatis mendeploy; kredensial deploy tidak pernah sampai ke browser.
              </li>
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
