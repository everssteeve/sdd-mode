---
id: FACT-006
title: INTENT done ne déclenche pas d'archivage automatique
date: "2026-06-23"
author: Steeve Evers
status: archived
resolvedBy: SPEC-026-1
archivedAt: "2026-06-30T07:28:53.228Z"
archivedBy: evers.steeve@gmail.com
archivedReason: archive done
---
# FACT-006 — INTENT `done` ne déclenche pas d'archivage automatique

**Date** : 2026-06-23
**Auteur** : Steeve Evers
**SPEC concernée** : SPEC-026-1 (livré)
**Statut** : résolu (2026-06-23 — SPEC-026-1 implémentée)

## Écart constaté

**Livré** : Lorsqu'un Intent est basculé en `status: done` (et ses SPECs associées également),
les fichiers restent dans leurs répertoires d'origine :
- `.aiad/intents/INTENT-NNN-*.md`
- `.aiad/specs/SPEC-NNN-*-*.md`

**Désiré** : Le passage en `done` devrait (ou pourrait) déplacer automatiquement ces artefacts
vers un répertoire archive (ex. `.aiad/intents/archive/`, `.aiad/specs/archive/`), ou à minima
offrir une commande explicite pour le faire (`/sdd archive INTENT-NNN`), afin de maintenir
les répertoires actifs lisibles et rapides à parcourir.

## Impact qualifié

- **Type** : fonctionnel (UX du cycle SDD — hygiène des répertoires actifs)
- **Sévérité** : mineur — pas de bug, pas de drift ; seulement un encombrement progressif
  des répertoires `.aiad/intents/` et `.aiad/specs/` au fil des cycles

## Contexte observé

Après la clôture de INTENT-018 (5/5 SPECs → done, drift-check OK, commit `204e412`),
les 5 fichiers SPEC-018-*.md et INTENT-018-*.md restent dans les répertoires actifs.
Le `_index.md` les liste bien avec `done` mais il n'y a pas de séparation physique
entre artefacts actifs et clôturés.

## Décision d'action

**Action choisie** : nouveau Intent Statement — l'écart est fonctionnel et intentionnel à décider
**Justification** : La politique d'archivage (automatique vs manuel, répertoire vs tag)
est une décision de design produit qui dépasse un simple patch. Un Intent permettra
de trancher : auto-archive au `done`, commande explicite, ou pas d'archivage physique
(index suffisant).
**Lien SPEC** : → `/sdd intent` à créer (INTENT-026 ou suivant disponible)

## Questions ouvertes (Human Authorship)

- L'archivage physique est-il souhaitable, ou suffit-il de filtrer par statut dans `_index.md` ?
- Si archivage : automatique (hook post-commit) ou commande manuelle `/sdd archive` ?
- Les SPECs `archived` (statut actuel) suivent-elles le même cycle que `done` ?
