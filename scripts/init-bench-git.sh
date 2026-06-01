#!/usr/bin/env bash
# init-bench-git.sh (#147)
#
# Active le Drift Lock complet sur un projet bench AIAD :
#   1. git init (branche main)
#   2. config user local minimal (pour pouvoir commit)
#   3. installe les hooks AIAD (.aiad/hooks/pre-commit.sh)
#   4. premier commit
#   5. re-régénère le dashboard pour démontrer Maturité 5/5
#
# Usage :
#   ./scripts/init-bench-git.sh [chemin/vers/bench]
#
# Défaut : bench/scenario-autonomous-run/url-shortener
#
# Idempotent : si `.git/` existe déjà, on saute init et on rejoue uniquement
# l'install des hooks + commit du delta éventuel.

set -euo pipefail

# Résolution du dossier bench
BENCH="${1:-bench/scenario-autonomous-run/url-shortener}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BIN="$REPO_ROOT/bin/aiad-sdd.js"

# Toujours résoudre relativement à la racine du repo aiad-sdd
if [[ "$BENCH" != /* ]]; then
  BENCH="$REPO_ROOT/$BENCH"
fi

if [[ ! -d "$BENCH" ]]; then
  echo "✗ Bench introuvable : $BENCH" >&2
  exit 1
fi

if [[ ! -d "$BENCH/.aiad" ]]; then
  echo "✗ Pas un projet AIAD (manque .aiad/) : $BENCH" >&2
  exit 1
fi

cd "$BENCH"
echo "→ Bench : $BENCH"

# 1. git init (idempotent)
if [[ -d .git ]]; then
  echo "✓ .git/ déjà présent — on ne réinitialise pas"
else
  git init --initial-branch=main >/dev/null 2>&1 || git init >/dev/null
  echo "✓ git init"
fi

# 1b. .gitignore minimal — exclut artefacts régénérables pour rester idempotent.
if ! [[ -f .gitignore ]]; then
  cat > .gitignore <<'GITIGNORE'
node_modules/
dashboard/
.aiad/.cache/
.aiad/metrics/traceability/
.aiad/metrics/hook-runs.jsonl
*.log
.env
GITIGNORE
  echo "✓ .gitignore créé (exclut dashboard/, node_modules/, .aiad/.cache/…)"
fi

# 2. Config user local minimal — uniquement si pas déjà défini.
# On utilise --local pour ne pas toucher la config globale de l'utilisateur.
if ! git config --local user.email >/dev/null 2>&1; then
  git config --local user.email "bench@aiad.ovh"
  git config --local user.name "AIAD Bench"
  echo "✓ git config (local) bench@aiad.ovh"
fi

# 3. Installe les hooks AIAD (idempotent — la commande hooks vérifie déjà).
if [[ -f .aiad/hooks/pre-commit.sh ]]; then
  echo "✓ Hook AIAD pre-commit déjà installé"
else
  node "$BIN" hooks >/dev/null 2>&1 || true
  echo "✓ Hook AIAD installé"
fi

# 4. Régénère le dashboard AVANT le commit pour figer aussi les artefacts
# dans le commit initial → idempotence stricte aux runs suivants.
node "$BIN" dashboard >/dev/null 2>&1

# 5. Commit initial / delta.
git add -A
if git diff --cached --quiet; then
  echo "✓ Rien à committer (working tree clean)"
else
  # Bypass le hook AIAD pour ce commit fondateur (il analyserait tous les
  # fichiers à la fois, ce qui n'est pas pertinent pour le bootstrap).
  AIAD_SKIP_DRIFT_CHECK=1 git commit -m "chore(bench): bootstrap Drift Lock complet via init-bench-git.sh" >/dev/null
  echo "✓ Commit initial créé"
fi

# 6. Lit la nouvelle maturité.
SCORE=$(node -e "
const d = require('$BENCH/dashboard/data.json');
console.log(d.maturite.score + '/' + d.maturite.total + ' · ' + d.maturite.label);
")
echo "→ Maturité après bootstrap : $SCORE"
