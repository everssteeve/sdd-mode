# INTENT-034-gouvernance-sync-drive

**Auteur** : Steeve Evers
**Date** : 2026-09-25
**Statut** : active

> Transcription des réponses de l'auteur, mot pour mot, recueillies le 2026-09-25 (pattern Interrogatory LLM). Aucun champ n'a été rédigé par l'agent.

**Titre** : Synchroniser les agents de gouvernance du package sur le corpus Drive, qui fait foi

---

## POURQUOI MAINTENANT

je reprends aiad après la pause estivale

## POUR QUI

tous ceux qui s'intéressent au cycle de dev à l'ère des agents IA

## OBJECTIF

être une source d'information pour le cycle de dev à l'ère de l'IA basée sur des retours du terrain, pas d'une théorie

**Métrique** : 0 écart entre les agents de gouvernance du package et ceux du Drive à chaque release (contrôle automatique). *(Reformulation proposée par l'agent — cas prévu par la skill `human-authorship-check`, critère #4 — validée par l'auteur le 2026-09-25.)*

## CONTRAINTES

- **Le corpus Drive fait foi** pour les agents de gouvernance *(décision de l'auteur, 2026-09-25)*.
- **L'agent CRA est rapatrié au Drive** *(décision de l'auteur, 2026-09-25)*.
- le CRA reste dans le package

## CRITÈRE DE DRIFT

la version de aiad lors d'une release est différente de celle présente sur le drive

---

## Contexte factuel (relevé par l'agent — ne fait pas partie de l'intention)

- `templates/.aiad/gouvernance/` (copie installée par `init`, datée du 2026-06-09) : AIAD-AI-ACT annonce l'Omnibus « PAS encore adopté » ; le Règlement (UE) 2026/1744 n'y figure pas. Même contenu dans `.aiad/gouvernance/` du dépôt.
- Trois sources divergentes : corpus Drive (v1.9, 2026-09-25), context packs internes hors dépôt (2026-03-22), templates du package (2026-06-09).
- `AIAD-CRA.md` (Cyber Resilience Act) existe dans le package, pas dans le corpus Drive.

---

## Contrôle Human Authorship (skill `human-authorship-check`, 2026-09-25)

```
✅ HUMAN AUTHORSHIP — validé
Auteur : Steeve Evers
Intent : INTENT-034
Note : POURQUOI MAINTENANT, POUR QUI, OBJECTIF, CONTRAINTES et CRITÈRE DE DRIFT sont les mots et décisions de l'auteur ;
la métrique est une reformulation proposée par l'agent (cas prévu, critère #4) et validée par l'auteur.
Historique : premier contrôle en échec (#2, #4) ; l'auteur a reformulé contraintes et drift avec ses mots
(pour le drift, à partir d'une suggestion de l'agent, réécrite par l'auteur).
```
