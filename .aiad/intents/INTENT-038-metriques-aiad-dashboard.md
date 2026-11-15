# INTENT-038-metriques-aiad-dashboard

**Auteur** : Steeve Evers
**Date** : 2026-11-15
**Statut** : active

> Transcription des mots de l'auteur, recueillis le 2026-11-15 en deux temps : la consigne initiale (OBJECTIF), puis sa réponse (POURQUOI MAINTENANT, CRITÈRE DE DRIFT). POUR QUI est une formulation proposée par l'agent et choisie par l'auteur.

**Titre** : Retrouver dans le dashboard les métriques qu'expose AIAD

---

## POURQUOI MAINTENANT

« car la v2 doit viser le prod ready et donc doit permettre de piloter l'activité » *(réponse de l'auteur du 2026-11-15 ; fautes de frappe corrigées, mots inchangés)*

## POUR QUI

« Les 5 responsabilités » — PM, PE, AE, QA et Tech Lead : chacun retrouve dans son onglet les métriques qu'il suit. *(formulation proposée par l'agent, choisie par l'auteur le 2026-11-15 — cas prévu par la skill `human-authorship-check`, critère #4)*

## OBJECTIF

« AIAD expose des métriques que l'on doit retrouver dans le dashboard. Mets cela en oeuvre. »

## CONTRAINTES

*Aucune contrainte exprimée par l'auteur.*

## CRITÈRE DE DRIFT

« les métriques ne sont pas outillées correctement et ne retournent pas les infos dans le dashboard » *(réponse de l'auteur du 2026-11-15 ; fautes de frappe corrigées, mots inchangés)*

---

## Contexte factuel (relevé par l'agent — ne fait pas partie de l'intention)

- Le framework AIAD (§ 7) définit 29 métriques en cinq catégories — Productivité (5), Qualité (6), Efficacité IA (7), Outcomes (6), Équipe (5) — et intègre DORA (4) et Flow (5).
- Avant ce changement, le dashboard n'affichait que huit d'entre elles (déploiements, Cycle Time, Lead Time, Change Failure Rate, WIP, SQS, premier passage à la Gate, drifts), sans cible ni état, et rien pour l'Efficacité IA, les Outcomes ni l'Équipe.
- Plusieurs métriques du framework n'avaient aucune source dans le schéma de `.aiad/metrics/` : elles ne pouvaient être ni saisies ni affichées.
- Deux métriques d'équipe — turnover et jours de maladie — sont des données RH et de santé.

## Cycle SDD — ce qui a été fait et ce qui ne l'a pas été

- **Research** : non conduite comme phase séparée.
- **Execution Gate** : SPEC-038-1 et SPEC-038-2 implémentées avant validation, puis **validées par l'auteur le 2026-11-15** (« je valide les deux »), en l'état.
- **Critère de drift : déclaré levé par l'auteur le 2026-11-15.** Interrogé alors que 14 métriques restaient sans valeur et que `aiad-sdd metrics check` échouait, l'auteur a répondu « oui, levé » : les métriques sont outillées et le dashboard dit pour chacune ce qu'elle vaut ou ce qui manque ; les valeurs manquantes viendront des rituels.
- **État au regard du critère de drift, le 2026-11-15** (constat de l'agent sur le projet `aiad-sdd`) : 13 métriques sur 36 avaient une valeur après SPEC-038-1 ; **22 sur 36 après SPEC-038-2**. Les 14 autres — Équipe, Outcomes, Efficacité IA déclarative — sont « non mesurées » : l'auteur a choisi de ne pas les déclarer et a annulé les reports que l'agent avait enregistrés en son nom. `aiad-sdd metrics check` échoue donc sur ce projet, jusqu'à ce que les rituels soient tenus et enregistrés.
- **Lecture de l'objectif par l'agent** (à confirmer par l'auteur) : « les métriques qu'expose AIAD » = celles du chapitre 7 du framework.

## Contrôle Human Authorship (skill `human-authorship-check`, 2026-11-15)

```
✅ HUMAN AUTHORSHIP — validé
Auteur : Steeve Evers
Intent : INTENT-038
Note : OBJECTIF, POURQUOI MAINTENANT et CRITÈRE DE DRIFT sont les mots de l'auteur ;
POUR QUI est une formulation proposée par l'agent (cas prévu, critère #4) et choisie par l'auteur le 2026-11-15.
```
