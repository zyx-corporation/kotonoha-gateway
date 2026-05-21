/**
 * M6 scope for HTTP tool invocation (#138 M6-c).
 */

export const LEGACY_DEFAULT_PRINCIPAL_ID =
  "00000000-0000-4000-8000-000000000001";
export const LEGACY_DEFAULT_PROJECT_ID =
  "00000000-0000-4000-8000-000000000002";

export type M6InvokeContext = {
  principalId?: string;
  projectId?: string;
};

/** Parse `KOTONOHA_GATEWAY_API_KEY_PRINCIPALS=key=uuid,key2=uuid2`. */
export function parseApiKeyPrincipals(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  const trimmed = raw.trim();
  if (!trimmed) {
    return map;
  }
  for (const part of trimmed.split(",")) {
    const eq = part.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = part.slice(0, eq).trim();
    const principal = part.slice(eq + 1).trim();
    if (key && principal) {
      map.set(key, principal);
    }
  }
  return map;
}

/** Env vars for child `kotonoha` CLI processes (M6-c). */
export function m6ChildEnv(m6?: M6InvokeContext): NodeJS.ProcessEnv | undefined {
  if (!m6?.principalId && !m6?.projectId) {
    return undefined;
  }
  const env: NodeJS.ProcessEnv = {};
  if (m6.principalId) {
    env.KOTONOHA_PRINCIPAL_ID = m6.principalId;
  }
  if (m6.projectId) {
    env.KOTONOHA_PROJECT_ID = m6.projectId;
  }
  return env;
}
