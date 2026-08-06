import { runtimeEnv } from "./admin-session.ts";

export type CmsStateStore = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

const developmentState = new Map<string, string>();

export async function cmsStateStore(): Promise<CmsStateStore | null> {
  const env = await runtimeEnv();
  if (env.SESSION) return env.SESSION;
  if (!import.meta.env.DEV) return null;
  return {
    get: async (key) => developmentState.get(key) ?? null,
    put: async (key, value) => {
      developmentState.set(key, value);
    },
  };
}

export async function readCmsState<T>(key: string): Promise<T | null> {
  const store = await cmsStateStore();
  const value = await store?.get(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function writeCmsState<T>(
  key: string,
  value: T,
  expirationTtl: number,
): Promise<void> {
  const store = await cmsStateStore();
  if (!store) throw new Error("CMS state storage is unavailable.");
  await store.put(key, JSON.stringify(value), { expirationTtl });
}
