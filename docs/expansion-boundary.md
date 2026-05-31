# kotonoha-gateway Expansion Boundary

## Status

**Informative — implementation mirror.** Canonical boundary document:

→ **[`kotonoha-spec` `docs/mcp-gateway-expansion-boundary.md`](https://github.com/zyx-corporation/kotonoha-spec/blob/main/docs/mcp-gateway-expansion-boundary.md)**

If this summary disagrees with that document or normative `kotonoha-spec` text, **spec wins**.

## Tier

**Expansion integration layer** — HTTP bridge for external clients; **not** semantic authority.

| Primary | Repository |
| --- | --- |
| Normative source | `kotonoha-spec` |
| First stable runtime | `kotonoha-cli` |
| First usable UI | `obsidian-kotonoha-console` |
| This repo | `POST /v1/tools/{name}` — same tool names as MCP |

Default listen: **8787** (distinct from orchestrator / web-console ports).

## Quick reference

### MAY

- Proxy stable adapter calls (when documented)
- Authenticated tool endpoints, rate limits, audit log
- Request validation; principal/project identity on CLI child env
- Mediate CLI / core / orchestrator **stable** surfaces

### MUST NOT

- Normative schema source or RDE category redefinition
- Own project identity semantics
- Silent storage / Git mutation
- Collapse experimental + stable orchestrator APIs
- External clients as primary review authority
- Bypass human review
- Expose `/v1/proposals/generate` as stable without experimental label

## Expansion prerequisites

Same as MCP — see canonical doc. New HTTP routes or tools require stable upstream contract and expansion checklist.

## Related

| Document | Role |
| --- | --- |
| [mcp-gateway-expansion-boundary.md (spec)](https://github.com/zyx-corporation/kotonoha-spec/blob/main/docs/mcp-gateway-expansion-boundary.md) | Canonical boundary |
| [gateway-contract.md](gateway-contract.md) | HTTP auth, tool invoke |
| [kotonoha-mcp README](https://github.com/zyx-corporation/kotonoha-mcp#mcp-tools) | Shared tool catalog |
| [README.md](../README.md) | Quickstart |

Governance: [kotonoha-management #166](https://github.com/zyx-corporation/kotonoha-management/issues/166)
