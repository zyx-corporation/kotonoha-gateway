# M6 production — API key → principal mapping & audit log

**Track:** [#138](https://github.com/zyx-corporation/kotonoha-management/issues/138) M6-d · Spec: [`36_m6_team_mode_spec_draft.md`](https://github.com/zyx-corporation/kotonoha-management/blob/main/docs/36_m6_team_mode_spec_draft.md)

## 1. Principal per API key

Each ChatGPT connector / automation client should map to a **`service`** or **`agent_channel`** principal in PostgreSQL (`principals` table). The gateway passes `KOTONOHA_PRINCIPAL_ID` and `KOTONOHA_PROJECT_ID` to the child `kotonoha` CLI on every DB-backed tool call.

### Option A — environment (small deployments)

```bash
export KOTONOHA_GATEWAY_API_KEYS="chatgpt-prod,ci-bot"
export KOTONOHA_GATEWAY_API_KEY_PRINCIPALS="chatgpt-prod=550e8400-e29b-41d4-a716-446655440000,ci-bot=660e8400-e29b-41d4-a716-446655440001"
export KOTONOHA_GATEWAY_API_KEY_PROJECTS="chatgpt-prod=770e8400-e29b-41d4-a716-446655440002"
export KOTONOHA_GATEWAY_DEFAULT_PRINCIPAL_ID="00000000-0000-4000-8000-000000000001"  # legacy fallback
export KOTONOHA_GATEWAY_DEFAULT_PROJECT_ID="00000000-0000-4000-8000-000000000002"
```

### Option B — JSON file (recommended for production)

```bash
export KOTONOHA_GATEWAY_API_KEY_PRINCIPALS_FILE=/etc/kotonoha/gateway-principals.json
```

Example [`examples/gateway-principals.json`](../examples/gateway-principals.json):

```json
{
  "version": "kotonoha.gateway_principals.v0.1",
  "bindings": [
    {
      "api_key": "chatgpt-prod",
      "principal_id": "550e8400-e29b-41d4-a716-446655440000",
      "project_id": "770e8400-e29b-41d4-a716-446655440002"
    }
  ]
}
```

File bindings **override** env entries for the same `api_key`. Restrict file permissions (`chmod 600`).

**DB setup:** ensure each `principal_id` exists in `principals` and has `project_members.role` ≥ `agent_runner` for agent/delta tools, and `reviewer` for human review tools.

## 2. Structured audit log

When `KOTONOHA_GATEWAY_API_KEYS` is set, audit logging defaults to **stderr** (one JSON line per request).

| Variable | Default | Values |
| --- | --- | --- |
| `KOTONOHA_GATEWAY_AUDIT_LOG` | `stderr` if keys set, else `off` | `stderr` \| `stdout` \| `off` |

Schema: **`kotonoha.gateway_audit.v0.1`**

```json
{
  "schema": "kotonoha.gateway_audit.v0.1",
  "ts": "2026-05-21T12:00:00.000Z",
  "event": "tool_invoke",
  "method": "POST",
  "path": "/v1/tools/kotonoha_agent_record_start",
  "tool": "kotonoha_agent_record_start",
  "principal_id": "550e8400-e29b-41d4-a716-446655440000",
  "project_id": "770e8400-e29b-41d4-a716-446655440002",
  "api_key_fp": "a1b2c3d4e5f6",
  "ok": true,
  "http_status": 200,
  "duration_ms": 142,
  "remote_addr": "203.0.113.10"
}
```

- **`api_key_fp`:** first 12 hex chars of SHA-256(api_key) — **never** log the raw key.
- **`event`:** `tool_invoke` \| `tool_error` \| `auth_denied` \| `rate_limited`

Ship stderr to your log stack (CloudWatch, Datadog, Loki). Correlate with `agent_runs` / `review_decisions` via `principal_id` and timestamps.

## 3. Checklist

- [ ] `KOTONOHA_GATEWAY_API_KEYS` set (auth required)
- [ ] Every key mapped to a DB `principal_id` with correct `project_members` role
- [ ] Audit log collected and retained per org policy
- [ ] `npm run test:e2e` passes against staging DB
