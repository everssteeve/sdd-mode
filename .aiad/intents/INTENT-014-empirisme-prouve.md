---
id: INTENT-014
title: Empirisme prouvé — gates qualité actifs et claims sourcés
status: draft
author: Steeve Evers
date: 2026-06-11
specs:
---

# INTENT-014 — Empirisme prouvé

> ⚠ Draft issu de l'analyse du 2026-06-11. POURQUOI à approprier par un humain
> avant passage en `active` (Human Authorship).

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

- [ ] SPEC-014-1 — Gates CI : `lint:size --strict` + `coverage:threshold` + badge
- [ ] SPEC-014-2 — Protocole `bench/` public + sourcing/requalification des claims
