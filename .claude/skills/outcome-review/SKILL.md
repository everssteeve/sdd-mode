---
name: outcome-review
description: "Use when checking whether a delivered Intent reached its stated objective and whether its drift criterion is triggered - business validation support for the PM, after a delivery or before a demo."
---

# Skill — Revue d'outcome

> Livrer une SPEC n'est pas atteindre un objectif. Cette skill confronte ce qui a été livré à l'OBJECTIF et au CRITÈRE DE DRIFT écrits par l'auteur de l'Intent.

## Quand l'utiliser

- Après la validation technique et fonctionnelle, avant la validation métier.
- Avant `/aiad demo` et à l'Atelier d'Intention.

## Méthode

1. Citer l'**OBJECTIF** et sa **métrique** tels qu'écrits dans l'Intent — sans reformuler.
2. Chercher la **mesure** : `.aiad/metrics/`, tableau de bord, sortie de commande. Noter source et période.
3. Rendre un verdict : `ATTEINT` · `PARTIEL` · `NON ATTEINT` · `NON MESURABLE`.
4. Évaluer le **CRITÈRE DE DRIFT** : `DÉCLENCHÉ` · `NON DÉCLENCHÉ` · `NON ÉVALUABLE`, avec le fait observé.
5. Vérifier que toutes les SPECs liées sont livrées ; lister celles qui ne le sont pas.
6. Laisser la **validation métier** au PM : la skill instruit, elle ne valide pas.

## Sortie

Objectif cité · mesure sourcée · verdict · état du critère de drift · décision laissée au PM.

## Anti-patterns

- Conclure `ATTEINT` parce que toutes les SPECs sont livrées.
- Remplacer une mesure absente par une estimation.
- Reformuler l'objectif pour qu'il corresponde à ce qui a été livré.
