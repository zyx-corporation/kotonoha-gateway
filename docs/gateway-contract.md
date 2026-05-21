# Gateway contract (M5-P2)

## CLI delegation only

| Rule | Detail |
| --- | --- |
| **Process spawn** | Only [`src/kotonoha.ts`](../src/kotonoha.ts) may call `child_process.spawn` |
| **Binary** | Resolved via `KOTONOHA_BIN` or `kotonoha` on `PATH` |
| **Forbidden** | Arbitrary shell, `git`, `gh`, autonomous `review` with `--agent-run-id` |

Same policy as [`kotonoha-mcp`](https://github.com/zyx-corporation/kotonoha-mcp/blob/main/docs/mcp-server-contract.md).

## HTTP surface

| Route | Auth | Purpose |
| --- | --- | --- |
| `GET /health` | none | Liveness + optional CLI probe |
| `GET /v1/tools` | if keys set | Tool catalog |
| `POST /v1/tools/{name}` | if keys set | Invoke tool (body = MCP tool args) |
| `GET /openapi.yaml` | none | OpenAPI spec |

When `KOTONOHA_GATEWAY_API_KEYS` is unset, auth is **disabled** (local dev only).

## Review checklist (PR)

- [ ] No new `spawn` / `exec` outside `kotonoha.ts`
- [ ] Tool names match `04` §3 and `kotonoha-mcp`
- [ ] Run `npm run contract:cli-only`
