---
id: SPEC-004-1
title: Exécution phasée + mini-gates + statut visuel (§3.6 SPEC-A + SPEC-B)
parent_intent: INTENT-004
status: archived
format: prose
sqs: 4.4
author: Steeve Evers
date: "2026-06-08"
archivedAt: "2026-06-24T07:31:15.531Z"
archivedBy: evers.steeve@gmail.com
archivedReason: archive done
---
# SPEC-004-1 — Exécution phasée + mini-gates + statut visuel

**Intent parent** : INTENT-004
**SQS** : 4.4 / 5
**Statut** : in-progress

## Objectif

Découper `/sdd exec` en tranches verticales testables validées par des mini-gates répétés, avec un 3ᵉ verdict `CONDITIONAL` (dette explicitée) et un statut visuel machine-vérifiable, pour détecter la dérive tôt et rendre la reprise déterministe.

## Implémentation

- **Statut & plan** : `lib/exec-status.js` — parse `.aiad/exec/EXEC-<spec>-plan.md` (phases + champs + marqueurs `[ ] [~] [x] [!] [-]`), calcule progression et prochaine tranche (`/sdd resume`).
- **Mini-gate** : `lib/mini-gate.js` — verdict par tranche `PASS | CONDITIONAL | FAIL | JNSP` mappé sur `lib/verdict.js` ; runner de test injectable ; agrégat de plan.
- **CLI** : `aiad-sdd mini-gate <spec> --phase N` (ou `--all`) + `aiad-sdd exec-status <spec>` dans `bin/aiad-sdd.js` (flag `--phase`).
- **Schéma** : `.aiad/schema/verdicts/minigate.schema.json`.
- **Artefacts** : `templates/.aiad/exec-plan-template.md` + `.aiad/exec/_index.md` ; dossier créé par `lib/init.js`.
- **Commandes** : `templates/.claude/sdd/exec.md` (plan phasé + mini-gates), `resume.md` (reprise à la tranche `[~]`/`[!]`), skill `sqs-scoring/SKILL.md` (3ᵉ verdict).

## Critères d'acceptation

1. `aiad-sdd exec-status <spec>` reflète l'avancement via les marqueurs `[ ] [~] [x] [!] [-]` et désigne la prochaine tranche (in-progress > blocked > todo).
2. `aiad-sdd mini-gate <spec> --phase N` renvoie `PASS | CONDITIONAL | FAIL | JNSP` (exit 0/0/1/2).
3. Une tranche sans test déclaré, ou dont les tests ne sont pas livrés, ou bloquée `[!]` → `FAIL` (anti code horizontal).
4. Une tranche avec tests livrés et dette explicitée → `CONDITIONAL` portant des conditions non vides.
5. Une tranche/un plan introuvable → `JNSP` (jamais `CONDITIONAL`).
6. `--all` agrège le plan : `FAIL` prime, puis `JNSP`, puis `CONDITIONAL`, sinon `PASS` ; les tranches hors-scope `[-]` sont ignorées.
7. `init` crée `.aiad/exec/`, copie le template de plan et l'index.
8. Aucune régression : la suite complète passe (`npm test`).

## Vérification

- `test/exec-status.test.js` (11 ✓) + `test/mini-gate.test.js` (13 ✓).
- Suite complète `npm test` (3686 pass / 0 fail / 1 skip).
- `node scripts/lint.js`, `lint-esm`, `lint-size --strict` verts ; `docs --check` synchronisé.

## Hors périmètre

- Scoring dimensionnel 0-10 + evidence sur `gate`/`validate` (opt-in `--dimensions`).
- Hook `PostToolBatch` (warning tranche sans tests verts).
- Exécution réelle des tests par le mini-gate : déléguée à la CI / à un runner injectable (la présence des tests livrés est vérifiée).
