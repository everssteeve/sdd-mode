---
name: discovery-synthesis
description: "Use when turning raw product discovery material (interviews, user feedback, support tickets, market signals) into sourced findings and open hypotheses before an Intent or a PRD revision."
---

# Skill — Synthèse de discovery

> La discovery nourrit l'intention ; elle ne la remplace pas. Cette skill sépare ce qui est **observé** de ce qui est **interprété**, pour que le PM écrive son Intent sur des faits.

## Quand l'utiliser

- Avant `/sdd intent` ou `/sdd prd`.
- Quand un lot de retours utilisateurs doit être digéré.

## Méthode

1. **Inventorier les sources** : nature, date, nombre de personnes ou d'occurrences. Une source non lue est listée comme telle.
2. **Extraire les constats** : une phrase factuelle + sa source (`fichier:ligne`, URL, verbatim entre guillemets).
3. **Regrouper par problème utilisateur**, pas par source ni par solution.
4. **Peser** : combien de sources indépendantes soutiennent chaque constat ? Un constat à source unique est marqué « signal faible ».
5. **Interpréter à part** : chaque interprétation cite les constats sur lesquels elle repose.
6. **Lister les hypothèses ouvertes** sous forme de questions, avec un moyen de vérification.
7. **Nommer les angles morts** : qui n'a pas été entendu, quelle période n'est pas couverte.

## Sortie

Constats sourcés · interprétations rattachées · hypothèses ouvertes · angles morts. Jamais d'objectif ni de solution : ils appartiennent au PM.

## Anti-patterns

- Présenter une interprétation comme un constat.
- Compter dix verbatims de la même personne comme dix sources.
- Glisser une solution dans la formulation d'un problème.
