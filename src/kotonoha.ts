/**
 * Spawn `kotonoha` CLI — shared by MCP tools (M5-P1a-1+).
 */

import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface RunKotonohaOptions {
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** When set, writes to stdin (CLI path `-` or omitted path). */
  stdin?: string;
}

export interface RunKotonohaResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function resolveKotonohaBin(): string {
  const bin = process.env.KOTONOHA_BIN?.trim();
  return bin && bin.length > 0 ? bin : "kotonoha";
}

export function resolveWorkdir(explicit?: string): string {
  if (explicit?.trim()) {
    return explicit.trim();
  }
  const fromEnv = process.env.KOTONOHA_WORKDIR?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : process.cwd();
}

export function buildChildEnv(extra?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ...extra };
  if (process.env.DATABASE_URL) {
    env.DATABASE_URL = process.env.DATABASE_URL;
  }
  return env;
}

export function runKotonoha(options: RunKotonohaOptions): Promise<RunKotonohaResult> {
  const bin = resolveKotonohaBin();
  const cwd = resolveWorkdir(options.cwd);
  const env = buildChildEnv(options.env);
  const useStdin = options.stdin !== undefined;

  return new Promise((resolve, reject) => {
    const child = spawn(bin, options.args, {
      cwd,
      env,
      stdio: useStdin ? ["pipe", "pipe", "pipe"] : ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    if (useStdin && child.stdin) {
      child.stdin.write(options.stdin!);
      child.stdin.end();
    }

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code, signal) => {
      if (signal) {
        reject(new Error(`kotonoha terminated by signal ${signal}`));
        return;
      }
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
      });
    });
  });
}

export function exitCodeLabel(code: number): string {
  switch (code) {
    case 0:
      return "success";
    case 1:
      return "usage_or_environment";
    case 2:
      return "validation_or_capability_deny";
    case 3:
      return "database_or_io";
    default:
      return `exit_${code}`;
  }
}

/** Write JSON to a temp file; run fn; cleanup. */
export async function withTempJsonFile<T>(
  json: string,
  fn: (filePath: string) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "kotonoha-mcp-"));
  const filePath = join(dir, "payload.json");
  await writeFile(filePath, json, "utf8");
  try {
    return await fn(filePath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export type ToolResultPayload = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
};

export function toolResultFromCli(
  result: RunKotonohaResult,
  extra?: Record<string, unknown>,
): ToolResultPayload {
  const payload = {
    exit_code: result.exitCode,
    exit_label: exitCodeLabel(result.exitCode),
    stdout: result.stdout.trimEnd(),
    stderr: result.stderr.trimEnd(),
    ...extra,
  };
  const text = JSON.stringify(payload, null, 2);
  return {
    content: [{ type: "text", text }],
    ...(result.exitCode !== 0 ? { isError: true } : {}),
  };
}
