/**
 * HTTP server — /health, /v1/tools/{name}, OpenAPI redirect (M5-P2).
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { authRequired, extractApiKey, isAuthorized } from "./auth.js";
import { resolvePrincipalForApiKey, type M6InvokeContext } from "./m6-context.js";
import { GATEWAY_VERSION, type GatewayConfig } from "./config.js";
import { sendJson, readJsonBody } from "./http/respond.js";
import { checkRateLimit } from "./rate-limit.js";
import { resolveKotonohaBin, runKotonoha } from "./kotonoha.js";
import { TOOL_NAMES } from "./tools/catalog.js";
import { invokeTool, ToolInvokeError } from "./tools/invoke.js";

const here = dirname(fileURLToPath(import.meta.url));

function loadOpenApiYaml(): string {
  const path = join(here, "..", "openapi", "openapi.yaml");
  return readFileSync(path, "utf8");
}

export function startServer(config: GatewayConfig): void {
  const openApiYaml = loadOpenApiYaml();

  const server = createServer(async (req, res) => {
    try {
      await handleRequest(req, res, config, openApiYaml);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: "internal_error", message });
    }
  });

  server.listen(config.port, config.host, () => {
    console.log(
      `kotonoha-gateway ${GATEWAY_VERSION} listening on http://${config.host}:${config.port}`,
    );
    console.log(`  KOTONOHA_BIN=${resolveKotonohaBin()}`);
    console.log(
      `  auth=${authRequired(config.apiKeys) ? "required" : "disabled (set KOTONOHA_GATEWAY_API_KEYS)"}`,
    );
  });
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: GatewayConfig,
  openApiYaml: string,
): Promise<void> {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const path = url.pathname;

  if (method === "GET" && path === "/health") {
    const cliProbe = await runKotonoha({ args: ["version"] }).catch(() => null);
    sendJson(res, 200, {
      status: "ok",
      service: "kotonoha-gateway",
      version: GATEWAY_VERSION,
      auth_required: authRequired(config.apiKeys),
      tools_registered: TOOL_NAMES.length,
      kotonoha_bin: resolveKotonohaBin(),
      cli_reachable: cliProbe !== null && cliProbe.exitCode === 0,
    });
    return;
  }

  if (method === "GET" && (path === "/openapi.yaml" || path === "/v1/openapi.yaml")) {
    res.writeHead(200, { "Content-Type": "application/yaml; charset=utf-8" });
    res.end(openApiYaml);
    return;
  }

  const toolMatch = path.match(/^\/v1\/tools\/([a-z0-9_]+)$/);
  if (method === "POST" && toolMatch) {
    if (!isAuthorized(req, config.apiKeys)) {
      sendJson(res, 401, {
        error: "unauthorized",
        message: "Provide Authorization: Bearer <key> or X-Api-Key",
      });
      return;
    }

    const rateKey = extractApiKey(req) ?? req.socket.remoteAddress ?? "anonymous";
    const rate = checkRateLimit(rateKey, config.rateLimitPerMinute);
    if (!rate.allowed) {
      sendJson(
        res,
        429,
        { error: "rate_limited", retry_after_sec: rate.retryAfterSec },
        { "Retry-After": String(rate.retryAfterSec ?? 60) },
      );
      return;
    }

    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, {
        error: "invalid_body",
        message: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    const toolName = toolMatch[1]!;
    const apiKey = extractApiKey(req);
    const m6: M6InvokeContext = {
      principalId: resolvePrincipalForApiKey(
        apiKey,
        config.apiKeyPrincipals,
        config.defaultPrincipalId,
      ),
      projectId: config.defaultProjectId ?? undefined,
    };
    try {
      const result = await invokeTool(toolName, body, m6);
      sendJson(res, 200, {
        tool: toolName,
        ok: !result.isError,
        result,
      });
    } catch (err) {
      if (err instanceof ToolInvokeError) {
        sendJson(res, err.status, { error: "tool_error", message: err.message });
        return;
      }
      if (err instanceof Error && err.name === "ZodError") {
        sendJson(res, 400, { error: "validation_error", message: err.message });
        return;
      }
      throw err;
    }
    return;
  }

  if (method === "GET" && path === "/v1/tools") {
    if (!isAuthorized(req, config.apiKeys)) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    sendJson(res, 200, { tools: [...TOOL_NAMES] });
    return;
  }

  sendJson(res, 404, { error: "not_found", path });
}
