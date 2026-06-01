---
name: emit-rules
description: Régénère AGENTS.md, CLAUDE.md, .cursor/rules/, .codex/, GEMINI.md depuis AGENT-GUIDE
---

# AIAD — Multi-runtime Emit Rules (Évolution #8 — v1.12)

Tu es un Product Engineer AIAD. L'utilisateur veut **régénérer** les fichiers de règles consommés par les différents runtimes IA (Claude Code, Cursor, Codex, Copilot, Gemini) à partir d'une source unique : `.aiad/AGENT-GUIDE.md` + `.aiad/gouvernance/` + Intent actif.

## Pourquoi cette commande

AIAD se positionne en **source amont**. Au lieu de maintenir N copies divergentes de règles dans CLAUDE.md, .cursor/rules/, .codex/AGENT.md, GEMINI.md… on dérive **toutes les cibles** depuis l'AGENT-GUIDE. Une seule modification → tous les outils sont alignés. Conforme aux valeurs **Ouverture Radicale** et **Sobriété Intentionnelle**.

## Cibles produites

| Fichier | Runtime | Toujours actif |
|---------|---------|----------------|
| `AGENTS.md` | Standard inter-outils (Copilot, AGENTS.md-aware) | ✅ |
| `CLAUDE.md` (header) | Claude Code | injection en tête uniquement |
| `.cursor/rules/aiad.mdc` | Cursor — règle principale | `alwaysApply: true` |
| `.cursor/rules/aiad-rgpd.mdc` | Cursor — Tier 1 RGPD | scopé via globs (auth/users/api) |
| `.cursor/rules/aiad-rgaa.mdc` | Cursor — Tier 1 RGAA | scopé via globs (UI) |
| `.cursor/rules/aiad-ai-act.mdc` | Cursor — Tier 1 AI Act | scopé via globs (ml/ai/llm) |
| `.cursor/rules/aiad-rgesn.mdc` | Cursor — Tier 1 RGESN | global (sobriété) |
| `.codex/AGENT.md` | OpenAI Codex (optionnel) | ✅ si `--runtime codex` ou `all` |
| `GEMINI.md` | Google Gemini (optionnel) | ✅ si `--runtime gemini` ou `all` |

Chaque fichier émis contient :
- Le header `<!-- DO NOT EDIT — regenerate via /aiad-emit-rules -->`
- Un frontmatter avec `generated-by`, `source-hash` (SHA-256 des sources), et `intent_id` quand un Intent est actif

## Comment exécuter

Il s'agit d'un **wrapper léger** sur la CLI `aiad-sdd emit-rules`. Suis cette procédure :

### 1. Comprendre la demande

Inspecte `$ARGUMENTS` :
- `--runtime <list>` (claude-code|cursor|codex|copilot|gemini|all, virgule, défaut `all`)
- `--check` → mode CI : ne rien écrire, exit 1 si divergence
- vide → `npx aiad-sdd emit-rules` (régénère tout)

### 2. Vérifier les pré-requis

Avec ton outil `Read`, vérifie :
- `.aiad/AGENT-GUIDE.md` existe → sinon, propose `npx aiad-sdd init` d'abord
- `.aiad/gouvernance/` existe → sinon, prévenir que les fichiers Tier 1 Cursor seront skippés (pas bloquant)
- `.aiad/intents/_index.md` → l'Intent actif sera utilisé pour `intent_id` dans chaque frontmatter

### 3. Lancer la commande

Exécute via ton outil `Bash` :

```bash
npx aiad-sdd emit-rules $ARGUMENTS
```

Ou avec runtime ciblé :

```bash
npx aiad-sdd emit-rules --runtime cursor
npx aiad-sdd emit-rules --runtime cursor,codex
npx aiad-sdd emit-rules --check         # CI / pré-commit
```

### 4. Lire le résumé

La sortie t'indique :
- `+ N créé(s) ↑ N régénéré(s) ✓ N inchangé(s)`
- En mode `--check` : `✗ Divergence` avec liste des fichiers non synchronisés (exit 1)

### 5. Proposer la suite

Selon le résultat :
- Création initiale → suggère de **commiter** les fichiers émis (`git add AGENTS.md .cursor/rules/`)
- Régénération suite à modif AGENT-GUIDE → vérifie que la PR contient bien les fichiers émis (sinon CI échouera sur `--check`)
- Mode `--check` négatif → relance `npx aiad-sdd emit-rules` puis recommit

## Critères de succès

- ✅ AGENTS.md présent à la racine du projet
- ✅ `.cursor/rules/` peuplé avec les 5 fichiers .mdc (1 principal + 4 Tier 1)
- ✅ Frontmatters cohérents : même `source-hash` partout
- ✅ Le cycle SDD complet (Intent → Drift Lock) reste exécutable depuis Cursor / Codex / Copilot

## Règles

- **Idempotence stricte** : relancer la commande sans modif des sources doit aboutir à `0 régénéré`
- **Source amont unique** : toute modification de règle DOIT passer par `.aiad/AGENT-GUIDE.md` ou `.aiad/gouvernance/`. Modifier directement un fichier émis sera écrasé à la prochaine génération
- **CI parity** : ajoute `npx aiad-sdd emit-rules --check` dans `.github/workflows/aiad-emit-rules-check.yml` (déjà fourni) pour bloquer toute divergence en PR
- **Cohérence valeurs AIAD** : ✅ Ouverture Radicale (lire/écrire pour toute IA) ✅ Sobriété (one source, multiple emitters)

## Anti-patterns

- ❌ Éditer manuellement `AGENTS.md` ou `.cursor/rules/aiad.mdc` → modification écrasée
- ❌ Ajouter une règle uniquement dans CLAUDE.md → divergence avec les autres runtimes
- ❌ Désactiver le `--check` en CI → permet la dérive silencieuse
- ❌ Supprimer le header `DO NOT EDIT` pour « personnaliser » → casser la traçabilité

$ARGUMENTS
