#!/usr/bin/env bash
# Starts everything Ambit needs for a local run.
#   authority API  :4020
#   x402 seller    :4021   [PROJECT_OPERATED]
#   console (web)  :3000
# Ctrl+C stops all three.
set -uo pipefail
cd "$(dirname "$0")"

# §6 fail-closed config. These are DEV values. No Dynamic environment is configured here, so the
# service will correctly REFUSE to move money — that is the intended state, not a failure.
export CREDENTIAL_ENCRYPTION_KEY="${CREDENTIAL_ENCRYPTION_KEY:-$(openssl rand -base64 32)}"
export DYNAMIC_WEBHOOK_SECRET="${DYNAMIC_WEBHOOK_SECRET:-whsec-dev}"
export EXECUTION_ENABLED="${EXECUTION_ENABLED:-1}"
export NEXT_PUBLIC_AMBIT_API="${NEXT_PUBLIC_AMBIT_API:-http://127.0.0.1:4020}"

API_PID=""
WEB_PID=""
STOPPING=0

# Guarded so the trap cannot re-enter itself. `kill 0` would signal this shell too and loop.
cleanup() {
  [ "$STOPPING" = "1" ] && return
  STOPPING=1
  echo ""
  echo "stopping…"
  [ -n "$WEB_PID" ] && kill "$WEB_PID" 2>/dev/null
  [ -n "$API_PID" ] && kill "$API_PID" 2>/dev/null
  wait 2>/dev/null
}
trap cleanup INT TERM EXIT

for port in 3000 4020 4021; do
  if ss -ltn 2>/dev/null | grep -q ":$port "; then
    echo "port $port is already in use. Free it with:"
    echo "  pkill -f 'tsx src/index.ts'; pkill -f next-server"
    STOPPING=1
    exit 1
  fi
done

echo "starting authority + seller…"
pnpm --filter @ambit/authority run start &
API_PID=$!

for _ in $(seq 1 90); do
  curl -sf http://127.0.0.1:4020/health >/dev/null 2>&1 && break
  sleep 0.5
done
if ! curl -sf http://127.0.0.1:4020/health >/dev/null 2>&1; then
  echo "authority did not come up — check the output above"
  exit 1
fi
echo "  authority  http://localhost:4020"
echo "  seller     http://localhost:4021   [PROJECT_OPERATED]"

echo "starting console…"
pnpm --filter @ambit/web run dev &
WEB_PID=$!

for _ in $(seq 1 90); do
  curl -sf http://127.0.0.1:3000/ >/dev/null 2>&1 && break
  sleep 0.5
done

echo ""
echo "  ============================================="
echo "    open   http://localhost:3000"
echo "  ============================================="
echo ""
echo "  VS Code Remote-SSH: forward BOTH 3000 and 4020 in the PORTS panel."
echo "  Ctrl+C stops everything."
echo ""

wait
