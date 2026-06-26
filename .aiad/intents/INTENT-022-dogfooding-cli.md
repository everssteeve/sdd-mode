---
id: INTENT-022
title: Dogfooding complet — le CLI sous SPEC
status: draft
author: Steeve Evers
date: 2026-06-11
specs:
---

# INTENT-022 — Dogfooding complet (le CLI sous SPEC)

> ⚠ Draft issu de l'analyse du 2026-06-11. POURQUOI à approprier par un humain
> avant passage en `active` (Human Authorship).

## Pourquoi maintenant

« Zéro code sans spec validée » doit s'appliquer aux ~60 000 LOC du package
lui-même. La trace du repo le prouve : `bin/aiad-sdd.js` et l'essentiel de `lib/`
remontent comme `code_without_spec` (non bloquants aujourd'hui). La matrice de
traçabilité du package publié deviendrait notre **preuve vivante**.

## Pour qui

Les contributeurs ; la crédibilité du framework auprès des évaluateurs.

## Objectif

- SPECs **rétroactives** des modules cœur (`trace`, `emit-rules`, `init`, hooks).
- Annotations `@spec` dans `lib/`.
- `code_without_spec` bloquant ramené à **0** ; non-bloquant en décroissance continue.

## Contraintes

- **Progressif**, par module touché (pas de big bang).
- Ne pas geler la vélocité de développement.

## Critère de drift

Un nouveau module applicatif de `lib/` mergé sans annotation `@spec` → drift de
dogfooding.

## SPECs liées

- [x] SPEC-022-1 — Spec rétroactive lib/init.js + annotations modules cœur (`draft`)
- [x] SPEC-022-2 — Campagne d'annotation progressive — enforcement new modules lib/ (`draft`)
