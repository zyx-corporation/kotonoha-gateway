/**
 * Unit tests for M6 API key bindings (M6-d).
 * Run: npm run test:unit
 */

import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  loadApiKeyBindingsFromFile,
  mergeApiKeyBindings,
  parseApiKeyProjects,
  resolveBindingForApiKey,
} from "./api-key-bindings.js";
import { parseApiKeyPrincipals } from "./m6-context.js";

const P1 = "00000000-0000-4000-8000-000000000001";
const PR1 = "00000000-0000-4000-8000-000000000002";
const P2 = "11111111-1111-4111-8111-111111111111";
const PR2 = "22222222-2222-4222-8222-222222222222";

const principals = parseApiKeyPrincipals(`key-a=${P1},key-b=${P2}`);
const projects = parseApiKeyProjects(`key-b=${PR2}`);
const bindings = mergeApiKeyBindings(principals, projects);

assert.equal(bindings.get("key-a")?.principalId, P1);
assert.equal(bindings.get("key-a")?.projectId, undefined);
assert.equal(bindings.get("key-b")?.principalId, P2);
assert.equal(bindings.get("key-b")?.projectId, PR2);

const resolved = resolveBindingForApiKey("key-b", bindings, null, PR1);
assert.equal(resolved.principalId, P2);
assert.equal(resolved.projectId, PR2);

const fallback = resolveBindingForApiKey("unknown", bindings, P1, PR1);
assert.equal(fallback.principalId, P1);
assert.equal(fallback.projectId, PR1);

const dir = mkdtempSync(join(tmpdir(), "kotonoha-gateway-"));
const filePath = join(dir, "principals.json");
writeFileSync(
  filePath,
  JSON.stringify({
    version: "kotonoha.gateway_principals.v0.1",
    bindings: [
      { api_key: "file-key", principal_id: P2, project_id: PR2 },
    ],
  }),
);
const fromFile = loadApiKeyBindingsFromFile(filePath);
assert.equal(fromFile.get("file-key")?.principalId, P2);
assert.equal(fromFile.get("file-key")?.projectId, PR2);

console.log("ok: m6-context bindings");
