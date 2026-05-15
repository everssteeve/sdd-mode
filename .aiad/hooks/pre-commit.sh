#!/usr/bin/env bash
# AIAD SDD Mode — pre-commit hook (Drift Lock check)
#
# Vérifie qu'aucun commit ne modifie du code sans mise à jour SPEC.
# Le Drift Lock est non-négociable : code + SPEC dans la même PR.
#
# Configuration : .aiad/config.yml
#   hooks:
#     pre_commit: block   # block | warn | off
#
# Whitelist : .aiad/hook-bypass.yml (un pattern par ligne, préfixé par "- ").
#   - pattern sans "/"  → match sur le basename       (ex. "*.md")
#   - pattern avec "/"  → match sur le chemin complet (ex. "docs/**/*.md")
#
# Bypass d'urgence (déconseillé) :
#   - git commit --no-verify
#   - export AIAD_SKIP_DRIFT_CHECK=1
#
# Cohérence valeurs AIAD :
#   • Empirisme sans Concession — l'écart code/SPEC est mesuré, pas supposé
#   • Drift = Échec de Processus — la détection est mécanique, pas humaine
#
# Documentation : https://aiad.ovh

set -uo pipefail

# ─── Bypass complet via env var ─────────────────────────────────────────
if [ "${AIAD_SKIP_DRIFT_CHECK:-0}" = "1" ]; then
  exit 0
fi

# ─── Sandbox — réseau désactivé (best-effort) ───────────────────────────
# Le hook n'a aucun besoin de sortir : on neutralise les proxies.
export HTTP_PROXY=""
export HTTPS_PROXY=""
export http_proxy=""
export https_proxy=""
export NO_PROXY="*"
export no_proxy="*"

# ─── Sandbox — timeout strict (best-effort, optionnel) ──────────────────
# Plafond : 120s. Défaut : 30s. Configurable via AIAD_HOOK_TIMEOUT.
HOOK_TIMEOUT="${AIAD_HOOK_TIMEOUT:-30}"
case "$HOOK_TIMEOUT" in
  ''|*[!0-9]*) HOOK_TIMEOUT=30 ;;
esac
if [ "$HOOK_TIMEOUT" -gt 120 ]; then HOOK_TIMEOUT=120; fi

# Si timeout(1) ou gtimeout(1) dispo, on s'auto-emballe pour borner la durée.
# Sinon (macOS sans coreutils), on continue sans timeout — les métriques
# sont quand même loguées via le trap EXIT plus bas.
TIMEOUT_BIN=""
if command -v timeout >/dev/null 2>&1; then TIMEOUT_BIN="timeout"; fi
if [ -z "$TIMEOUT_BIN" ] && command -v gtimeout >/dev/null 2>&1; then TIMEOUT_BIN="gtimeout"; fi

if [ "${AIAD_HOOK_INNER:-0}" != "1" ] && [ -n "$TIMEOUT_BIN" ]; then
  AIAD_HOOK_INNER=1 "$TIMEOUT_BIN" --preserve-status "${HOOK_TIMEOUT}s" "$0" "$@"
  HOOK_EXIT=$?
  if [ "$HOOK_EXIT" = "124" ]; then
    echo "" >&2
    echo "  ⏱  AIAD SDD — Hook pre-commit dépassé (>${HOOK_TIMEOUT}s)" >&2
    echo "      Augmente le seuil : export AIAD_HOOK_TIMEOUT=60 (max 120)" >&2
    echo "" >&2
  fi
  exit "$HOOK_EXIT"
fi

# ─── Sandbox — métriques JSONL append-only via trap EXIT ────────────────
# Garantit qu'à chaque exécution (succès, échec, kill propre), la durée
# et le code de sortie sont enregistrés dans .aiad/metrics/hook-runs.jsonl.
HOOK_START_NS=$(date +%s)
HOOK_STARTED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "")
HOOK_HOSTNAME=$(hostname 2>/dev/null || echo "")
_aiad_log_metrics() {
  local code=$?
  local repo end dur dir files
  repo=$(git rev-parse --show-toplevel 2>/dev/null) || return 0
  [ -d "$repo/.aiad" ] || return 0
  end=$(date +%s)
  dur=$(( (end - HOOK_START_NS) * 1000 ))
  dir="$repo/.aiad/metrics"
  mkdir -p "$dir" 2>/dev/null || true
  files=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null | grep -c . || echo 0)
  printf '{"startedAt":"%s","durationMs":%d,"exitCode":%d,"timedOut":false,"scopeLeaks":[],"filesChanged":%d,"hostname":"%s"}\n' \
    "$HOOK_STARTED_AT" "$dur" "$code" "$files" "$HOOK_HOSTNAME" \
    >> "$dir/hook-runs.jsonl" 2>/dev/null || true
}
trap _aiad_log_metrics EXIT

