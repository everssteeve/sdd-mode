---
id: INTENT-026
title: Archivage automatique des artefacts done (Intents + SPECs)
status: archived
author: Steeve Evers
date: "2026-06-23"
archivedAt: "2026-06-24T07:17:03.711Z"
archivedBy: evers.steeve@gmail.com
archivedReason: archive done
---
# INTENT-026 — Archivage automatique des artefacts done

## POURQUOI MAINTENANT

Après la clôture de INTENT-018 (5 SPECs, cycle complet le 2026-06-23), les répertoires
`.aiad/intents/` et `.aiad/specs/` continuent d'accumuler des artefacts au statut `done`.
FACT-006 documente l'écart : aucun mécanisme ne déplace ou ne sépare ces artefacts des
éléments actifs. À mesure que le projet avance (26 INTENTs, 49 SPECs), la lisibilité des
répertoires actifs se dégrade et le signal/bruit (actif vs clôturé) augmente.

## POUR QUI

Le Product Engineer qui travaille quotidiennement avec le cycle SDD — il doit pouvoir
identifier en un coup d'œil les artefacts qui nécessitent encore de l'attention (draft,
active, in-progress, validation) sans se noyer dans les artefacts déjà livrés.

## OBJECTIF

- Après passage d'un INTENT à `done`, ses fichiers et ceux de ses SPECs associées
  sont physiquement séparés des artefacts actifs (ex. déplacés dans un répertoire
  `archive/` ou via une commande dédiée).
- Les répertoires `.aiad/intents/` et `.aiad/specs/` actifs ne contiennent plus que
  les artefacts non terminés (draft, active, in-progress, validation, ready).
- Métrique : 0 fichier `status: done` dans les répertoires actifs après exécution
  de la commande d'archivage.

## CONTRAINTES

- **Zéro dépendance** : toute mécanique d'archivage doit rester en vanilla Node.js ESM,
  sans npm runtime deps.
- **Rétrocompatibilité des annotations** : les annotations `@spec SPEC-NNN-*` dans le
  code source pointent vers des IDs, pas des chemins — l'archivage ne casse pas les
  résolutions de `npx aiad-sdd trace`.
- **Dashboard et trace non cassés** : `collect.js` doit être capable de lire les artefacts
  depuis les répertoires archive.
- **Pas d'archivage automatique silencieux** : l'humain doit valider (commande explicite
  ou confirmation interactive) — on n'archive pas derrière le dos du PE.
- **Répertoire `archive/` déjà partiellement existant** dans `.aiad/intents/archive/`
  (présent à l'état vide ou quasi-vide) — s'y conformer.

## CRITÈRE DE DRIFT

Un Intent passe à `done`, le drift-check valide, mais ses fichiers artefacts restent
dans les répertoires actifs sans que la commande d'archivage ait été proposée ou
exécutée → drift de l'intention (encombrement silencieux des répertoires).

Signal observable : `find .aiad/intents .aiad/specs -maxdepth 1 -name "*.md" | xargs grep -l "^status: done"` retourne des fichiers après la séquence drift-check + archivage.

## SPECs liées

- [x] SPEC-026-1 — Commande `archive done` (validation)

## Lien FACT

- FACT-006 — INTENT done ne déclenche pas d'archivage automatique (2026-06-23)
