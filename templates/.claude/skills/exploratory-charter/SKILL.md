---
name: exploratory-charter
description: "Use when exploring a feature beyond its scripted tests - session-based exploratory testing with charters (mission, scope, timebox), reproducible findings, defects separated from open questions."
---

# Skill — Test exploratoire par chartes

> Les tests scriptés vérifient ce qu'on a prévu. L'exploration cherche ce qu'on n'a pas prévu — avec méthode.

## Quand l'utiliser

- Fonctionnalité à risque, parcours utilisateur nouveau.
- Avant une démo ou une release importante.

## Méthode

### La charte

```
Explorer <zone ou parcours>
avec <données, profils, conditions>
pour découvrir <type de risque>
Durée : <30 à 90 min> — Hors périmètre : <…>
```

### Pistes d'exploration

- Entrées limites : vide, très long, caractères inattendus, valeurs extrêmes.
- Enchaînements : ordre inhabituel, retour arrière, double soumission, interruption et reprise.
- États : premier usage, données absentes, droits insuffisants, session expirée.
- Erreurs : le message est-il compréhensible, l'état est-il récupérable ?

### Rapporter

- **Défaut** (contredit la SPEC) : étapes de reproduction, attendu, observé.
- **Question** (la SPEC ne dit rien) : renvoyée au PE par un relais.
- Une anomalie non reproductible est rapportée comme telle.
- Couverture : ce qui a été exploré, ce qui ne l'a pas été.

## Anti-patterns

- Explorer sans charte ni limite de temps.
- Agir sur un environnement partagé ou de production.
- Présenter une question de SPEC comme un défaut.
