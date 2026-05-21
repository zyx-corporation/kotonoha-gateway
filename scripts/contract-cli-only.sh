#!/usr/bin/env bash
# M5-P2: Gateway must delegate only to `kotonoha` CLI (no arbitrary shell).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/src"

violations=0
while IFS= read -r -d '' file; do
  if [[ "$file" == *kotonoha.ts ]]; then
    continue
  fi
  if rg -q 'child_process|\.spawn\(|exec\(|execSync\(|spawnSync\(' "$file" 2>/dev/null; then
    echo "contract violation: subprocess API in $file (only src/kotonoha.ts may spawn)" >&2
    rg 'child_process|\.spawn\(|exec\(|execSync\(|spawnSync\(' "$file" >&2 || true
    violations=$((violations + 1))
  fi
done < <(find . -name '*.ts' -print0)

if [[ "$violations" -ne 0 ]]; then
  echo "error: $violations file(s) violate CLI-only delegation policy" >&2
  exit 1
fi

echo "ok: CLI-only delegation (src/kotonoha.ts is the sole spawn site)"
