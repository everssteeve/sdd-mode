---
id: INTENT-018
title: La valeur réalisée comme boussole — outcomes, EBM, bilan humains/agents
status: done
author: Steeve Evers
date: 2026-06-11
activated: 2026-06-23
research: RESEARCH-024
specs:
  - SPEC-018-1
  - SPEC-018-2
  - SPEC-018-3
  - SPEC-018-4
  - SPEC-018-5
---

# INTENT-018 — La valeur réalisée comme boussole

> ⚠ Draft issu de l'analyse du 2026-06-11. POURQUOI à approprier par un humain
> avant passage en `active` (Human Authorship).

## Pourquoi maintenant

Le principe directeur d'AIAD est « on juge sur la valeur réalisée », mais le
dashboard ne mesure que l'**activité** (specs fermées, throughput). Les outcomes
du PRD ne sont jamais reliés aux Intents. C'est aussi un différenciateur marché
vérifié : aucun outil ne trace la contribution **humain vs agent**.

## Pour qui

Le PM et le leadership ; le positionnement produit du framework.

## Objectif

- Matrice **outcomes ↔ Intents** (critère PRD ↔ Intents contributeurs ↔ mesures datées).
- Les **4 aires EBM** (Current/Unrealized Value, Time-to-Market, Ability to Innovate).
- **Investment balance** (features / dette / bugs / conformité).
- **Hill charts** calculés depuis l'état du cycle SDD.
- **Bilan humains/agents** par Intent (qui formule, qui exécute, qui valide, vetos).
- Matrice **Impact × Effort** des Intents en attente.

## Contraintes

- Dépend de INTENT-016 et INTENT-017.
- **Pas d'IA qui pilote** : l'IA propose, l'humain tranche (cf. échec de Height).

## Critère de drift

Un outcome affiché sans mesure datée (faux « 100 % » au lieu d'un `JNSP`) → drift
de l'empirisme.

## SPECs liées

- [x] SPEC-018-1 — Matrice outcomes ↔ Intents (Wave 1)
- [x] SPEC-018-2 — Aires EBM + Investment Balance (Wave 2, après 018-1)
- [x] SPEC-018-3 — Hill charts calculés depuis l'état SDD (Wave 1)
- [x] SPEC-018-4 — Bilan humains/agents par Intent (Wave 2, après 018-1)
- [x] SPEC-018-5 — Matrice Impact × Effort en attente (Wave 1)
