/**
 * M5-P2-4 (#137): HTTP gateway E2E — Pattern A + human review via POST /v1/tools/{name}
 *
 * Equivalent to kotonoha-mcp/scripts/m5_mcp_e2e.ts and kotonoha-cli/scripts/m5_agent_run_demo.sh
 *
 * Usage:
 *   export DATABASE_URL=postgres://...
 *   export KOTONOHA_BIN=/path/to/kotonoha
 *   export KOTONOHA_WORKDIR=/path/to/git-repo
 *   npm run test:e2e
 */

import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { TOOL_NAMES } from "../src/tools/catalog.js";
import {
  LEGACY_DEFAULT_PRINCIPAL_ID,
  LEGACY_DEFAULT_PROJECT_ID,
} from "../src/m6-context.js";
import { exitCodeLabel, resolveKotonohaBin, runKotonoha } from "../src/kotonoha.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const gatewayRoot = join(scriptDir, "..");
const serverEntry = join(gatewayRoot, "dist", "index.js");

const E2E_PORT = Number(process.env.GATEWAY_E2E_PORT ?? "9876");
const E2E_API_KEY = process.env.GATEWAY_E2E_API_KEY ?? "e2e-test-key";
const baseUrl = () => `http://127.0.0.1:${E2E_PORT}`;

type ToolResultBlock = {
  content?: { type: string; text?: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

type GatewayEnvelope = {
  tool: string;
  ok: boolean;
  result: ToolResultBlock;
};

type ToolPayload = {
  exit_code?: number;
  exit_label?: string;
  stdout?: string;
  stderr?: string;
  agent_run_id?: string;
  meaning_delta_id?: string;
  rde_assessment_id?: string;
  format?: string;
  human_review?: { review_decision_id?: string };
  hint_en?: string;
  [key: string]: unknown;
};

function parseToolPayload(result: ToolResultBlock): ToolPayload {
  const block = result.content?.find((c) => c.type === "text");
  assert.ok(block?.text, "tool result missing text content");
  return JSON.parse(block.text) as ToolPayload;
}

async function gatewayPost(
  tool: string,
  body: Record<string, unknown>,
  opts?: { auth?: boolean },
): Promise<{ status: number; envelope: GatewayEnvelope }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts?.auth !== false) {
    headers.Authorization = `Bearer ${E2E_API_KEY}`;
  }
  const res = await fetch(`${baseUrl()}/v1/tools/${tool}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const envelope = (await res.json()) as GatewayEnvelope;
  return { status: res.status, envelope };
}

function resolveDefaultWorkdir(): string {
  const explicit = process.env.KOTONOHA_WORKDIR?.trim();
  if (explicit) {
    return explicit;
  }
  return join(gatewayRoot, "..", "kotonoha-cli");
}

async function waitForHealth(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl()}/health`);
      if (res.ok) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`gateway did not become healthy at ${baseUrl()}/health`);
}

