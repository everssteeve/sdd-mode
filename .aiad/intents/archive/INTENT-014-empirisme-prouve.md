---
id: INTENT-014
title: Empirisme prouvé — gates qualité actifs et claims sourcés
status: archived
author: Steeve Evers
date: "2026-06-11"
specs: SPEC-014-1, SPEC-014-2
archivedAt: "2026-06-24T07:17:03.686Z"
archivedBy: evers.steeve@gmail.com
archivedReason: archive done
---
# INTENT-014 — Empirisme prouvé

> POURQUOI approprié par Steeve Evers le 2026-06-15 (Human Authorship) →
> `draft` → `active` → `done` le 2026-06-16 (SPEC-014-1 PR #5 + SPEC-014-2 PR #6
> mergées, Drift Lock OK). Research RESEARCH-015 = CONDITIONAL GO.

## Pourquoi maintenant

La valeur n°5 « Empirisme sans Concession » exige que la mesure prime sur
l'intuition. Or nos chiffres publics (« −41,7 % de tokens », « AWS Strands
−96 % ») ne sont adossés à aucun protocole reproductible du projet, et les
scripts `test:coverage:threshold` et `lint:size --strict` existent mais ne
s'exécutent **jamais** en CI ni dans `prepublishOnly`. Nous prêchons la mesure
sans la pratiquer sur nous-mêmes.

## Pour qui

Les évaluateurs qui vérifient nos affirmations, les contributeurs qui ont besoin
d'un signal de qualité fiable, et le mainteneur.

## Objectif

- `lint:size --strict` et `test:coverage:threshold` intégrés à `prepublishOnly`
  et à la CI, avec un seuil de couverture explicite (cible initiale ~70 %) et un
  badge de couverture publié.
- Chaque claim chiffré public adossé à un protocole `bench/` reproductible, ou
  requalifié en citation externe datée.

## Contraintes

- Ne pas casser `prepublishOnly` ; seuil de couverture réaliste, pas punitif.
- Les claims non reproductibles sont requalifiés, jamais supprimés en silence.

## Critère de drift

Un claim chiffré publié sans protocole reproductible associé, ou une release
passant sans gate de couverture/taille → drift.

## SPECs liées

- [x] SPEC-014-1 — Gates CI : `lint:size --strict` + `coverage:threshold` + badge → done (PR #5)
- [x] SPEC-014-2 — Sourcing seul (R4) : figer claims externes + requalifier le 50K (C-R3) → done (PR #6)

## Signaux liés

- [FACT-001](../facts/FACT-001-seuil-50k-non-source.md) — le seuil 50K tokens
  (context rot) est codé en dur dans 4 fichiers sans source ni dérivation, alors
  que le 60–70 % de fenêtre, lui, est sourcé. Candidat SPEC-014-2.
