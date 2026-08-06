import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Code2,
  FileText,
  HelpCircle,
  Image,
  LoaderCircle,
  Rocket,
  ShieldCheck,
  Type,
  Upload,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
} from "./ui";
import MarkdownWysiwyg from "./MarkdownWysiwyg";

type Role = "owner" | "editor";
type Workspace = "posts" | "media" | "deploys";
type PostKey = "brc" | "atap" | "bondek";
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

const STORAGE_KEY = "bsm-cms-prototype-v3";
const LEGACY_STORAGE_KEY = "bsm-cms-prototype-v2";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPostKey(value: string): value is PostKey {
  return value === "brc" || value === "atap" || value === "bondek";
}

function isContentStatus(value: unknown): value is ContentStatus {
  return value === "draft" || value === "ready" || value === "published" || value === "archived";
}

function normalizeStoredPost(key: string, value: unknown): [PostKey, Post] | null {
  if (!isPostKey(key) || !isRecord(value)) return null;

  const candidate = { ...initialPosts[key], ...value };
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.title !== "string" ||
    typeof candidate.kicker !== "string" ||
    typeof candidate.excerpt !== "string" ||
    typeof candidate.body !== "string" ||
    typeof candidate.date !== "string" ||
    typeof candidate.publishedAt !== "string" ||
    typeof candidate.slug !== "string" ||
    !Array.isArray(candidate.aliases) ||
    candidate.aliases.some((alias) => typeof alias !== "string") ||
    typeof candidate.image !== "string" ||
    typeof candidate.imageAlt !== "string" ||
    typeof candidate.storageSlug !== "string" ||
    !isContentStatus(candidate.status) ||
    (candidate.draft !== undefined && typeof candidate.draft !== "boolean")
  ) {
    return null;
  }

  return [
    key,
    {
      id: candidate.id,
      title: candidate.title,
      kicker: candidate.kicker,
      excerpt: candidate.excerpt,
      body: candidate.body,
      date: candidate.date,
      publishedAt: candidate.publishedAt,
      slug: candidate.slug,
      aliases: candidate.aliases,
      image: candidate.image,
      imageAlt: candidate.imageAlt,
      storageSlug: candidate.storageSlug,
      status: candidate.status,
      draft: candidate.draft,
    },
  ];
}

const workspaceContent: Record<Workspace, { title: string; description: string; rows: string[] }> =
  {
    posts: {
      title: "Posts",
      description: "Drafts and published articles in the content workspace.",
      rows: [
        "Cara Memilih Pagar BRC · Draft",
        "Atap UPVC vs Alderon · Published",
        "Bondek vs Wiremesh · Published",
      ],
    },
    media: {
      title: "Media library",
      description: "Repo-backed images now; external assets can be added later.",
      rows: [
        "pagar-brc-panel-perspektif.jpg · 1200 × 800",
        "atap-upvc.jpeg · 1600 × 900",
        "bondek.png · 1200 × 800",
      ],
    },
    deploys: {
      title: "Deploy history",
      description: "Automatic deploys — every merge to main ships the site.",
      rows: [
        "Auto-deploy · on push to main",
        "Last success · signed callback",
        "No manual deploy step",
      ],
    },
  };

const statusCopy: Record<
  ContentStatus,
  { label: string; detail: string; variant: "secondary" | "warning" | "success" }
