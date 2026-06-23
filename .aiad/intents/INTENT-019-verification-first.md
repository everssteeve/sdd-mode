---
id: INTENT-019
title: Verification-first — dériver des tests des critères EARS
status: active
author: Steeve Evers
date: 2026-06-11
specs:
---

# INTENT-019 — Verification-first

> ⚠ Draft issu de l'analyse du 2026-06-11. POURQUOI à approprier par un humain
> avant passage en `active` (Human Authorship).

## Pourquoi maintenant

Le marché SDD est passé de « comment écrire la spec » à « comment **prouver** que
le code la respecte » : Kiro dérive des property-based tests directement des
exigences EARS. AIAD *valide* la syntaxe EARS (`ears-validator`) mais n'en dérive
**rien d'exécutable**. C'est le gap technique n°1 face à la concurrence.

## Pour qui

Les PE qui veulent une preuve de conformité, pas une promesse.

## Objectif

- Générateur de **squelettes de tests** à partir d'une SPEC `Format : EARS`
  validée (R1-R7), reliés par `@verified-by`.
- `trace --fail-on-gap` couvre la chaîne EARS → test → code.

## Contraintes

- EARS reste **optionnel** : ne rien imposer aux SPECs en prose.
- Squelettes de test = point de départ, jamais une preuve auto-validée.

## Critère de drift

Une SPEC EARS validée sans aucun test dérivé ni lié → drift verification-first.

## SPECs liées

- [ ] SPEC-019-1 — Générateur de squelettes de tests depuis EARS (`suggest-tests`) — draft
- [ ] SPEC-019-2 — Gap `earsSpecsSansTests` dans `trace --fail-on-gap` — draft
