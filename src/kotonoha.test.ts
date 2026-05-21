/**
 * Smoke test for CLI subprocess (no MCP). Run: npm run test:cli
 */

import assert from "node:assert/strict";
import { resolveKotonohaBin, runKotonoha } from "./kotonoha.js";

const bin = resolveKotonohaBin();
console.log(`KOTONOHA_BIN=${bin}`);

const result = await runKotonoha({ args: ["version"] });
assert.equal(result.exitCode, 0, `expected exit 0, stderr=${result.stderr}`);
assert.match(result.stdout, /kotonoha /);
console.log("ok: kotonoha version");
console.log(result.stdout.trim());
