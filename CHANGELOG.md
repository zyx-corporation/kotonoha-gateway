# Changelog

## 0.1.1 — 2026-05-21

- M5 HTTP E2E (`npm run test:e2e`) — Pattern A + human `kotonoha_review_approve` (#137 P2-4)
- Deployment notes: [`docs/deploy.md`](docs/deploy.md)
- CI: Postgres + full gateway E2E

## 0.1.0 — 2026-05-21

- Initial scaffold (M5-P2 / #137 P2-1 + P2-2)
- `GET /health`, `GET /v1/tools`, `POST /v1/tools/{name}`
- API key auth (`KOTONOHA_GATEWAY_API_KEYS`) and per-key rate limit
- OpenAPI 3.1 at `/openapi.yaml`
- 12 tools — 1:1 with `kotonoha-mcp` 0.4.0
- `contract:cli-only` CI
