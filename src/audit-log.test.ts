/**
 * Unit tests for gateway audit log (M6-d).
 * Run: npm run test:unit
 */

import assert from "node:assert/strict";

import {
  GATEWAY_AUDIT_SCHEMA,
  apiKeyFingerprint,
  parseAuditLogSink,
  writeAuditLog,
  type GatewayAuditEvent,
} from "./audit-log.js";

assert.equal(parseAuditLogSink("off"), "off");
assert.equal(parseAuditLogSink("stdout"), "stdout");
assert.equal(parseAuditLogSink(undefined), "stderr");

const fp1 = apiKeyFingerprint("secret-key");
const fp2 = apiKeyFingerprint("secret-key");
assert.equal(fp1, fp2);
assert.equal(fp1.length, 12);
assert.notEqual(fp1, apiKeyFingerprint("other"));

let captured = "";
const origWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = ((chunk: string | Uint8Array) => {
  captured += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();
  return true;
}) as typeof process.stderr.write;

const event: GatewayAuditEvent = {
  schema: GATEWAY_AUDIT_SCHEMA,
  ts: "2026-05-21T00:00:00.000Z",
  event: "tool_invoke",
  method: "POST",
  path: "/v1/tools/kotonoha_ping",
  tool: "kotonoha_ping",
  principal_id: "00000000-0000-4000-8000-000000000001",
  project_id: "00000000-0000-4000-8000-000000000002",
  api_key_fp: fp1,
  ok: true,
  http_status: 200,
  duration_ms: 12,
};

writeAuditLog("stderr", event);
process.stderr.write = origWrite;

const line = captured.trim();
const parsed = JSON.parse(line) as GatewayAuditEvent;
assert.equal(parsed.schema, GATEWAY_AUDIT_SCHEMA);
assert.equal(parsed.principal_id, event.principal_id);
assert.equal(parsed.api_key_fp, fp1);
assert.equal(parsed.event, "tool_invoke");

writeAuditLog("off", event);
console.log("ok: audit-log");
