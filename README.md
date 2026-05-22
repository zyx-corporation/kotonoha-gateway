# kotonoha-gateway

**HTTP gateway** for the Kotonoha ecosystem. Exposes the same tool names as [`kotonoha-mcp`](https://github.com/zyx-corporation/kotonoha-mcp) and delegates to the official [`kotonoha`](https://github.com/zyx-corporation/kotonoha-cli) CLI.

**Track:** [#137](https://github.com/zyx-corporation/kotonoha-management/issues/137) · Plan: [`34_kotonoha_gateway_plan_draft.md`](https://github.com/zyx-corporation/kotonoha-management/blob/main/docs/34_kotonoha_gateway_plan_draft.md)

**Product UX contract:** [`04_mcp_tools_and_ux.md`](https://github.com/zyx-corporation/kotonoha-management/blob/main/docs/chatgpt-app/04_mcp_tools_and_ux.md) — implementation guidance; not a replacement for `kotonoha-spec` normative SLS documents.

## Requirements

- **Node.js** ≥ 18
- **`kotonoha`** 0.2.7+ on `PATH`, or **`KOTONOHA_BIN`**
- DB tools: **`DATABASE_URL`** + `kotonoha db migrate`
- **`KOTONOHA_WORKDIR`**: Git repository root

## Quickstart

```bash
npm install && npm run build
export KOTONOHA_BIN="../kotonoha-cli/target/release/kotonoha"
export KOTONOHA_WORKDIR="../kotonoha-cli"
export DATABASE_URL="postgres://..."
# Optional: export KOTONOHA_GATEWAY_API_KEYS="dev-secret"
npm start
```

Default listen: `http://127.0.0.1:8787`

```bash
curl -s http://127.0.0.1:8787/health | jq .
curl -s -X POST http://127.0.0.1:8787/v1/tools/kotonoha_ping \
  -H 'Content-Type: application/json' -d '{}' | jq .
```

With API keys configured:

```bash
curl -s -X POST http://127.0.0.1:8787/v1/tools/kotonoha_ping \
  -H "Authorization: Bearer dev-secret" \
  -H 'Content-Type: application/json' -d '{}'
```

## HTTP API

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | — | Liveness + CLI probe |
| `GET` | `/v1/tools` | if keys set | Tool catalog |
| `POST` | `/v1/tools/{name}` | if keys set | Invoke tool (JSON body = MCP args) |
| `GET` | `/openapi.yaml` | — | OpenAPI 3.1 spec |

## Tools (12)

Same names and CLI mapping as `kotonoha-mcp` — see [README in kotonoha-mcp](https://github.com/zyx-corporation/kotonoha-mcp#mcp-tools).

**Security:** Only [`src/kotonoha.ts`](src/kotonoha.ts) spawns the CLI — [`docs/gateway-contract.md`](docs/gateway-contract.md), `npm run contract:cli-only`.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8787` | Listen port |
| `HOST` | `127.0.0.1` | Bind address |
| `KOTONOHA_GATEWAY_API_KEYS` | *(empty)* | Comma-separated keys; empty = auth off (dev) |
| `KOTONOHA_GATEWAY_RATE_LIMIT` | `60` | Requests per minute per key |
| `KOTONOHA_BIN` | `kotonoha` | CLI binary |
| `KOTONOHA_WORKDIR` | `cwd` | Git repo root |
| `DATABASE_URL` | — | Required for agent/review tools |
| `KOTONOHA_GATEWAY_API_KEY_PRINCIPALS` | *(empty)* | `key=uuid,key2=uuid2` — map API key → principal (M6) |
| `KOTONOHA_GATEWAY_DEFAULT_PRINCIPAL_ID` | legacy principal UUID | Fallback when key not mapped |
| `KOTONOHA_GATEWAY_DEFAULT_PROJECT_ID` | legacy project UUID | Passed to CLI as `KOTONOHA_PROJECT_ID` |
| `KOTONOHA_PRINCIPAL_ID` / `KOTONOHA_PROJECT_ID` | — | Set on child CLI for agent/delta/review/rde (inherited from gateway resolution) |
| `KOTONOHA_GATEWAY_API_KEY_PROJECTS` | *(empty)* | Per-key project UUID (`key=uuid,...`) |
| `KOTONOHA_GATEWAY_API_KEY_PRINCIPALS_FILE` | — | JSON bindings for production |
| `KOTONOHA_GATEWAY_AUDIT_LOG` | `stderr` if keys set | Structured audit JSON lines |

**Production (M6):** [`docs/m6-production.md`](docs/m6-production.md)

## E2E (Pattern A + human review)

Equivalent to [`m5_mcp_e2e`](https://github.com/zyx-corporation/kotonoha-mcp/blob/main/scripts/m5_mcp_e2e.ts):

```bash
export DATABASE_URL="postgres://..."
export KOTONOHA_BIN="../kotonoha-cli/target/release/kotonoha"
export KOTONOHA_WORKDIR="../kotonoha-cli"
npm run test:e2e
# or: ./scripts/m5_gateway_e2e.sh
```

Spawns the gateway, runs steps 1–8 over HTTP (step 7 agent deny via CLI). CI: [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Deployment

See [`docs/deploy.md`](docs/deploy.md).

## License

Apache-2.0 — see [LICENSE](LICENSE).
