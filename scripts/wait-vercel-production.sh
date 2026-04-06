#!/usr/bin/env bash
# Block until the deployment behind the production alias is Ready (or timeout).
# Run from repo root after git push or deploy. Requires: vercel link + vercel login.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
TARGET="${VERCEL_INSPECT_URL:-https://www.teamruby.net}"
TIMEOUT="${VERCEL_INSPECT_TIMEOUT:-15m}"
exec vercel inspect "$TARGET" --wait --timeout "$TIMEOUT"
