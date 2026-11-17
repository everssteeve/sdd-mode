---
name: backlog-health
description: "Use when auditing the intent backlog before a strategic sync or on request - detects zombie, orphan, stale-draft and duplicate intents and PRD inconsistencies, and lists the decisions the PM must make."
---

# Skill — Santé du backlog

> Un backlog sain est un backlog où chaque Intent a un porteur, une suite et une raison d'être encore valable.

## Quand l'utiliser

- Avant `/aiad sync-strat`.
- Quand le nombre d'Intents actifs augmente sans livraison.

## Méthode

Lire `.aiad/intents/_index.md`, les Intents non archivés, `.aiad/specs/_index.md`, puis relever :

| Signal | Règle | Décision attendue du PM |
|--------|-------|-------------------------|
| **Zombie** | Intent `active` sans activité depuis plus de 30 jours | archiver ou relancer |
| **Orphelin** | Intent `active` sans SPEC liée | décomposer ou retirer |
| **Draft oublié** | Intent `draft` depuis plus de 14 jours | mûrir ou abandonner |
| **Doublon** | Deux Intents au même objectif pour le même public | fusionner |
| **Hors PRD** | Objectif sans lien avec la vision du PRD | réviser le PRD ou l'Intent |
| **Sans critère de drift** | Champ vide ou non observable | compléter (par l'auteur) |

Chaque signal porte sa preuve datée (dernier commit, date du frontmatter, SPEC absente). L'activité se lit dans git quand il est disponible ; sinon dans les dates des artefacts, en le précisant.

## Sortie

Compteurs par statut, puis la liste des décisions à prendre, un Intent par ligne, avec le signal et la preuve.

## Anti-patterns

- Changer un statut soi-même.
- Proposer un ordre de priorité : la priorisation est une décision du PM.
- Conclure « zombie » sans date vérifiée.
