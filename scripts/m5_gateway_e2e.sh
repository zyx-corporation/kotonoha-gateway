#!/usr/bin/env bash
# M5-P2-4: HTTP gateway E2E (Pattern A + human review approve).
# Usage:
#   export DATABASE_URL=postgres://...
#   export KOTONOHA_BIN=../kotonoha-cli/target/release/kotonoha
#   export KOTONOHA_WORKDIR=../kotonoha-cli
#   ./scripts/m5_gateway_e2e.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "error: DATABASE_URL is required" >&2
  exit 1
fi

npm run build
node --import tsx/esm scripts/m5_gateway_e2e.ts
