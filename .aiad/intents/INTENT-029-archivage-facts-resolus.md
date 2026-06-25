---
id: INTENT-029
status: draft
---

# INTENT-029 — Archivage automatique des FACTs résolus

**Auteur** : Steeve Evers
**Date** : 2026-06-24
**Statut** : draft

---

## POURQUOI MAINTENANT

FACT-009 (2026-06-24) documente que `listerLivrables()` (`lib/archive.js:321`) ne balaie pas le dossier `facts/` et que `TYPES_ARTEFACTS` ne connaît pas le préfixe `FACT-`. INTENT-026 a livré l'archivage automatique des Intents et SPECs done, mais les FACTs ont été oubliés. `.aiad/facts/` accumule indéfiniment les FACTs résolus, polluant le contexte chaud de l'agent et l'index de traçabilité.

## POUR QUI

Product Engineer AIAD utilisant le CLI `aiad-sdd` en dogfooding quotidien — en particulier lors du cycle `/sdd fact` → résolution → `/sdd archive --all`.

## OBJECTIF

Après `aiad-sdd archive --all`, **zéro FACT avec `status: résolu` (ou `done`) ne reste dans `.aiad/facts/`** — ils sont déplacés vers `.aiad/facts/archive/` avec le même patch frontmatter que les intents/specs (`archivedAt`, `archivedBy`, `archivedReason`).

Métrique de succès : `ls .aiad/facts/*.md | xargs grep -l "résolu\|done"` → 0 résultat après la commande.

## CONTRAINTES

- Zéro dépendance npm (contrainte non négociable — `lint:deps` bloque).
- JS pur, ESM natif, pas d'étape de build.
- Patch cohérent avec `TYPES_ARTEFACTS` et `listerLivrables()` existants — pas de refactoring profond.
- `aiad-sdd trace` doit ignorer `facts/archive/` (symétrie avec `intents/archive/` et `specs/archive/`).
- Rétrocompatibilité : `aiad-sdd archive FACT-NNN` doit fonctionner (extension de `detecterSousDossier()`).

## CRITÈRE DE DRIFT

Signal observable : après `aiad-sdd archive --all` sur un projet contenant au moins un FACT `status: résolu`, la commande rapporte au moins 1 FACT archivé ET `ls .aiad/facts/*.md` ne liste plus ce FACT. Si `facts/archive/` contient le fichier avec `status: archived` dans le frontmatter → archivage conforme. Si le FACT reste dans `facts/` → drift détecté.

---

## SPECs liées

- [ ] [À créer via /sdd spec]
