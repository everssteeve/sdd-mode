---
id: INTENT-020
title: Spec-anchored par construction — deltas et redevabilité bidirectionnelle
status: draft
author: Steeve Evers
date: 2026-06-11
specs:
---

# INTENT-020 — Spec-anchored par construction

> ⚠ Draft issu de l'analyse du 2026-06-11. POURQUOI à approprier par un humain
> avant passage en `active` (Human Authorship).

## Pourquoi maintenant

Notre Drift Lock repose sur la **discipline** (mettre à jour la SPEC dans la même
PR). Le modèle OpenSpec (specs = état courant, changements = deltas archivés à la
fusion) est spec-anchored **par construction** et supprime structurellement la
« taxe de maintenance » que la critique 2026 (Augment Code) dénonce : une spec
périmée trompe un agent qui exécute un plan obsolète « avec assurance ».

## Pour qui

Les PE sur projets brownfield et à cycle de vie long.

## Objectif

- Modèle **deltas/archive** : propositions de changement fusionnées dans l'état courant.
- **Redevabilité bidirectionnelle** : l'agent met à jour la SPEC quand il découvre
  une contrainte violée (tracé en `fact`).

## Contraintes

- Cohabiter avec le cycle existant ; **migration non imposée**.
- Ne pas alourdir le cycle pour les petits changements (proportionnalité).

## Critère de drift

Une contrainte violée découverte en exécution sans mise à jour de SPEC ni `fact`
associé → drift.

## SPECs liées

- [ ] SPEC-020-1 — Modèle deltas/archive (specs = état courant)
- [ ] SPEC-020-2 — Redevabilité bidirectionnelle agent → SPEC
