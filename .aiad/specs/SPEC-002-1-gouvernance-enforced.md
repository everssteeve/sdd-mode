---
id: SPEC-002-1
title: Socle P0 — gouvernance enforced (verdicts, hooks JNSP/Drift/Veto, subagents Tier 1)
parent_intent: INTENT-002
status: in-progress
format: prose
sqs: 4.4
author: Steeve Evers
date: 2026-06-08
governance: AIAD-RGPD, AIAD-AI-ACT, AIAD-RGAA, AIAD-RGESN
---

# SPEC-002-1 — Socle P0 : gouvernance enforced

**Intent parent** : INTENT-002
**SQS** : 4.4 / 5
**Statut** : in-progress
**Gouvernance** : Tier 1 (le subagent et le veto opèrent sur les 4 référentiels)

## Objectif

Implémenter le socle P0 « advisory → enforced » : un contrat de verdict déterministe, trois hooks harness (JNSP, Drift Lock, Veto) et les subagents de gouvernance Tier 1, de sorte que les règles critiques deviennent mécaniquement non contournables.

## Implémentation

- **Contrat de verdict** : `lib/verdict.js` (PASS/FAIL/JNSP → exit 0/1/2 ; validateur JSON Schema zéro-dep) + schémas `.aiad/schema/verdicts/*.schema.json`.
- **Drift Lock** : `lib/drift-verdict.js` + hook `Stop` `.aiad/hooks/drift-lock.js`.
- **JNSP** : `lib/jnsp.js` + hook `PreToolUse` `.aiad/hooks/jnsp-scan.js`.
- **Veto Tier 1** : `lib/veto.js` + commande CLI `veto` (`bin/aiad-sdd.js`) + hook `PreToolUse` `.aiad/hooks/veto.js`.
- **Subagents Tier 1** : génération `.claude/agents/AIAD-*.md` par `lib/emit-rules.js`.
- **Settings émis** : `templates/.claude/settings.json` (SessionStart + PreToolUse + Stop) ; `templates/managed-settings.json` (org).

## Critères d'acceptation

1. `aiad-sdd <cmd> --output-format verdict` émet une enveloppe JSON avec `verdict ∈ {PASS, CONDITIONAL, FAIL, JNSP}` et un `exitCode ∈ {0,1,2}` cohérent (PASS/CONDITIONAL=0, FAIL=1, JNSP=2).
2. Un payload de verdict non conforme à son schéma est dégradé en `FAIL` (exit 1) **avant** publication — jamais de sortie machine invalide.
3. `UNKNOWN` (sortie EN de gouvernance) est traité comme `JNSP` (fail-closed).
4. `aiad-sdd trace --output-format verdict` renvoie `JNSP` (exit 2) si du code applicatif existe sans aucune annotation `@spec`, `FAIL` (exit 1) sur gap bloquant, `PASS` (exit 0) sinon — sans modifier la sortie `--json` historique (matrice).
5. Le hook `PreToolUse` JNSP refuse (`permissionDecision: deny`, exit 2) un `git commit` dont le code stagé contient un `TODO-JNSP` non résolu ; la documentation Markdown est exclue.
6. Le hook `Stop` Drift Lock refuse la clôture (`decision: block`, exit 2) sur verdict de traçabilité non-PASS, en listant les gaps.
7. `emit-rules` (runtime claude-code) génère 4 subagents `.claude/agents/AIAD-*.md` **read-only** (`tools: Read, Grep, Glob` + `disallowedTools` d'écriture), `PROACTIVELY`, `memory: project`, scopés par `paths:`, fail-closed (`UNKNOWN = VETO`) ; `emit-rules --check` détecte toute divergence.
8. `aiad-sdd veto --output-format verdict` renvoie `JNSP` (exit 2) si un fichier de code touche une zone Tier 1 à glob étroit (RGPD/RGAA/AI-ACT) sans annotation `@governance` de l'agent concerné ; `PASS` (exit 0) sinon. RGESN (`**/*`) est advisory, exclu du gate.
9. Les fichiers de test ne portent pas le veto.
10. `pre-commit.sh` reste fonctionnel et inchangé (défense en profondeur, hors-harness).
11. `init` copie les nouveaux hooks et settings dans un projet cible.
12. Aucune régression : la suite complète passe (`npm test`).

## Vérification

- `test/verdict.test.js`, `test/drift-verdict.test.js`, `test/jnsp.test.js`, `test/emit-rules-agents.test.js`, `test/veto.test.js`.
- Suite complète `npm test` (3632 pass / 0 fail).
- `node scripts/lint.js`, `lint-esm`, `lint-size --strict` verts.

## Hors périmètre

- Hook `PreToolUse` de type `agent` (orchestration multi-tour du subagent) — le veto déterministe CLI + le subagent read-only couvrent le besoin P0 ; l'agent-hook est une amélioration ultérieure.
- Câblage du contrat de verdict dans les slash-commands `gate`/`validate`/`security` (corps de skills) — itération suivante.
