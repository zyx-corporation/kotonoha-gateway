/**
 * API key → principal / project bindings (M6-d).
 */

import { readFileSync } from "node:fs";

import { parseApiKeyPrincipals } from "./m6-context.js";

export type ApiKeyBinding = {
  principalId: string;
  projectId?: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

/** `KOTONOHA_GATEWAY_API_KEY_PROJECTS=key=uuid,...` */
export function parseApiKeyProjects(raw: string): Map<string, string> {
  return parseApiKeyPrincipals(raw);
}

export function mergeApiKeyBindings(
  principalMap: Map<string, string>,
  projectMap: Map<string, string>,
): Map<string, ApiKeyBinding> {
  const out = new Map<string, ApiKeyBinding>();
  for (const [key, principalId] of principalMap) {
    if (!isUuid(principalId)) {
      continue;
    }
    out.set(key, {
      principalId,
      projectId: projectMap.get(key),
    });
  }
  for (const [key, projectId] of projectMap) {
    if (!isUuid(projectId)) {
      continue;
    }
    const existing = out.get(key);
    if (existing) {
      existing.projectId = projectId;
    }
  }
  return out;
}

type PrincipalsFileV01 = {
  version?: string;
  bindings?: {
    api_key: string;
    principal_id: string;
    project_id?: string;
  }[];
};

/** Load `KOTONOHA_GATEWAY_API_KEY_PRINCIPALS_FILE` (JSON). */
export function loadApiKeyBindingsFromFile(path: string): Map<string, ApiKeyBinding> {
  const raw = readFileSync(path, "utf8");
  const doc = JSON.parse(raw) as PrincipalsFileV01 | Record<string, ApiKeyBinding>;
  const out = new Map<string, ApiKeyBinding>();

  if (doc && typeof doc === "object" && "bindings" in doc && Array.isArray(doc.bindings)) {
    for (const row of doc.bindings) {
      if (!row?.api_key || !row.principal_id || !isUuid(row.principal_id)) {
        continue;
      }
      const binding: ApiKeyBinding = { principalId: row.principal_id };
      if (row.project_id && isUuid(row.project_id)) {
        binding.projectId = row.project_id;
      }
      out.set(row.api_key.trim(), binding);
    }
    return out;
  }

  if (doc && typeof doc === "object") {
    for (const [key, val] of Object.entries(doc)) {
      if (key === "version" || typeof val !== "object" || val === null) {
        continue;
      }
      const v = val as { principalId?: string; principal_id?: string; projectId?: string; project_id?: string };
      const principalId = v.principalId ?? v.principal_id;
      if (!principalId || !isUuid(principalId)) {
        continue;
      }
      const binding: ApiKeyBinding = { principalId };
      const projectId = v.projectId ?? v.project_id;
      if (projectId && isUuid(projectId)) {
        binding.projectId = projectId;
      }
      out.set(key, binding);
    }
  }
  return out;
}

export function resolveBindingForApiKey(
  apiKey: string | null,
  bindings: Map<string, ApiKeyBinding>,
  defaultPrincipalId: string | null,
  defaultProjectId: string | null,
): { principalId?: string; projectId?: string } {
  if (apiKey && bindings.has(apiKey)) {
    const b = bindings.get(apiKey)!;
    return {
      principalId: b.principalId,
      projectId: b.projectId ?? defaultProjectId ?? undefined,
    };
  }
  return {
    principalId: defaultPrincipalId?.trim() || undefined,
    projectId: defaultProjectId?.trim() || undefined,
  };
}
