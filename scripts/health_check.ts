/**
 * Smoke test: start gateway is not required — assumes server already running.
 * Run: npm run build && npm start &  npm run test:health
 */

import assert from "node:assert/strict";

const base = process.env.GATEWAY_URL ?? "http://127.0.0.1:8787";

const health = await fetch(`${base}/health`);
assert.equal(health.status, 200);
const body = (await health.json()) as { status: string; service: string };
assert.equal(body.status, "ok");
assert.equal(body.service, "kotonoha-gateway");
console.log("ok: GET /health", JSON.stringify(body));

const openApi = await fetch(`${base}/openapi.yaml`);
assert.equal(openApi.status, 200);
assert.match(await openApi.text(), /openapi: 3/);
console.log("ok: GET /openapi.yaml");
