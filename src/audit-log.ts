/**
 * Structured gateway audit log (M6-d / #138).
 * One JSON line per event — suitable for log aggregation (CloudWatch, Loki, etc.).
 */

import { createHash } from "node:crypto";

export const GATEWAY_AUDIT_SCHEMA = "kotonoha.gateway_audit.v0.1";

export type AuditLogSink = "stderr" | "stdout" | "off";

export type GatewayAuditEvent = {
  schema: typeof GATEWAY_AUDIT_SCHEMA;
  ts: string;
  event: "tool_invoke" | "tool_error" | "auth_denied" | "rate_limited";
  method: string;
  path: string;
  tool?: string;
  principal_id?: string;
  project_id?: string;
  /** SHA-256 prefix of API key — never log the raw key. */
  api_key_fp?: string;
  ok?: boolean;
  http_status: number;
  duration_ms?: number;
  error_kind?: string;
  remote_addr?: string;
};

export function parseAuditLogSink(raw: string | undefined): AuditLogSink {
  const v = (raw ?? "stderr").trim().toLowerCase();
  if (v === "off" || v === "none" || v === "false" || v === "0") {
    return "off";
  }
  if (v === "stdout") {
    return "stdout";
  }
  return "stderr";
}

/** Fingerprint for audit correlation without storing secrets. */
export function apiKeyFingerprint(apiKey: string): string {
  return createHash("sha256").update(apiKey, "utf8").digest("hex").slice(0, 12);
}

export function writeAuditLog(sink: AuditLogSink, event: GatewayAuditEvent): void {
  if (sink === "off") {
    return;
  }
  const line = `${JSON.stringify(event)}\n`;
  if (sink === "stdout") {
    process.stdout.write(line);
  } else {
    process.stderr.write(line);
  }
}
