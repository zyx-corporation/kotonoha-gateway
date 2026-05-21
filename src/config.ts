/**
 * Gateway configuration from environment (M5-P2, M6-d).
 */

import {
  loadApiKeyBindingsFromFile,
  mergeApiKeyBindings,
  parseApiKeyProjects,
  type ApiKeyBinding,
} from "./api-key-bindings.js";
import { parseAuditLogSink, type AuditLogSink } from "./audit-log.js";
import { parseApiKeyPrincipals } from "./m6-context.js";

export type GatewayConfig = {
  host: string;
  port: number;
  /** Empty set = auth disabled (local dev only). */
  apiKeys: Set<string>;
  rateLimitPerMinute: number;
  /** API key → principal + optional project (M6-d). */
  apiKeyBindings: Map<string, ApiKeyBinding>;
  /** Fallback principal when key is not in bindings. */
  defaultPrincipalId: string | null;
  /** Fallback project UUID for tool calls. */
  defaultProjectId: string | null;
  /** Structured audit log sink (M6-d). */
  auditLogSink: AuditLogSink;
};

export const GATEWAY_VERSION = "0.1.3";

export function loadConfig(): GatewayConfig {
  const port = Number(process.env.PORT ?? "8787");
  const keysRaw = process.env.KOTONOHA_GATEWAY_API_KEYS?.trim() ?? "";
  const apiKeys = new Set(
    keysRaw
      ? keysRaw
          .split(",")
          .map((k) => k.trim())
          .filter((k) => k.length > 0)
      : [],
  );

  const principalMap = parseApiKeyPrincipals(
    process.env.KOTONOHA_GATEWAY_API_KEY_PRINCIPALS?.trim() ?? "",
  );
  const projectMap = parseApiKeyProjects(
    process.env.KOTONOHA_GATEWAY_API_KEY_PROJECTS?.trim() ?? "",
  );
  let apiKeyBindings = mergeApiKeyBindings(principalMap, projectMap);

  const bindingsFile = process.env.KOTONOHA_GATEWAY_API_KEY_PRINCIPALS_FILE?.trim();
  if (bindingsFile) {
    const fromFile = loadApiKeyBindingsFromFile(bindingsFile);
    for (const [key, binding] of fromFile) {
      apiKeyBindings.set(key, binding);
    }
  }

  const auditRaw = process.env.KOTONOHA_GATEWAY_AUDIT_LOG?.trim();
  const auditLogSink =
    auditRaw !== undefined && auditRaw !== ""
      ? parseAuditLogSink(auditRaw)
      : apiKeys.size > 0
        ? ("stderr" as AuditLogSink)
        : ("off" as AuditLogSink);

  return {
    host: process.env.HOST ?? "127.0.0.1",
    port: Number.isFinite(port) && port > 0 ? port : 8787,
    apiKeys,
    rateLimitPerMinute: Math.max(
      1,
      Number(process.env.KOTONOHA_GATEWAY_RATE_LIMIT ?? "60"),
    ),
    apiKeyBindings,
    defaultPrincipalId:
      process.env.KOTONOHA_GATEWAY_DEFAULT_PRINCIPAL_ID?.trim() ?? null,
    defaultProjectId:
      process.env.KOTONOHA_GATEWAY_DEFAULT_PROJECT_ID?.trim() ?? null,
    auditLogSink,
  };
}
