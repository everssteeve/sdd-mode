---
id: INTENT-016
title: Dashboard exemplaire — fondations accessibles, sobres, maintenables
status: active
author: Steeve Evers
date: 2026-06-11
specs:
---

# INTENT-016 — Dashboard exemplaire (fondations)

> ⚠ Draft issu de l'analyse du 2026-06-11. POURQUOI à approprier par un humain
> avant passage en `active` (Human Authorship).

## Pourquoi maintenant

Le dashboard ne satisfait pas le RGAA qu'il impose au code des utilisateurs
(#132 : 1 seul attribut ARIA, pas de `<label>`, pas d'alt sur les sparklines).
Et `render.js` (1 003 LOC) / `assets.js` (878 LOC) monolithiques rendent tout
refactor « recentrage valeur » impraticable. Ces fondations sont le prérequis
bloquant des INTENT-017 et INTENT-018.

## Pour qui

Les équipes qui pilotent au quotidien, et nous-mêmes (dogfooding RGAA + RGESN).

## Objectif

- Architecture en 4 couches : `collect/` · `model/` · `views/` · `ui/`.
- Design system **RGAA AA** vérifié par axe-core en CI (0 violation bloquante).
- `data.json` **v2 versionné** (schéma publié, documenté comme API).
- Budget de poids **RGESN** par page généré, vérifié en CI.

## Contraintes

- Rester **statique-généré** (pas de backend — c'est un avantage compétitif).
- Aucune régression de contenu pendant le refactor.

## Critère de drift

Une page générée échouant l'audit axe-core AA, ou un dépassement de budget de
poids non justifié → drift.

## SPECs liées

- [ ] SPEC-016-1 — Architecture 4 couches (collect/model/views/ui) · draft
- [ ] SPEC-016-2 — Design system accessible + axe-core en CI · draft (EARS)
- [ ] SPEC-016-3 — `data.json` v2 versionné (schéma publié) · draft
- [ ] SPEC-016-4 — Budgets de poids RGESN par page · draft (EARS)
