---
id: INTENT-008
title: Cycle SDD comme graphe de Tasks (§3.9)
status: archived
author: Steeve Evers
date: "2026-06-09"
specs: SPEC-008-1
archivedAt: "2026-06-24T07:17:03.666Z"
archivedBy: evers.steeve@gmail.com
archivedReason: archive done
---
# INTENT-008 — Cycle SDD comme graphe de Tasks

## Pourquoi

« Ne jamais sauter d'étape » du cycle SDD est aujourd'hui une **règle textuelle** que rien n'empêche d'enfreindre. L'analyse (`docs/analyse-claude-code-best-practice.md` §2.2, §6.2) propose de la rendre **exécutoire** via les Tasks natives (graphe `blockedBy`, filesystem auditable + crash-recoverable, multi-session). Une étape bloquée par la précédente non terminée ne doit pas pouvoir démarrer ; la reprise (`/sdd resume`) doit lire un état réel, pas le deviner.

## Intention

Matérialiser `Intent → Research → SPEC → Gate → Exec → Validate → Drift-Lock` comme un **graphe de dépendances** dont les transitions sont pilotées par les **verdicts déterministes** (§3.4) : une étape n'avance que si son verdict CLI est PASS/CONDITIONAL ; FAIL/JNSP la bloquent. Le modèle ne décide pas seul de l'avancement.

## Périmètre

- **SPEC unique** — `lib/cycle-graph.js` : construction du graphe, règle de blocage (`peutDemarrer`), transitions par verdict (`appliquerVerdict`), reprise (`prochaineEtape`), rendu à marqueurs, persistance fallback fichier `.aiad/cycle/<intent>.json`. CLI `aiad-sdd cycle <init|show|step|next>`. Branchements `/sdd intent` (création), `/sdd resume` (lecture).

## Hors périmètre

- Intégration directe à l'API Tasks du harness (encapsulée : le fichier est le miroir crash-recoverable ; la projection sur `TaskCreate`/`addBlockedBy` se fait côté Claude Code). La couche d'abstraction protège d'une évolution de l'API.
- Affichage du graphe dans `/aiad status` (mention documentée ; rendu CLI fourni par `cycle show`).
