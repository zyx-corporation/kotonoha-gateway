# kotonoha-gateway — deployment notes (M5-P2-4)

## Runtime requirements

| Requirement | Notes |
| --- | --- |
| Node.js | ≥ 18 |
| `kotonoha` CLI | 0.2.7+ on server `PATH` or `KOTONOHA_BIN` |
| PostgreSQL | `DATABASE_URL` for agent/review tools |
| Git worktree | `KOTONOHA_WORKDIR` — repo root for `context export` |

## Environment

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | no | `8787` | Listen port |
| `HOST` | no | `127.0.0.1` | Bind address (use `0.0.0.0` behind reverse proxy) |
| `KOTONOHA_GATEWAY_API_KEYS` | **prod: yes** | — | Comma-separated API keys |
| `KOTONOHA_GATEWAY_RATE_LIMIT` | no | `60` | Requests/minute per key |
| `KOTONOHA_BIN` | no | `kotonoha` | CLI binary path |
| `KOTONOHA_WORKDIR` | yes (agent flow) | `cwd` | Git repository root |
| `DATABASE_URL` | yes (agent flow) | — | PostgreSQL connection string |
| `KOTONOHA_GATEWAY_API_KEY_PRINCIPALS` | M6 prod | — | `key=principal-uuid,...` |
| `KOTONOHA_GATEWAY_API_KEY_PROJECTS` | M6 prod | — | `key=project-uuid,...` |
| `KOTONOHA_GATEWAY_API_KEY_PRINCIPALS_FILE` | M6 prod | — | JSON bindings file (see [`m6-production.md`](m6-production.md)) |
| `KOTONOHA_GATEWAY_DEFAULT_PRINCIPAL_ID` | no | legacy UUID | Fallback principal |
| `KOTONOHA_GATEWAY_DEFAULT_PROJECT_ID` | no | legacy UUID | Fallback project |
| `KOTONOHA_GATEWAY_AUDIT_LOG` | no | `stderr` if keys set | `stderr` \| `stdout` \| `off` |

**Never** expose the gateway without `KOTONOHA_GATEWAY_API_KEYS` in production.

**M6 Team Mode:** see [`m6-production.md`](m6-production.md) for API key → principal mapping and audit log schema.

## TLS and reverse proxy

Terminate TLS at nginx, Caddy, or a cloud load balancer. Forward:

- `Authorization: Bearer <key>` or `X-Api-Key`
- `Content-Type: application/json` on `POST /v1/tools/{name}`

## CSP / ChatGPT remote connector

When exposing tools to ChatGPT or similar hosts:

- Allow only your gateway origin in connector settings.
- Widget URIs (`ui://kotonoha/*`) are produced by MCP clients; HTTP gateway returns the same `_meta` passthrough as `kotonoha-mcp` for compatible clients.
- Normative UX: [`04_mcp_tools_and_ux.md`](https://github.com/zyx-corporation/kotonoha-management/blob/main/docs/chatgpt-app/04_mcp_tools_and_ux.md)

## Health checks

```bash
curl -fsS https://your-host/health
```

Expect `cli_reachable: true` when the CLI is installed and on `PATH` (or `KOTONOHA_BIN` is valid).

## E2E verification

```bash
export DATABASE_URL=postgres://...
export KOTONOHA_BIN=/path/to/kotonoha
export KOTONOHA_WORKDIR=/path/to/git-repo
npm run test:e2e
```

See [`scripts/m5_gateway_e2e.ts`](../scripts/m5_gateway_e2e.ts).
