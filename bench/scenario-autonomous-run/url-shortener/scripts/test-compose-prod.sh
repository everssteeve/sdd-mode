#!/usr/bin/env bash
# test-compose-prod.sh — E2E du docker-compose.prod.yml du bench tinr.ly
# (#180) script qui build l'image prod, lance les containers, attend /healthz,
# puis vérifie /healthz?deep=true et démonte tout proprement.
# (#186) Le compose dev est arrêté autour du test pour libérer les noms de
# containers, puis redémarré si DEV_WAS_UP.
set -euo pipefail

HEALTH_URL="${HEALTH_URL:-http://localhost:3091/healthz}"
BUILD_FLAG="--build"
PROJECT="tinrly-test-prod"
DEV_PROJECT="tinrly-dev"

DEV_WAS_UP=0

for arg in "$@"; do
  case "$arg" in
    --no-build) BUILD_FLAG="" ;;
    *) echo "Usage : $0 [--no-build]" >&2 ; exit 64 ;;
  esac
done

cleanup() {
  echo "  → Tear down du projet $PROJECT"
  docker compose -p tinrly-test-prod -f docker-compose.yml -f docker-compose.prod.yml down -v --remove-orphans >/dev/null 2>&1 || true
  if (( DEV_WAS_UP == 1 )); then
    echo "  → Restore du compose dev ($DEV_PROJECT)"
    docker compose -p "$DEV_PROJECT" -f docker-compose.yml up -d >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

# (#186) Détection : si le compose dev est up, on le descend pour éviter conflit
if docker compose -p "$DEV_PROJECT" -f docker-compose.yml ps -q 2>/dev/null | grep -q .; then
  DEV_WAS_UP=1
  echo "  → Down temporaire du compose dev (containers se chevauchent)"
  docker compose -p "$DEV_PROJECT" -f docker-compose.yml down >/dev/null 2>&1 || true
fi

echo "  → Build + up $PROJECT (flag : ${BUILD_FLAG:-aucun})"
docker compose -p tinrly-test-prod -f docker-compose.yml -f docker-compose.prod.yml up -d ${BUILD_FLAG}

# Attente santé shallow
echo "  → Attente $HEALTH_URL"
ok=0
for i in $(seq 1 40); do
  if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then ok=1 ; break ; fi
  sleep 0.5
done
(( ok == 1 )) || { echo "  ✗ timeout santé shallow" >&2 ; exit 1 ; }

# Santé deep (DB writable)
echo "  → Vérif /healthz?deep=true (MODE deep + WRITABLE)"
DEEP="$(curl -sf "${HEALTH_URL}?deep=true" || true)"
echo "$DEEP" | grep -qiE 'mode.*deep' || { echo "  ✗ deep MODE absent dans payload" >&2 ; exit 1 ; }
echo "$DEEP" | grep -qiE 'writable' || { echo "  ✗ WRITABLE absent dans payload deep" >&2 ; exit 1 ; }

echo "  ✓ Test E2E compose prod réussi"