function startGatewayServer(
  bin: string,
  workdir: string,
  databaseUrl: string,
): ChildProcess {
  return spawn(process.execPath, [serverEntry], {
    cwd: workdir,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(E2E_PORT),
      KOTONOHA_BIN: bin,
      KOTONOHA_WORKDIR: workdir,
      DATABASE_URL: databaseUrl,
      KOTONOHA_GATEWAY_API_KEYS: E2E_API_KEY,
      KOTONOHA_GATEWAY_API_KEY_PRINCIPALS: `${E2E_API_KEY}=${LEGACY_DEFAULT_PRINCIPAL_ID}`,
      KOTONOHA_GATEWAY_DEFAULT_PROJECT_ID: LEGACY_DEFAULT_PROJECT_ID,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function main(): Promise<void> {
  const bin = resolveKotonohaBin();
  const workdir = resolveDefaultWorkdir();
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    console.error("error: DATABASE_URL is required for M5 gateway E2E");
    process.exit(1);
  }

  console.log("== M5 Gateway HTTP E2E ==");
  console.log(`KOTONOHA_BIN=${bin}`);
  console.log(`KOTONOHA_WORKDIR=${workdir}`);
  console.log(`GATEWAY_URL=${baseUrl()}`);

  await runKotonoha({ args: ["db", "migrate"], cwd: workdir });

  const demoRel = process.env.M5_DEMO_FILE?.trim() || "docs/m5_gateway_e2e_scratch.md";
  const demoAbs = join(workdir, demoRel);
  await mkdir(dirname(demoAbs), { recursive: true });
  await writeFile(
    demoAbs,
    `# M5 Gateway E2E ${new Date().toISOString()}\n`,
    "utf8",
  );

  const server = startGatewayServer(bin, workdir, databaseUrl);
  server.stderr?.on("data", (chunk: Buffer) => {
    process.stderr.write(chunk);
  });

  const shutdown = (): void => {
    if (!server.killed) {
      server.kill("SIGTERM");
    }
  };
  process.on("exit", shutdown);
  process.on("SIGINT", () => {
    shutdown();
    process.exit(130);
  });

  try {
    await waitForHealth();
    console.log("ok: gateway /health");

    console.log("--- Auth probe: unauthenticated POST → 401 ---");
    const unauth = await gatewayPost("kotonoha_ping", {}, { auth: false });
    assert.equal(unauth.status, 401);
    console.log("ok: 401 without API key");

    const catalogRes = await fetch(`${baseUrl()}/v1/tools`, {
      headers: { Authorization: `Bearer ${E2E_API_KEY}` },
    });
    assert.equal(catalogRes.status, 200);
    const catalog = (await catalogRes.json()) as { tools: string[] };
    for (const name of TOOL_NAMES) {
      assert.ok(catalog.tools.includes(name), `missing tool in catalog: ${name}`);
    }
    console.log(`ok: ${catalog.tools.length} tools in catalog`);

    console.log("--- Step 1: kotonoha_context_export (HTTP) ---");
    const ctxRes = await gatewayPost("kotonoha_context_export", { file: demoRel });
    assert.equal(ctxRes.status, 200);
    assert.equal(ctxRes.envelope.ok, true);
    const ctx = parseToolPayload(ctxRes.envelope.result);
    assert.equal(ctx.exit_code, 0, JSON.stringify(ctx));
    assert.match(ctx.stdout ?? "", /kotonoha\.context_pack\.v0\.1/);
    console.log("ok: context pack v0.1");

    console.log("--- Step 2: rde emit (CLI) + kotonoha_rde_validate (HTTP) ---");
    const emit = await runKotonoha({ args: ["rde", "emit"], cwd: workdir });
    assert.equal(emit.exitCode, 0);
    const validateRes = await gatewayPost("kotonoha_rde_validate", {
      rde_json: emit.stdout,
    });
    const validated = parseToolPayload(validateRes.envelope.result);
    assert.equal(validated.exit_code, 0);
    assert.equal(validated.exit_label, exitCodeLabel(0));
    console.log("ok: rde validate exit 0");

    console.log("--- §4.5 probe: invalid RDE → exit 2 via HTTP ---");
    const badRes = await gatewayPost("kotonoha_rde_validate", { rde_json: "{}" });
    assert.equal(badRes.status, 200);
    assert.equal(badRes.envelope.ok, false);
    const badPayload = parseToolPayload(badRes.envelope.result);
    assert.equal(badPayload.exit_code, 2);
    assert.equal(badPayload.exit_label, exitCodeLabel(2));
    console.log("ok: exit 2 mapped to HTTP client");

    const rdeJson = emit.stdout;

    console.log("--- Step 3: kotonoha_agent_record_start (HTTP) ---");
    const startRes = await gatewayPost("kotonoha_agent_record_start", {
      agent_kind: "m5-gateway-e2e",
      external_ref: `gateway-e2e-${Date.now()}`,
    });
    const started = parseToolPayload(startRes.envelope.result);
    assert.equal(started.exit_code, 0);
    const runId = started.agent_run_id ?? started.stdout;
    assert.match(runId ?? "", /^[0-9a-f-]{36}$/i);
    console.log(`agent_run_id: ${runId}`);

    const obs = JSON.stringify({
      preserved: ["intent"],
      intended_change: "M5 Gateway E2E observation",
    });

    console.log("--- Step 4: kotonoha_meaning_delta_from_run (HTTP) ---");
    const deltaRes = await gatewayPost("kotonoha_meaning_delta_from_run", {
      file: demoRel,
      agent_run_id: runId,
      observation_json: obs,
    });
    const deltaPayload = parseToolPayload(deltaRes.envelope.result);
    assert.equal(deltaPayload.exit_code, 0);
    const deltaId = deltaPayload.meaning_delta_id ?? deltaPayload.stdout;
    assert.match(deltaId ?? "", /^[0-9a-f-]{36}$/i);
    console.log(`meaning_delta_id: ${deltaId}`);

    console.log("--- Step 5: kotonoha_rde_attach (HTTP) ---");
    const attachRes = await gatewayPost("kotonoha_rde_attach", {
      delta_id: deltaId,
      rde_json: rdeJson,
      strict: true,
    });
    const attachPayload = parseToolPayload(attachRes.envelope.result);
    assert.equal(attachPayload.exit_code, 0);
    const assessmentId = attachPayload.rde_assessment_id ?? attachPayload.stdout;
    assert.match(assessmentId ?? "", /^[0-9a-f-]{36}$/i);
    console.log(`rde_assessment_id: ${assessmentId}`);

    console.log("--- Step 6: kotonoha_agent_record_complete (HTTP) ---");
    const completeRes = await gatewayPost("kotonoha_agent_record_complete", {
      run_id: runId,
    });
    const completePayload = parseToolPayload(completeRes.envelope.result);
    assert.equal(completePayload.exit_code, 0);
    console.log("ok: agent record complete");

    console.log("--- kotonoha_prepare_human_review (HTTP) ---");
    const prepRes = await gatewayPost("kotonoha_prepare_human_review", {
      delta_id: deltaId,
      assessment_id: assessmentId,
      agent_run_id: runId,
    });
    const prep =
      prepRes.envelope.result.structuredContent ??
      parseToolPayload(prepRes.envelope.result);
    assert.equal(prep.format, "kotonoha.human_review_package.v0.1");
    const statusEn = prep.status_summary_en as string[] | undefined;
    assert.ok(
      statusEn?.some((s) => s.includes("Human approval pending")),
      `expected Human approval pending, got ${JSON.stringify(statusEn)}`,
    );
    const copyCmd = String(
      (prep.next_actions as { copy_cli_review_command?: string } | undefined)
        ?.copy_cli_review_command ?? "",
    );
    assert.ok(!copyCmd.includes("--agent-run-id"));
    console.log("ok: human review package");

    console.log("--- Step 7: agent review approve deny (CLI) ---");
    const deny = await runKotonoha({
      args: [
        "review",
        "approve",
        "--delta-id",
        deltaId!,
        "--assessment-id",
        assessmentId!,
        "--agent-run-id",
        runId!,
        "--decided-by",
        "agent-bot",
      ],
      cwd: workdir,
    });
    assert.equal(deny.exitCode, 2);
    assert.match(deny.stderr, /denied_actions/);
    console.log("ok: capability deny exit 2");

    console.log("--- Step 8: kotonoha_review_approve (HTTP human path) ---");
    const approveRes = await gatewayPost("kotonoha_review_approve", {
      delta_id: deltaId,
      assessment_id: assessmentId,
      decided_by: "human-reviewer",
    });
    assert.equal(approveRes.envelope.ok, true);
    const approved = parseToolPayload(approveRes.envelope.result);
    assert.equal(approved.exit_code, 0, JSON.stringify(approved));
    const hr = approved.human_review as { review_decision_id?: string } | undefined;
    const decisionId = hr?.review_decision_id ?? approved.stdout;
    assert.match(String(decisionId), /^[0-9a-f-]{36}$/i);
    console.log(`review_decision_id: ${decisionId}`);

    console.log("== M5 Gateway HTTP E2E complete ==");
  } finally {
    shutdown();
    await new Promise<void>((resolve) => {
      if (server.exitCode !== null) {
        resolve();
        return;
      }
      server.once("exit", () => resolve());
      setTimeout(resolve, 2000);
    });
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
