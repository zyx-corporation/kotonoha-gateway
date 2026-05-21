/**
 * API key authentication — Bearer or X-Api-Key (#137 P2-3).
 */

import type { IncomingMessage } from "node:http";

export function extractApiKey(req: IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    const key = auth.slice(7).trim();
    return key.length > 0 ? key : null;
  }
  const xKey = req.headers["x-api-key"];
  if (typeof xKey === "string" && xKey.trim().length > 0) {
    return xKey.trim();
  }
  return null;
}

export function isAuthorized(
  req: IncomingMessage,
  allowedKeys: Set<string>,
): boolean {
  if (allowedKeys.size === 0) {
    return true;
  }
  const key = extractApiKey(req);
  return key !== null && allowedKeys.has(key);
}

export function authRequired(allowedKeys: Set<string>): boolean {
  return allowedKeys.size > 0;
}
