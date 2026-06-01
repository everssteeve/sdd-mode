#!/usr/bin/env bash
# start-bench.sh — bootstrap dev du bench tinr.ly (url-shortener)
# Modes : start (défaut, daemonisé) · stop · --fg (foreground)
set -euo pipefail

PORT="${PORT:-3091}"
PID_FILE="${PID_FILE:-/tmp/.tinrly.pid}"
HEALTH_URL="http://localhost:${PORT}/healthz"

stop_existing() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 0.3
    fi
    rm -f "$PID_FILE"
  fi
  # Fallback : libère le port s'il est encore occupé.
  if command -v lsof >/dev/null 2>&1; then
    local stragglers
    stragglers="$(lsof -tiTCP:${PORT} -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$stragglers" ]]; then
      echo "  ⚠ ports résiduels sur :$PORT → kill $stragglers"
      echo "$stragglers" | xargs -r kill -9 2>/dev/null || true
    fi
  fi
}

wait_for_health() {
  local i=0
  while (( i < 60 )); do
    if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
    i=$((i + 1))
  done
  echo "  ✗ timeout : $HEALTH_URL n'a jamais répondu" >&2
  return 1
}

case "${1:-start}" in
  start)
    stop_existing
    nohup npx tsx --watch src/server.ts > /tmp/tinrly.log 2>&1 &
    echo $! > "$PID_FILE"
    wait_for_health && echo "  ✓ bench up sur :$PORT (pid $(cat "$PID_FILE"))"
    ;;
  stop)
    stop_existing
    echo "  ✓ bench arrêté"
    ;;
  --fg|fg)
    stop_existing
    exec npx tsx --watch src/server.ts
    ;;
  *)
    echo "Usage : $0 [start|stop|--fg]" >&2
    exit 64
    ;;
esac
