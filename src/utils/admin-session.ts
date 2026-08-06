const SESSION_PREFIX = "bsm-cms-session:";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

type SessionStore = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
};

export type RuntimeEnv = {
  SESSION?: SessionStore;
  CMS_GITHUB_PAT?: string;
  CMS_OWNER_SECRET?: string;
  CMS_DEPLOY_CALLBACK_URL?: string;
  CMS_DEPLOY_CALLBACK_SECRET?: string;
  CMS_GITHUB_API_URL?: string;
};

const developmentSessions = new Map<string, string>();

function developmentEnv(name: keyof RuntimeEnv): string | undefined {
  if (!import.meta.env.DEV) return undefined;
  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;
  return processEnv?.[name] ?? import.meta.env[name];
}

export async function runtimeEnv(): Promise<RuntimeEnv> {
  let workerEnv: RuntimeEnv = {};
  try {
    const workers = await import("cloudflare:workers");
    workerEnv = (workers as { env?: RuntimeEnv }).env ?? {};
  } catch {
    // Local Astro dev has no Cloudflare runtime binding.
  }

  if (!import.meta.env.DEV) return workerEnv;
  return {
    ...workerEnv,
    CMS_GITHUB_PAT: workerEnv.CMS_GITHUB_PAT ?? developmentEnv("CMS_GITHUB_PAT"),
    CMS_OWNER_SECRET: workerEnv.CMS_OWNER_SECRET ?? developmentEnv("CMS_OWNER_SECRET"),
    CMS_DEPLOY_CALLBACK_URL:
      workerEnv.CMS_DEPLOY_CALLBACK_URL ?? developmentEnv("CMS_DEPLOY_CALLBACK_URL"),
    CMS_DEPLOY_CALLBACK_SECRET:
      workerEnv.CMS_DEPLOY_CALLBACK_SECRET ?? developmentEnv("CMS_DEPLOY_CALLBACK_SECRET"),
    CMS_GITHUB_API_URL: workerEnv.CMS_GITHUB_API_URL ?? developmentEnv("CMS_GITHUB_API_URL"),
  };
}

async function store(): Promise<SessionStore | null> {
  const env = await runtimeEnv();
  if (env.SESSION) return env.SESSION;
  return import.meta.env.DEV
    ? {
        get: async (key) => developmentSessions.get(key) ?? null,
        put: async (key, value) => {
          developmentSessions.set(key, value);
        },
        delete: async (key) => {
          developmentSessions.delete(key);
        },
      }
    : null;
}

export function sessionCookieValue(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === "bsm-cms-session") return value.join("=") || null;
  }
  return null;
}

export async function createAdminSession(pat: string): Promise<string | null> {
  const sessionId = crypto.randomUUID();
  const sessionStore = await store();
  if (!sessionStore) return null;
  await sessionStore.put(`${SESSION_PREFIX}${sessionId}`, pat, {
    expirationTtl: SESSION_TTL_SECONDS,
  });
  return sessionId;
}

export async function readAdminSession(request: Request): Promise<string | null> {
  const sessionId = sessionCookieValue(request);
  if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) return null;
  const sessionStore = await store();
  return sessionStore?.get(`${SESSION_PREFIX}${sessionId}`) ?? null;
}

export async function destroyAdminSession(request: Request): Promise<void> {
  const sessionId = sessionCookieValue(request);
  if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) return;
  const sessionStore = await store();
  await sessionStore?.delete(`${SESSION_PREFIX}${sessionId}`);
}

export function sessionCookie(sessionId: string, secure: boolean): string {
  return [
    `bsm-cms-session=${encodeURIComponent(sessionId)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ]
    .filter(Boolean)
    .join("; ");
}

export function expiredSessionCookie(secure: boolean): string {
  return [
    "bsm-cms-session=",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    "Max-Age=0",
  ]
    .filter(Boolean)
    .join("; ");
}

export async function secretsMatch(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const a = new Uint8Array(leftHash);
  const b = new Uint8Array(rightHash);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

export async function configuredOwnerSecret(): Promise<string | null> {
  const env = await runtimeEnv();
  return env.CMS_OWNER_SECRET ?? developmentEnv("CMS_OWNER_SECRET") ?? null;
}

export async function configuredGitHubPat(): Promise<string | null> {
  const env = await runtimeEnv();
  return env.CMS_GITHUB_PAT ?? developmentEnv("CMS_GITHUB_PAT") ?? null;
}
