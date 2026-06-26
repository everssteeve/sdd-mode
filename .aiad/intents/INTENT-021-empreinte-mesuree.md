---
id: INTENT-021
title: Empreinte mesurée — tokens et coût par fonctionnalité
status: done
author: Steeve Evers
date: 2026-06-11
specs:
  - SPEC-021-1
  - SPEC-021-2
research: RESEARCH-034
---

# INTENT-021 — Empreinte mesurée

> ✅ Approprié par Steeve Evers le 2026-06-25 via RESEARCH-034 (CONDITIONAL GO, 85 %).
> Périmètre recentré : attribution tokens ↔ Intent/SPEC + restitution `/sdd context`.
> Coût € et page dashboard « Valeur » hors périmètre (cf. conditions C1/C2).

## Pourquoi maintenant

La Constitution (Art. IV) engage à « mesurer et publier l'empreinte — tokens,
coûts énergétiques par fonctionnalité ». Cet engagement n'a **aucune**
implémentation dans le package. Personne sur le marché ne le fait : c'est un
différenciateur d'écoconception aligné RGESN.

## Pour qui

Les équipes soucieuses de sobriété ; le reporting RGESN.

## Objectif

- Comptage des **tokens par Intent/SPEC**.
- Restitution dans `/sdd context` et dans la page **Valeur** du dashboard (INTENT-018).

## Contraintes

- Pas de télémétrie intrusive : mesure **locale, opt-in**.
- Alimente INTENT-018 (synergie, pas dépendance bloquante).

## Critère de drift

Une fonctionnalité livrée sans empreinte mesurée alors que la donnée est
disponible → drift de l'engagement Art. IV.

## SPECs liées

- [x] SPEC-021-1 — Attribution tokens ↔ Intent/SPEC (enrichissement hook Stop, rétro-compatible) → `.aiad/specs/SPEC-021-1-attribution-tokens-artefact.md`
- [x] SPEC-021-2 — Restitution dans `/sdd context` (page dashboard « Valeur » reportée — dépend d'INTENT-018) → `.aiad/specs/SPEC-021-2-restitution-empreinte-context.md`
