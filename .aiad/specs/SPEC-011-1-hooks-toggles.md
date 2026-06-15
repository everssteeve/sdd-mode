---
id: SPEC-011-1
title: Toggles de hooks + boucles /goal + packaging plugin (§3.13 SPEC-A + SPEC-B)
parent_intent: INTENT-011
status: done
format: prose
sqs: 4.1
author: Steeve Evers
date: 2026-06-09
---

# SPEC-011-1 — Toggles de hooks + /goal + packaging plugin

**Intent parent** : INTENT-011
**SQS** : 4.1 / 5
**Statut** : in-progress

## Objectif

Activer/désactiver les hooks SDD par environnement sans toucher au code (avec protection de la gouvernance), exposer des recettes `/goal` déterministes, et packager SDD comme plugin Claude Code.

## Implémentation

- **SPEC-A** `lib/hooks-config.js` : `chargerConfig` (`hooks-config.json` + `.local.json`, local prioritaire), `hookDesactive` (fail-safe ; **veto protégé** sauf `allowDisableGovernance`), `etatHooks`. CLI `aiad-sdd hooks-config <show|check>` (check : exit 0 actif / 1 désactivé). Toggle lu inline par les hooks togglables `drift-lock.js` + `skill-usage.js`. `.aiad/hooks-config.json` (+ template, `init` recursif), `.local.json` ajouté au `.gitignore` (repo + `init`). Recettes `/goal` : `docs/goal-recipes.md`.
- **SPEC-B** : `.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json` (commandes/skills/agents/hooks SDD), doc d'installation `/plugin install` dans README.

## Critères d'acceptation

1. the system SHALL être installable comme plugin Claude Code (manifeste + marketplace listant commandes/skills/agents).
2. the system SHALL fournir des recettes `/goal` dont la condition est un verdict CLI déterministe (exit code / champ JSON).
3. WHERE `hooks-config.json` désactive un hook, the system SHALL ne pas l'exécuter (vérifié sur drift-lock : disableStopHook → exit 0 sans trace).
4. the system SHALL permettre un override local gitignored (`hooks-config.local.json`).
5. the system SHALL NOT permettre de désactiver le veto de gouvernance Tier 1 par un simple toggle (protégé, fail-closed).
6. Aucune régression : la suite complète passe (`npm test`).

## Vérification

- `test/hooks-config.test.js` (10 ✓) ; smoke hook drift-lock (toggle ON → exit 0, OFF → trace exécutée).
- Suite complète `npm test` ; lint · esm · size verts ; manifestes plugin/marketplace JSON valides.

## Hors périmètre

- Câblage du toggle dans tous les hooks P0 historiques (démontré sur drift-lock + skill-usage).
- Publication effective sur un marketplace tiers (action de release).