# ─── Racine du repo ─────────────────────────────────────────────────────
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$REPO_ROOT" || exit 0

# Si .aiad/ n'existe pas → pas de SDD Mode actif → on ne bloque rien.
if [ ! -d ".aiad" ]; then
  exit 0
fi

# ─── Lecture config (mode = block par défaut) ───────────────────────────
MODE="block"
if [ -f ".aiad/config.yml" ]; then
  RAW=$(grep -E '^[[:space:]]*pre_commit[[:space:]]*:' .aiad/config.yml 2>/dev/null | head -n1)
  if [ -n "${RAW:-}" ]; then
    PARSED=$(printf '%s' "$RAW" \
      | sed -E 's/^[[:space:]]*pre_commit[[:space:]]*:[[:space:]]*//; s/[[:space:]]*#.*$//; s/["'\'']//g' \
      | tr '[:upper:]' '[:lower:]' \
      | tr -d '[:space:]')
    case "$PARSED" in
      warn|block|off) MODE="$PARSED" ;;
    esac
  fi
fi

if [ "$MODE" = "off" ]; then
  exit 0
fi

# ─── Scan PII pré-commit (item #109) ────────────────────────────────────
# Détecte IBAN, NIR, cartes, tokens API, emails, téléphones dans les
# Intents/SPECs stagés. Mode lu depuis .aiad/config.yml (pii_scan:) ou
# env AIAD_PII_MODE. Si block, exit 1 directement.
PII_MODE="${AIAD_PII_MODE:-}"
if [ -z "$PII_MODE" ] && [ -f ".aiad/config.yml" ]; then
  PII_RAW=$(grep -E '^[[:space:]]*pii_scan[[:space:]]*:' .aiad/config.yml 2>/dev/null | head -n1)
  if [ -n "${PII_RAW:-}" ]; then
    PII_MODE=$(printf '%s' "$PII_RAW" \
      | sed -E 's/^[[:space:]]*pii_scan[[:space:]]*:[[:space:]]*//; s/[[:space:]]*#.*$//; s/["'\'']//g' \
      | tr '[:upper:]' '[:lower:]' \
      | tr -d '[:space:]')
  fi
fi
PII_MODE="${PII_MODE:-block}"
if [ "$PII_MODE" != "off" ] && command -v node >/dev/null 2>&1; then
  AIAD_BIN="${AIAD_BIN:-}"
  if [ -z "$AIAD_BIN" ]; then
    AIAD_BIN="$(command -v aiad-sdd 2>/dev/null || true)"
  fi
  if [ -n "$AIAD_BIN" ] && [ -x "$AIAD_BIN" ]; then
    AIAD_PII_MODE="$PII_MODE" "$AIAD_BIN" pii-scan --staged
    PII_EXIT=$?
    if [ "$PII_MODE" = "block" ] && [ "$PII_EXIT" != "0" ]; then
      exit "$PII_EXIT"
    fi
  fi
fi

# ─── Lecture whitelist (.aiad/hook-bypass.yml) ──────────────────────────
BYPASS_PATTERNS=()
if [ -f ".aiad/hook-bypass.yml" ]; then
  while IFS= read -r line; do
    trimmed=$(printf '%s' "$line" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')
    case "$trimmed" in
      \#*|'') continue ;;
      -|-\ *)
        pattern=$(printf '%s' "$trimmed" \
          | sed -E 's/^-[[:space:]]*//; s/[[:space:]]*#.*$//; s/^["'\'']//; s/["'\'']$//')
        if [ -n "$pattern" ]; then
          BYPASS_PATTERNS+=("$pattern")
        fi
        ;;
    esac
  done < ".aiad/hook-bypass.yml"
fi