> = {
  draft: { label: "Draft", detail: "Local draft · not on GitHub", variant: "secondary" },
  ready: {
    label: "Ready to publish",
    detail: "Waiting for owner review on GitHub",
    variant: "warning",
  },
  published: {
    label: "Published",
    detail: "Merged revision · live on the deployed site",
    variant: "success",
  },
  archived: { label: "Archived", detail: "Hidden from the public site", variant: "secondary" },
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
  const [role, setRole] = useState<Role>("owner");
  const [workspace, setWorkspace] = useState<Workspace>("posts");
  const [posts, setPosts] = useState(initialPosts);
  const [selectedPost, setSelectedPost] = useState<PostKey>("brc");
  const [isMarkdown, setIsMarkdown] = useState(false);
  const [markdownDraft, setMarkdownDraft] = useState("");
  const [markdownBaseline, setMarkdownBaseline] = useState("");
  const [isPreviewOpen, setPreviewOpen] = useState(false);
  const [isHelpOpen, setHelpOpen] = useState(false);
  const [isMediaOpen, setMediaOpen] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [githubStates, setGithubStates] = useState<Record<string, GithubState>>({});
  const [deployed, setDeployed] = useState<DeployInfo | null>(null);
  const [saveLabel, setSaveLabel] = useState("Connecting to CMS…");
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const statusMenuRef = useRef<HTMLDivElement | null>(null);
  const statusMenuItemsRef = useRef<HTMLDivElement | null>(null);
  const statusTriggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const previewDialogRef = useRef<HTMLElement | null>(null);
  const helpDialogRef = useRef<HTMLElement | null>(null);
  const mediaDialogRef = useRef<HTMLElement | null>(null);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const selectedStorageSlugRef = useRef(initialPosts[selectedPost].storageSlug);

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
  const serializedStatus = post.status === "ready" ? "draft" : post.status;
  const currentMarkdown = useMemo(
    () =>
      `---\nid: ${post.id}\nslug: ${post.slug}\ntitle: ${JSON.stringify(post.title)}\nkicker: ${JSON.stringify(post.kicker)}\nexcerpt: ${JSON.stringify(post.excerpt)}\npublishedAt: ${post.publishedAt}\nstatus: ${serializedStatus}\naliases: ${JSON.stringify(post.aliases)}\nimage: ${post.image}\nimageAlt: ${JSON.stringify(post.imageAlt)}\ndate: ${post.date}\ndraft: ${post.draft ? "true" : "false"}\n---\n\n${post.body}`,
    [post, serializedStatus],
  );
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
    ? "Merged revision · live on the deployed site"
    : isPendingDeploy
      ? "Merged on GitHub · auto-deploy in progress"
      : draftPullRequest?.status === "open"
        ? `Revision r${draftPullRequest.revision} awaits review · PR #${draftPullRequest.prNumber}`
        : hasLocalEdits
          ? "Local edits · not committed to GitHub yet"
          : statusCopy[contentStatus].detail;

  const updatePost = (patch: Partial<Post>, markDirty = true) => {
    if (markDirty) setHasLocalEdits(true);
    setPosts((current) => ({ ...current, [selectedPost]: { ...current[selectedPost], ...patch } }));
    if (markDirty) {
      setSaveLabel(persistenceMode === "github" ? "Local edits · not on GitHub" : "Saved locally");
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
      if (!response.ok)
        throw new Error(payload.error ?? `Request failed with HTTP ${response.status}.`);
      return payload as {
        pullRequest?: DraftPullRequest | null;
        sourceMarkdown?: string | null;
        live?: boolean;
        deployed?: DeployInfo | null;
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
      setSaveLabel(error instanceof Error ? error.message : "Unable to read deployment status.");
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
          const safeSaved = Object.fromEntries(
            Object.entries(saved)
              .map(([key, value]) => {
                const normalized = normalizeStoredPost(key, value);
                return normalized;
              })
              .filter((entry): entry is [PostKey, Post] => entry !== null),
          ) as Partial<typeof initialPosts>;
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
        setSaveLabel("Local draft workspace");
        return;
      }
      setPersistenceMode("connecting");
      try {
        for (const key of Object.keys(initialPosts) as PostKey[]) {
          const storageSlug = initialPosts[key].storageSlug;
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
          const source = result.sourceMarkdown;
          if (source) {
            const parsed = parseMarkdownDocument(source);
            if (parsed) {
              setPosts((current) => {
                // Only overlay the repository source when the post is untouched
                // (no browser edits), so local work is never clobbered.
                if (JSON.stringify(current[key]) !== JSON.stringify(initialPosts[key]))
                  return current;
                return { ...current, [key]: { ...current[key], ...parsed, storageSlug } };
              });
            }
          }
        }
        setPersistenceMode("github");
        setSaveLabel("Local draft · GitHub revisions");
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
      if (!isAuthenticated) setSaveLabel("Browser storage unavailable · changes are temporary");
    }
  }, [isAuthenticated, isHydrated, posts]);

  const createPullRequest = async () => {
    // ADR 0011: alt text is required whenever a featured image is set — checked
    // locally for instant feedback; the server gate enforces it again.
    if (post.image && !post.imageAlt.trim()) {
      setActionError("Alt text is required for the featured image before saving a revision.");
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
        `Revision r${result.pullRequest.revision} pushed as PR #${result.pullRequest.prNumber}. Review and merge it on GitHub to publish.`,
      );
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to create GitHub pull request.",
      );
    } finally {
      setBusy(false);
    }
  };

  const markReady = () => {
    updatePost({ status: "ready" });
    setNotice(
      "Marked ready for review. Save a revision to GitHub so the owner can review and merge it.",
    );
  };

  const selectPost = (key: PostKey) => {
    if (selectedPost === key) return;
    if (
      hasLocalEdits ||
      hasUncommittedMarkdown ||
      (isMarkdown && !parseMarkdownDocument(markdownDraft))
    ) {
      setActionError("Finish saving this article before switching to another post.");
      return;
    }
    setSelectedPost(key);
    selectedStorageSlugRef.current = initialPosts[key].storageSlug;
    setIsMarkdown(false);
    setMarkdownDraft("");
    setMarkdownBaseline("");
    setHasLocalEdits(false);
    setActionError(null);
    setNotice(null);
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
    setNotice(`The missing cover was replaced with ${fallbackMedia.label}. Review before saving.`);
  }, [mediaAssets, uploadedAssets, mainAssets, post.image, selectedPost]);

  const selectMedia = (asset: MediaAsset) => {
    updatePost({ image: asset.filename });
    setMediaOpen(false);
    setNotice(
      `Cover image changed to ${asset.label}. It is committed to the repository only when you save a GitHub revision.`,
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
          `Cover uploaded as ${asset.path}. Add alt text below, then save a revision to commit it.`,
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
      `Cover changed to ${asset.path}. It is committed to the repository only when you save a GitHub revision.`,
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
    const parsed = parseMarkdownDocument(markdownDraft);
    if (!parsed) {
      setActionError(
        "Markdown must keep the --- frontmatter block with title, slug, excerpt, status, and publishedAt fields.",
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

  useEffect(() => {
    if (!showStatusMenu) return;
    const frame = window.requestAnimationFrame(() =>
      statusMenuItemsRef.current
        ?.querySelector<HTMLButtonElement>('[role="menuitemradio"]')
        ?.focus(),
    );
    const onPointerDown = (event: PointerEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node))
        setShowStatusMenu(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowStatusMenu(false);
        statusTriggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showStatusMenu]);

  const selectContentStatus = (status: "draft" | "ready" | "published") => {
    updatePost({ status });
    setShowStatusMenu(false);
    window.requestAnimationFrame(() => statusTriggerRef.current?.focus());
  };

  const moveStatusMenu = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'),
    );
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (currentIndex + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    event.preventDefault();
    items[nextIndex]?.focus();
  };

  const moveTab = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!tabsRef.current || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = Array.from(tabsRef.current.querySelectorAll<HTMLButtonElement>("[role=tab]"));
    const index = tabs.indexOf(event.currentTarget);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    tabs[nextIndex]?.focus();
    if (nextIndex === 0 && isMarkdown) closeMarkdown();
    if (nextIndex === 1 && !isMarkdown) openMarkdown();
  };

  const isOwner = role === "owner";
  const nextAction: {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
    disabled?: boolean;
    onClick: () => void;
  } | null = isMarkdown
    ? null
    : draftPullRequest?.status === "open"
      ? {
          label: "Open GitHub PR",
          variant: "outline",
          onClick: () => window.open(draftPullRequest.prUrl, "_blank", "noopener,noreferrer"),
        }
      : isMerged
        ? null
        : isAuthenticated && persistenceMode === "github"
          ? {
              label: "Save revision & open PR",
              variant: "default",
              disabled: isBusy || hasUncommittedMarkdown,
              onClick: () => void createPullRequest(),
            }
          : post.status === "draft"
            ? { label: "Mark ready for review", variant: "default", onClick: markReady }
            : null;

  const activeWorkspace =
    workspace === "posts"
      ? {
          ...workspaceContent.posts,
          rows: (Object.keys(posts) as PostKey[]).map(
            (key) => `${posts[key].title} · ${statusCopy[posts[key].status].label}`,
          ),
        }
      : workspaceContent[workspace];

  const deployedShort = deployed?.commitSha ? deployed.commitSha.slice(0, 7) : null;
  const deployedDate = deployed?.deployedAt ? new Date(deployed.deployedAt).toLocaleString() : null;

  return (
    <div className="cms-dashboard" data-cms-dashboard>
      <header className="cms-topbar">
        <a className="cms-brand" href="/" aria-label="Back to BSM website">
          <span className="cms-brand__mark">BSM</span>
          <span>
            <strong>EDITORIAL CONTROL</strong>
            <small>CONTENT OPERATIONS · PRIVATE</small>
          </span>
        </a>
        <div className="cms-save-status" aria-live="polite">
          <span className={saveLabel.includes("Saving") ? "is-saving" : ""} />
          {saveLabel}
        </div>
        <div className="cms-topbar__actions">
          <label className="cms-role">
            <span>PREVIEW ROLE · UI ONLY</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
              aria-label="Preview CMS as role (simulation only)"
            >
              <option value="owner">Owner</option>
              <option value="editor">Editor</option>
            </select>
          </label>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open workflow notes"
            onClick={() => setHelpOpen(true)}
          >
            <HelpCircle />
          </Button>
        </div>
      </header>

      <aside className="cms-sidebar" aria-label="Editorial navigation">
        <div className="cms-sidebar__eyebrow">WORKSPACE</div>
        <nav className="cms-nav">
          <button
            className={workspace === "posts" ? "is-active" : ""}
            aria-pressed={workspace === "posts"}
            onClick={() => setWorkspace("posts")}
          >
            <FileText /> Posts <span>03</span>
          </button>
          <button
            className={workspace === "media" ? "is-active" : ""}
            aria-pressed={workspace === "media"}
            onClick={() => setWorkspace("media")}
          >
            <Image /> Media
          </button>
          <button
            className={workspace === "deploys" ? "is-active" : ""}
            aria-pressed={workspace === "deploys"}
            onClick={() => setWorkspace("deploys")}
          >
            <Rocket /> Deploys{" "}
            {deployed ? (
              <Badge variant="success">live</Badge>
            ) : (
              <Badge variant="outline">auto</Badge>
            )}
          </button>
        </nav>
        <div className="cms-sidebar__rule" />
        <div className="cms-sidebar__eyebrow">RECENT POSTS</div>
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
                <strong>{posts[key].title}</strong>
                <small>
                  {statusCopy[posts[key].status].label} · {posts[key].date}
                </small>
              </span>
            </button>
          ))}
        </div>
        <div className="cms-sidebar__footer">
          <div className="cms-sidebar__eyebrow">ENVIRONMENT</div>
          <Badge variant="outline">
            <span className="cms-live-dot" /> Draft workspace
          </Badge>
          <p>Every merge to main auto-deploys the site.</p>
        </div>
      </aside>

      <main className="cms-main">
        <div className="cms-mobile-workspace">
          <label>
            <span>WORKSPACE</span>
            <select
              value={workspace}
              onChange={(event) => setWorkspace(event.target.value as Workspace)}
              aria-label="Choose workspace"
            >
              <option value="posts">Posts</option>
              <option value="media">Media</option>
              <option value="deploys">Deploys</option>
            </select>
          </label>
          {workspace === "posts" && (
            <label>
              <span>ARTICLE</span>
              <select
                value={selectedPost}
                onChange={(event) => selectPost(event.target.value as PostKey)}
                aria-label="Choose article"
              >
                {(Object.keys(posts) as PostKey[]).map((key) => (
                  <option key={key} value={key}>
                    {posts[key].title}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="cms-heading">
          <div>
            <div className="cms-kicker">
              <span /> BLOG / EDITOR
            </div>
            <h1>Shape the story.</h1>
            <p>{post.title}</p>
          </div>
          <div className="cms-heading__actions">
            <Button variant="outline" onClick={() => setPreviewOpen(true)}>
              Preview <ArrowUpRight data-icon="inline-end" />
            </Button>
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
                {nextAction.label} <ArrowUpRight data-icon="inline-end" />
              </Button>
            )}
            {isLive && <Badge variant="success">Live</Badge>}
            {isPendingDeploy && <Badge variant="warning">Merged · deploying</Badge>}
            {draftPullRequest?.status === "open" && (
              <a
                className="cms-pr-link"
                href={draftPullRequest.prUrl}
                target="_blank"
                rel="noreferrer"
              >
                PR #{draftPullRequest.prNumber} · r{draftPullRequest.revision}{" "}
                <ArrowUpRight data-icon="inline-end" />
              </a>
            )}
            {persistenceMode === "github" && hasLocalEdits && (
              <Badge variant="warning">Local edits not on GitHub</Badge>
            )}
            {isMarkdown && <Badge variant="warning">Apply Markdown before saving</Badge>}
          </div>
        </div>

        {!isAuthenticated && (
          <div className="cms-notice cms-demo-notice">
            <ShieldCheck />
            <span>
              Demo mode · GitHub and deployment status are unavailable until you sign in. Your
              drafts stay in this browser.
            </span>
          </div>
        )}
        {notice && (
          <div className="cms-notice">
            <Check />
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} aria-label="Dismiss notice">
              <X />
            </button>
          </div>
        )}
        {actionError && (
          <div className="cms-error" role="alert">
            <X />
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} aria-label="Dismiss error">
              <X />
            </button>
          </div>
        )}

        {workspace !== "posts" && (
          <Card className="cms-workspace-card">
            <CardHeader>
              <CardTitle>{activeWorkspace.title}</CardTitle>
              <CardDescription>{activeWorkspace.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="cms-workspace-rows">
                {activeWorkspace.rows.map((row) => (
                  <div key={row}>
                    <strong>{row.split(" · ")[0]}</strong>
                    <span>{row.split(" · ").slice(1).join(" · ")}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <section className="cms-state-strip" aria-label="Publishing state summary">
          <Card className="cms-state-card cms-state-card--content">
            <CardHeader>
              <CardDescription>CONTENT</CardDescription>
              <CardTitle>{statusCopy[contentStatus].label}</CardTitle>
            </CardHeader>
            <CardFooter>
              <span>{contentDetail}</span>
            </CardFooter>
          </Card>
          <Card className="cms-state-card cms-state-card--site">
            <CardHeader>
              <CardDescription>SITE</CardDescription>
              <CardTitle>{deployed ? "Deployed" : "Not live"}</CardTitle>
            </CardHeader>
            <CardFooter>
              <span>{deployedShort ? `Live at ${deployedShort}` : "No confirmed deploy yet"}</span>
            </CardFooter>
          </Card>
          <Card className="cms-state-card cms-state-card--deploy">
            <CardHeader>
              <CardDescription>DEPLOY</CardDescription>
              <CardTitle>{deployed ? "Auto-deploy" : "Awaiting deploy"}</CardTitle>
            </CardHeader>
            <CardFooter>
              <span>
                {deployed ? "Every merge to main ships the site" : "Merge a reviewed PR to deploy"}
              </span>
            </CardFooter>
          </Card>
        </section>

        <div className="cms-editor-grid">
          <Card className="cms-editor-card">
            <div className="cms-editor-tabs">
              <div ref={tabsRef} role="tablist" aria-label="Editor mode">
                <button
                  id="write-tab"
                  className={!isMarkdown ? "is-active" : ""}
                  onClick={closeMarkdown}
                  role="tab"
                  aria-selected={!isMarkdown}
                  aria-controls="write-editor"
                  tabIndex={!isMarkdown ? 0 : -1}
                  onKeyDown={moveTab}
                >
                  Visual editor
                </button>
                <button
                  id="markdown-tab"
                  className={isMarkdown ? "is-active" : ""}
                  onClick={openMarkdown}
                  role="tab"
                  aria-selected={isMarkdown}
                  aria-controls="markdown-editor"
                  tabIndex={isMarkdown ? 0 : -1}
                  onKeyDown={moveTab}
                >
                  Markdown source
                </button>
              </div>
              <span>
                {isMarkdown
                  ? "Editable source"
                  : persistenceMode === "github"
                    ? "GitHub revisions"
                    : "Local draft"}
              </span>
            </div>
            {!isMarkdown ? (
              <div
                id="write-editor"
                className="cms-writing-surface"
                role="tabpanel"
                aria-labelledby="write-tab"
              >
                <div className="cms-content-kicker">
                  ARTICLE <span>·</span> {statusCopy[contentStatus].label.toUpperCase()}
                </div>
                <section className="cms-field-group" aria-labelledby="title-heading">
                  <div className="cms-field-heading">
                    <h2 id="title-heading">
                      <Type aria-hidden="true" /> Title &amp; summary
                    </h2>
                    <span>Text fields</span>
                  </div>
                  <label className="cms-field-label" htmlFor="post-title">
                    Title <span>Headline shown in listings and previews</span>
                  </label>
                  <Input
                    id="post-title"
                    className="cms-title-input"
                    value={post.title}
                    onChange={(event) => updatePost({ title: event.target.value })}
                  />
                  <label className="cms-field-label" htmlFor="post-excerpt">
                    Excerpt <span>Short summary shown in listings</span>
                  </label>
                  <textarea
                    id="post-excerpt"
                    className="cms-excerpt-input"
                    value={post.excerpt}
                    aria-label="Post excerpt"
                    onChange={(event) => updatePost({ excerpt: event.target.value })}
                  />
                </section>
                <section className="cms-field-group" aria-labelledby="image-heading">
                  <div className="cms-field-heading">
                    <h2 id="image-heading">
                      <Image aria-hidden="true" /> Featured image
                    </h2>
                    <span>Optional</span>
                  </div>
                  <figure className="cms-cover">
                    {currentMedia ? (
                      <img src={currentMedia.src} alt={currentMedia.alt} />
                    ) : (
                      <div className="cms-cover__empty">No cover image selected.</div>
                    )}
                    <figcaption>
                      <span>
                        <Image /> Current cover
                      </span>
                      <span className="cms-cover__action">
                        <button
                          type="button"
                          onClick={() => setMediaOpen(true)}
                          disabled={!mediaAssets.length && !isAuthenticated}
                          aria-haspopup="dialog"
                          aria-label={`Change cover image${currentMedia ? `, current selection ${currentMedia.label}` : ""}`}
                        >
                          Change image
                        </button>
                        <small id="media-picker-note">
                          {isAuthenticated
                            ? "Upload or choose from repo-backed images."
                            : "Sign in to upload; repo-backed images are always selectable."}
                        </small>
                      </span>
                    </figcaption>
                  </figure>
                  <label className="cms-field-label" htmlFor="post-image-alt">
                    Alt text <span>Required when a featured image is set</span>
                  </label>
                  <Input
                    id="post-image-alt"
                    value={post.imageAlt}
                    placeholder="Deskripsi singkat gambar untuk aksesibilitas…"
                    onChange={(event) => updatePost({ imageAlt: event.target.value })}
                  />
                  {post.image && !post.imageAlt.trim() && (
                    <p className="cms-field-error" role="alert">
                      Alt text is required before a revision can be saved.
                    </p>
                  )}
                </section>
                <section className="cms-field-group" aria-labelledby="content-heading">
                  <div className="cms-field-heading">
                    <h2 id="content-heading">
                      <FileText aria-hidden="true" /> Content
                    </h2>
                    <span>Rich text · saved locally until a revision is pushed</span>
                  </div>
                  <MarkdownWysiwyg
                    key={`${post.storageSlug}:${isHydrated ? "hydrated" : "boot"}`}
                    markdown={post.body}
                    onChange={(body) => {
                      updatePost({ body });
                      setSaveLabel("Saving locally…");
                    }}
                  />
                </section>
              </div>
            ) : (
              <div
                id="markdown-editor"
                className="cms-markdown-panel"
                role="tabpanel"
                aria-labelledby="markdown-tab"
              >
                <section className="cms-field-group" aria-labelledby="markdown-heading">
                  <div className="cms-field-heading">
                    <h2 id="markdown-heading">
                      <Code2 aria-hidden="true" /> Markdown source
                    </h2>
                    <span>Advanced mode</span>
                  </div>
                  <label className="cms-field-label" htmlFor="markdown-input">
                    Source <span>Edits sync back to the visual editor</span>
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
                    Current post content is shown as Markdown. Keep the <code>---</code> frontmatter
                    block intact; supported fields are normalized when you apply edits.
                  </p>
                </section>
              </div>
            )}
          </Card>

          <aside className="cms-rail" aria-label="Publishing and post settings">
            <Card className="cms-rail-card">
              <div ref={statusMenuRef} className="cms-status-area">
                <CardHeader>
                  <CardDescription>PUBLISHING STATE</CardDescription>
                  <div className="cms-rail-state">
                    <span className={`cms-status-pulse cms-status-pulse--${contentStatus}`} />
                    <div>
                      <CardTitle>{statusCopy[contentStatus].label}</CardTitle>
                      <CardDescription>{contentDetail}</CardDescription>
                    </div>
                    <Button
                      ref={statusTriggerRef}
                      variant="ghost"
                      size="icon"
                      aria-label="Change content state"
                      aria-expanded={showStatusMenu}
                      aria-haspopup="menu"
                      aria-controls="content-status-menu"
                      onClick={() => setShowStatusMenu((visible) => !visible)}
                    >
                      <ChevronDown />
                    </Button>
                  </div>
                </CardHeader>
                {showStatusMenu && (
                  <div
                    ref={statusMenuItemsRef}
                    id="content-status-menu"
                    className="cms-status-menu"
                    role="menu"
                    aria-label="Content status options"
                    onKeyDown={moveStatusMenu}
                  >
                    <button
                      role="menuitemradio"
                      aria-checked={contentStatus === "draft"}
                      onClick={() => selectContentStatus("draft")}
                    >
                      Draft <small>Keep private</small>
                    </button>
                    <button
                      role="menuitemradio"
                      aria-checked={contentStatus === "ready"}
                      onClick={() => selectContentStatus("ready")}
                    >
                      Ready to publish <small>Waiting for owner</small>
                    </button>
                    <button
                      role="menuitemradio"
                      aria-checked={contentStatus === "published"}
                      onClick={() => selectContentStatus("published")}
                    >
                      Published <small>Shown on the public site once merged</small>
                    </button>
                  </div>
                )}
              </div>
            </Card>
            <Card className="cms-rail-card">
              <CardHeader>
                <CardDescription>POST DETAILS</CardDescription>
              </CardHeader>
              <CardContent>
                <label htmlFor="post-slug">URL SLUG</label>
                <div className="cms-slug">
                  <span>/blog/</span>
                  <Input
                    id="post-slug"
                    value={post.slug}
                    onChange={(event) => updatePost({ slug: event.target.value })}
                  />
                </div>
                <small>Stable slugs protect old links.</small>
                <label htmlFor="post-date">PUBLISH DATE</label>
                <Input
                  id="post-date"
                  type="date"
                  value={post.date}
                  onChange={(event) => updatePost({ date: event.target.value })}
                />
              </CardContent>
            </Card>
            <Card className="cms-rail-card">
              <CardHeader>
                <CardDescription>DEPLOYMENT</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="cms-deploy-line">
                  <span />
                  <div>
                    <strong>{deployedShort ? `Deployed ${deployedShort}` : "Auto-deploy"}</strong>
                    <small>
                      {deployedDate ?? "Every merge to main ships the site; no manual deploy step."}
                    </small>
                  </div>
                </div>
                {nextAction && contentStatus !== "draft" && (
                  <small className="cms-owner-note">
                    Use the primary action above to continue this workflow.
                  </small>
                )}
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
                {!isOwner && (
                  <small className="cms-owner-note">
                    Role preview only — all signed-in editors can create revision pull requests.
                  </small>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
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
            <header>
              <Badge variant="outline">MEDIA LIBRARY</Badge>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close media library"
                onClick={() => setMediaOpen(false)}
              >
                <X />
              </Button>
            </header>
            <div className="cms-modal__body">
              <h2 id="media-title">Choose a cover.</h2>
              <p id="media-description" className="cms-media-modal__intro">
                Pick a repo-backed image or upload a new one (JPEG, PNG, WebP · ≤ 5 MB · ≤ 8000 px).
                Uploads land in <code>src/images/blog/{post.storageSlug}/</code> and are committed
                only when you save a GitHub revision.
              </p>
              {isAuthenticated ? (
                <div className="cms-upload-zone">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="Choose an image file to upload as the cover"
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
                    {uploadBusy ? "Uploading…" : "Upload cover image"}
                  </Button>
                  {uploadError && (
                    <p className="cms-field-error" role="alert">
                      {uploadError}
                    </p>
                  )}
                </div>
              ) : (
                <p className="cms-media-empty">Sign in to upload media to the repository.</p>
              )}
              {(uploadedAssets.length > 0 || mainAssets.length > 0) && (
                <div className="cms-media-uploads">
                  <h3>
                    Media for this article
                    {pendingRevision ? <small> · pending revision r{pendingRevision}</small> : null}
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
                  No repo-backed images are available for selection.
                </p>
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
            <header>
              <Badge variant="outline">PRIVATE PREVIEW</Badge>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close preview"
                onClick={() => setPreviewOpen(false)}
              >
                <X />
              </Button>
            </header>
            <div className="cms-modal__body">
              <div className="cms-content-kicker">PANDUAN MATERIAL · {post.date}</div>
              <h2 id="preview-title">{titleForPreview}</h2>
              <p id="preview-description">{post.excerpt}</p>
              <div className="cms-private-link">
                <span>PRIVATE LINK</span>
                <strong>preview.bsm.local/p/{post.slug}</strong>
                <small>Prototype-only · not a production preview route</small>
              </div>
              <div className="cms-modal__rule" />
              <p>
                Draft content stays private until the owner merges its GitHub revision, which
                auto-deploys the site.
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
              aria-label="Close notes"
              onClick={() => setHelpOpen(false)}
            >
              <X />
            </Button>
            <Badge variant="outline">WORKFLOW NOTES</Badge>
            <h2 id="help-title">One surface. No loose ends.</h2>
            <p id="help-description">
              This dashboard keeps the content path explicit: local draft → GitHub revision PR →
              owner review &amp; merge → automatic deploy.
            </p>
            <ul>
              <li>
                Drafts autosave to this browser; a GitHub revision is created only when you
                explicitly save one.
              </li>
              <li>Owners review and merge the revision pull request on GitHub.</li>
              <li>Merging to main auto-deploys; deployment credentials never reach the browser.</li>
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
