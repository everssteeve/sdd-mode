---
name: architecture-review
description: "Use when reviewing a change, a design, technical debt or performance against ARCHITECTURE.md - standards, coupling, dependencies, budgets - and when drafting ADR options for the Tech Lead to decide."
---

# Skill — Revue d'architecture

> La cohérence technique se juge contre un document : `.aiad/ARCHITECTURE.md`. Ce qui n'y est pas écrit n'est pas opposable — c'est un manque à signaler.

## Quand l'utiliser

- Changement structurant, nouvelle dépendance, nouveau service.
- Avant `/aiad tech-review`.
- Inventaire de dette ou analyse de performance.

## Méthode

1. Lire `.aiad/ARCHITECTURE.md` et les ADR en vigueur.
2. **Standards** : le changement respecte-t-il les patterns et conventions écrits ? Citer la section pour chaque écart.
3. **Dépendances** : chaque nouvelle dépendance est-elle justifiée, maintenue, compatible avec les contraintes du projet ?
4. **Couplage** : dépendances circulaires, module qui connaît trop ses voisins, frontière franchie.
5. **Budgets** (performance, poids, ressources — lien RGESN) : mesurés, pas supposés.
6. **Dette** : classer par ce qu'elle coûte (ce qu'elle ralentit ou fragilise), avec un effort grossier S/M/L.
7. **Décision à prendre ?** Rédiger un brouillon d'ADR :

```markdown
# ADR-NNN — <titre>
Statut : proposé
## Contexte
## Options (au moins deux) — avantages, inconvénients, conséquences
## Décision
<laissée au Tech Lead>
```

## Sortie

Verdict `COHÉRENT` · `ÉCARTS` · `DÉCISION REQUISE`, écarts référencés, brouillon d'ADR le cas échéant.

## Anti-patterns

- Opposer une préférence personnelle comme un standard.
- Choisir l'option de l'ADR.
- Un gain de performance chiffré sans mesure.
