---
id: CANARY-010
kind: generative
expected: 4
tolerance: 14
---

# CANARY-010 — Dispersion du score SQS (volet génératif)

> Cas **figé** de la canary suite (§3.10). Volet jugé par le modèle.

## Mesure

Score SQS de référence attendu : **4 / 5** sur la SPEC témoin. Le modèle est
rejoué K fois ; la **dispersion** des scores observés doit rester dans la bande
de tolérance **±14 %** (§2.2 : variance serving mesurée ±8-14 %).

## Lecture du verdict

- Dispersion ≤ 14 % → **PASS** (bruit de serving normal, pas une régression).
- Dispersion > 14 % → **DRIFT** (CONDITIONAL) — régression à investiguer, à ne
  PAS confondre avec du bruit avant analyse.

## Collecte des échantillons

Les scores observés sont lus depuis `.aiad/metrics/canary/samples/CANARY-010.json`
(tableau de nombres). Sans échantillon collecté, le cas est indécidable (JNSP) —
la canary ne fabrique jamais une mesure.
