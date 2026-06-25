---
id: FACT-009
title: FACTs résolus non archivés automatiquement
date: 2026-06-24
author: Steeve Evers
specs: N/A
status: ouvert
---

# FACT-009 — FACTs résolus non archivés automatiquement

**Date** : 2026-06-24
**Auteur** : Steeve Evers
**SPEC concernée** : N/A (comportement absent — aucune SPEC ne couvre l'archivage des FACTs)
**Statut** : ouvert

## Écart constaté

**Livré** : `listerLivrables()` (`lib/archive.js:321`) balaie `['intents', 'specs', 'research']`.
Le dossier `facts/` est absent de cette liste. `TYPES_ARTEFACTS` ne couvre que `intents` et `specs` —
`detecterSousDossier()` rejette tout ID `FACT-` avec une erreur.
Les FACTs avec `status: résolu` (ou `done`) restent indéfiniment dans `.aiad/facts/`.

**Désiré** : Un FACT passé en `status: résolu` (ou `done`) devrait être archivé automatiquement
vers `.aiad/facts/archive/` lors du prochain `aiad-sdd archive --all` (ou via `aiad-sdd archive FACT-NNN`),
au même titre qu'un Intent ou une SPEC clôturés.

## Impact qualifié

- **Type** : fonctionnel (UX du cycle SDD — hygiène du contexte chaud)
- **Sévérité** : mineur — pas de drift ni de bug ; mais les FACTs résolus polluent `.aiad/facts/`
  et alourdissent le contexte agent au fil des cycles

## Causes racines identifiées

1. `SOUS_DOSSIERS_LIVRABLES` (`lib/archive.js:321`) ne liste pas `facts`.
2. `TYPES_ARTEFACTS` (`lib/archive.js:46`) ne déclare pas `{ kind: 'facts', prefixes: ['FACT-'] }`.
3. `detecterSousDossier()` lève une erreur pour tout ID `FACT-`.
4. `archiver()` ne sait donc pas localiser un fichier `FACT-NNN-*.md`.

## Décision d'action

**Action choisie** : nouveau Intent Statement
**Justification** : La politique d'archivage des FACTs (statuts éligibles : `résolu` seul ou aussi `dette` ?
archivage via `--all` uniquement ou aussi via `archive FACT-NNN` explicite ? patch frontmatter identique
aux intents/specs ?) est une décision de design produit qui ne doit pas être tranchée en patch.
Un Intent permettra de spécifier le comportement complet et de valider via SQS ≥ 4/5.
**Lien SPEC** : → `/sdd intent` à créer (prochain INTENT disponible)

## Questions ouvertes (Human Authorship)

- Statuts éligibles : `résolu` uniquement, ou aussi `dette` ?
- `aiad-sdd archive FACT-NNN` doit-il fonctionner (étendre `TYPES_ARTEFACTS`), ou seulement `--all` ?
- Le patch frontmatter doit-il être identique (champs `archivedAt`, `archivedBy`, `archivedReason`) ?
- Faut-il que `aiad-sdd trace` ignore `facts/archive/` (comportement symétrique avec intents/specs) ?
