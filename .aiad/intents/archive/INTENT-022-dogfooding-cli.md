---
id: INTENT-022
title: Dogfooding complet — le CLI sous SPEC
status: done
author: Steeve Evers
date: 2026-06-11
archived: 2026-06-29
specs:
---

# INTENT-022 — Dogfooding complet (le CLI sous SPEC)

> ✅ Archivé le 2026-06-29. SPEC-022-1 et SPEC-022-2 complétées et livrées.

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
