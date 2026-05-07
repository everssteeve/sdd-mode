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
