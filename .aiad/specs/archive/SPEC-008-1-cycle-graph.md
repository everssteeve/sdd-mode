---
id: SPEC-008-1
title: Cycle SDD comme graphe de Tasks (§3.9)
parent_intent: INTENT-008
status: archived
format: prose
sqs: 4.2
author: Steeve Evers
date: "2026-06-09"
archivedAt: "2026-06-24T07:31:15.545Z"
archivedBy: evers.steeve@gmail.com
archivedReason: archive done
---
# SPEC-008-1 — Cycle SDD comme graphe de Tasks

**Intent parent** : INTENT-008
**SQS** : 4.2 / 5
**Statut** : in-progress

## Objectif

Rendre exécutoire « ne jamais sauter d'étape » : un graphe `blockedBy` du cycle SDD, transitions pilotées par verdicts déterministes, persistant et crash-recoverable.

## Implémentation

- `lib/cycle-graph.js` : `construireGraphe` (7 étapes, INTENT done, chaînage `blockedBy`), `peutDemarrer` (N exige N-1 `done`), `appliquerVerdict` (PASS/CONDITIONAL → `done` ; FAIL/JNSP → `blocked` ; refuse de sauter une étape), `prochaineEtape` (resume : première actionnable, signale la `blocked`), `cycleComplet`, `rendreGraphe` (marqueurs `[x]/[~]/[ ]/[!]`), persistance `.aiad/cycle/<intent>.json` (`cheminGraphe`/`chargerGraphe`/`sauverGraphe`).
- CLI `aiad-sdd cycle <init|show|step|next> <INTENT-id> [ETAPE VERDICT]`.
- Branchements : `/sdd intent` (Étape 5 — création du graphe), `/sdd resume` (Étape 1a — lecture). Dossier `.aiad/cycle/` créé par `init`.

## Critères d'acceptation

1. WHEN un Intent démarre un cycle, the system SHALL créer un graphe reliant les 7 étapes par `blockedBy`.
2. IF l'étape N-1 n'est pas `done`, the system SHALL empêcher le démarrage de l'étape N (marquée `blocked`).
3. WHEN un verdict d'étape est PASS/CONDITIONAL, the system SHALL marquer l'étape `done` ; FAIL/JNSP SHALL la bloquer.
4. WHEN une session reprend, the system SHALL restaurer l'état depuis le graphe persistant (crash-recoverable) et signaler la prochaine étape (ou la bloquée + sa raison).
5. Aucune régression : la suite complète passe (`npm test`).

## Vérification

- `test/cycle-graph.test.js` (14 ✓).
- Suite complète `npm test` ; lint · esm · size verts.

## Hors périmètre

- Projection sur l'API Tasks native du harness (encapsulée — fichier = miroir).
- Rendu du graphe intégré dans `lib/status.js` (fourni par `cycle show`).
