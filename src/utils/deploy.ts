import { runtimeEnv } from "./admin-session.ts";
import { readCmsState, writeCmsState } from "./cms-state.ts";

// Deployment boundary (ADR 0010): deployments are automatic — every push to
// `main` runs the deploy workflow and POSTs the deployed commit SHA back to the
// signed callback. KV holds only that deploy confirmation (plus sessions);
// everything else about a revision lives in GitHub itself (ADR 0013).

const DEPLOYED_SHA_KEY = "bsm-cms-deploy:deployed-sha";
const DEPLOYED_TTL_SECONDS = 30 * 24 * 60 * 60;
const CALLBACK_MAX_AGE_SECONDS = 5 * 60;
const GITHUB_API_VERSION = "2022-11-28";
const GITHUB_REPOSITORY = "gsmandiriweb/site";
const SHA_PATTERN = /^[0-9a-f]{40}$/i;

export class DeployActionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "DeployActionError";
  }
}

export type DeployInfo = {
  commitSha: string;
  deployedAt: string;
};

export async function deployedCommit(): Promise<DeployInfo | null> {
  return readCmsState<DeployInfo>(DEPLOYED_SHA_KEY);
}

function hexToBytes(value: string): Uint8Array | null {
  if (!/^[0-9a-f]{64}$/i.test(value)) return null;
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function verifyCallbackSignature(
  body: string,
  timestamp: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const timestampSeconds = Number(timestamp);
  if (
    !Number.isInteger(timestampSeconds) ||
    Math.abs(Date.now() / 1000 - timestampSeconds) > CALLBACK_MAX_AGE_SECONDS
  ) {
    return false;
  }

  const provided = signature.replace(/^sha256=/i, "");
  const signatureBytes = hexToBytes(provided);
  if (!signatureBytes) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signatureBuffer = new ArrayBuffer(signatureBytes.byteLength);
  new Uint8Array(signatureBuffer).set(signatureBytes);
  return crypto.subtle.verify(
    "HMAC",
    key,
    signatureBuffer,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
}

// Verifies the signed workflow callback and records the deployed commit as the
// "live" boundary. A `failed` status leaves the previous confirmation in place.
export async function recordDeployCallback(
  request: Request,
  body: string,
): Promise<DeployInfo | null> {
  const env = await runtimeEnv();
  const timestamp = request.headers.get("x-bsm-deploy-timestamp");
  const signature = request.headers.get("x-bsm-deploy-signature");
  if (
    !env.CMS_DEPLOY_CALLBACK_SECRET ||
    !timestamp ||
    !signature ||
    !(await verifyCallbackSignature(body, timestamp, signature, env.CMS_DEPLOY_CALLBACK_SECRET))
  ) {
    throw new DeployActionError("Invalid deployment callback signature.", 401);
  }

  let payload: { commitSha?: unknown; status?: unknown };
  try {
    payload = JSON.parse(body) as typeof payload;
  } catch {
    throw new DeployActionError("Invalid deployment callback payload.", 400);
  }
  if (payload.status !== "succeeded") return null;

  const commitSha = typeof payload.commitSha === "string" ? payload.commitSha : null;
  if (!commitSha || !SHA_PATTERN.test(commitSha)) {
    throw new DeployActionError("Deployment callback requires a valid commitSha.", 400);
  }
  const info: DeployInfo = { commitSha, deployedAt: new Date().toISOString() };
  await writeCmsState(DEPLOYED_SHA_KEY, info, DEPLOYED_TTL_SECONDS);
  return info;
}

// Is `commitSha` an ancestor of (or equal to) the currently deployed commit?
// `compare/{deployed}...{sha}` reports "identical" for equal commits and
// "behind" when the head is an ancestor of the base — both mean the deployed
// site already contains this commit.
export async function isCommitDeployed(commitSha: string): Promise<boolean> {
  const deployed = await deployedCommit();
  if (!deployed || !SHA_PATTERN.test(commitSha)) return false;
  if (deployed.commitSha === commitSha) return true;

  const env = await runtimeEnv();
  const apiUrl = import.meta.env.DEV
    ? (env.CMS_GITHUB_API_URL ?? "https://api.github.com")
    : "https://api.github.com";
  const pat = env.CMS_GITHUB_PAT ?? null;
  try {
    const response = await fetch(
      `${apiUrl}/repos/${GITHUB_REPOSITORY}/compare/${deployed.commitSha}...${commitSha}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": GITHUB_API_VERSION,
          "User-Agent": "bsm-cms",
          ...(pat ? { Authorization: `Bearer ${pat}` } : {}),
        },
      },
    );
    if (!response.ok) return false;
    const payload = (await response.json()) as { status?: unknown };
    return payload.status === "identical" || payload.status === "behind";
  } catch {
    return false;
  }
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
  });
}
