---
id: INTENT-021
title: Empreinte mesurée — tokens et coût par fonctionnalité
status: draft
author: Steeve Evers
date: 2026-06-11
specs:
---

# INTENT-021 — Empreinte mesurée

> ⚠ Draft issu de l'analyse du 2026-06-11. POURQUOI à approprier par un humain
> avant passage en `active` (Human Authorship).

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

- [ ] SPEC-021-1 — Comptage des tokens par artefact (Intent/SPEC)
- [ ] SPEC-021-2 — Restitution dans `/sdd context` + dashboard