# Match style gitignore : pattern sans "/" → basename, sinon → chemin complet.
is_bypassed() {
  local file="$1"
  local base="${file##*/}"
  local p
  if [ "${#BYPASS_PATTERNS[@]}" -eq 0 ]; then
    return 1
  fi
  for p in "${BYPASS_PATTERNS[@]}"; do
    case "$p" in
      */*)
        # shellcheck disable=SC2254
        case "$file" in
          $p) return 0 ;;
        esac
        ;;
      *)
        # shellcheck disable=SC2254
        case "$base" in
          $p) return 0 ;;
        esac
        ;;
    esac
  done
  return 1
}

# ─── Inventaire des fichiers stagés ─────────────────────────────────────
CHANGED=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null || true)
if [ -z "$CHANGED" ]; then
  exit 0
fi

CODE_CHANGED=()
SPECS_CHANGED=0

while IFS= read -r f; do
  [ -z "$f" ] && continue

  # Classification AIAD-first : SPECs et autres artefacts ne sont jamais
  # whitelistés (sinon une whitelist trop large casserait la détection).
  case "$f" in
    .aiad/specs/*)
      SPECS_CHANGED=$((SPECS_CHANGED + 1))
      continue
      ;;
    .aiad/*)
      # Intents, gouvernance, metrics, facts, hooks : neutres.
      continue
      ;;
  esac

  # Code applicatif : on applique la whitelist.
  if is_bypassed "$f"; then
    continue
  fi
  CODE_CHANGED+=("$f")
done <<EOF
$CHANGED
EOF

# Pas de code modifié → rien à vérifier.
if [ "${#CODE_CHANGED[@]}" -eq 0 ]; then
  exit 0
fi

# ─── Garde-fou JNSP — scan TODO-JNSP non résolus ─────────────────────────
# Un TODO-JNSP signale une question agent → humain non encore tranchée.
# Tant qu'il subsiste, le commit doit attendre la décision humaine, même
# si une SPEC est mise à jour en parallèle. Le check précède donc le
# Drift Lock pour bloquer plus tôt.
JNSP_HITS=$(git grep --cached -nE 'TODO-JNSP:' -- "${CODE_CHANGED[@]}" 2>/dev/null || true)
if [ -n "$JNSP_HITS" ]; then
  echo ""
  echo "  ⚠️  AIAD SDD Mode — Garde-fou JNSP (Je Ne Sais Pas)"
  echo ""
  echo "  Marqueurs TODO-JNSP non résolus dans le code stagé :"
  echo "$JNSP_HITS" | sed 's/^/      /'
  echo ""
  echo "  Un TODO-JNSP signale une question de l'agent vers l'humain"
  echo "  non encore tranchée. Le commit doit attendre la décision."
  echo ""
  if [ "$MODE" = "warn" ]; then
    echo "  Mode : warn — commit autorisé malgré les JNSP."
    echo ""
  else
    echo "  Mode : block — commit refusé."
    echo "      Bypass ponctuel : git commit --no-verify (déconseillé)"
    echo "      Tranche la question, remplace TODO-JNSP: par la décision."
    echo ""
    exit 1
  fi
fi

# Code + SPEC dans le même commit → Drift Lock respecté.
if [ "$SPECS_CHANGED" -gt 0 ]; then
  exit 0
fi

# ─── Drift potentiel : code modifié sans SPEC mise à jour ───────────────
echo ""
echo "  ⚠️  AIAD SDD Mode — Drift Lock"
echo ""
echo "  Code modifié sans mise à jour SPEC :"
for f in "${CODE_CHANGED[@]}"; do
  echo "      • $f"
done
echo ""
echo "  Le Drift Lock exige que code + SPEC soient synchronisés dans la même PR."
echo ""
echo "  Actions possibles :"
echo "      1. Lance /sdd drift-check dans Claude Code"
echo "      2. Mets à jour la SPEC concernée dans .aiad/specs/"
echo "      3. Whiteliste ce chemin dans .aiad/hook-bypass.yml si justifié"
echo ""

if [ "$MODE" = "warn" ]; then
  echo "  Mode : warn — commit autorisé."
  echo ""
  exit 0
fi

echo "  Mode : block — commit refusé."
echo "      Bypass ponctuel : git commit --no-verify (déconseillé)"
echo "      Désactivation   : .aiad/config.yml → pre_commit: warn (ou off)"
echo ""
exit 1
