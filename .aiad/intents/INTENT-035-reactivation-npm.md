# INTENT-035-reactivation-npm

**Auteur** : Steeve Evers
**Date** : 2026-09-25
**Statut** : active

> Transcription des réponses de l'auteur, mot pour mot, recueillies le 2026-09-25 (pattern Interrogatory LLM). Aucun champ n'a été rédigé par l'agent.

**Titre** : Réactiver la distribution npm du package aiad-sdd

---

## POURQUOI MAINTENANT

je reprends aiad après la pause estivale

## POUR QUI

tous ceux qui s'intéressent au cycle de dev à l'ère des agents IA

## OBJECTIF

être une source d'information pour le cycle de dev à l'ère de l'IA basée sur des retours du terrain, pas d'une théorie

**Métrique** : `npx aiad-sdd init` fonctionne depuis le registre npm, et la version publiée sur npm est celle qu'annonce `SDDMode.md`. *(Reformulation proposée par l'agent — cas prévu par la skill `human-authorship-check`, critère #4 — validée par l'auteur le 2026-09-25.)*

## CONTRAINTES

- **Réactiver quand INTENT-033 et INTENT-034 sont livrés** *(réponse de l'auteur, 2026-09-25)*.
- rien de plus

## CRITÈRE DE DRIFT

npm est indisponible

---

## Contexte factuel (relevé par l'agent — ne fait pas partie de l'intention)

- Package retiré du registre npm le 2026-07-16 (retrait volontaire, « mise en pause » — réponse de l'auteur).
- npm n'autorise jamais la republication d'un numéro de version déjà publié : la réactivation passe par une nouvelle version (≥ v1.20.0).
- `SDDMode.md` publié le 2026-09-25 annonce `npx aiad-sdd init` et la v1.17 ; le dépôt est en v1.19.0.

---

## Contrôle Human Authorship (skill `human-authorship-check`, 2026-09-25)

```
✅ HUMAN AUTHORSHIP — validé
Auteur : Steeve Evers
Intent : INTENT-035
Note : POURQUOI MAINTENANT, POUR QUI, OBJECTIF, CONTRAINTES et CRITÈRE DE DRIFT sont les mots de l'auteur ;
la métrique est une reformulation proposée par l'agent (cas prévu, critère #4) et validée par l'auteur.
Historique : premier contrôle en échec (#2, #4) ; l'auteur a reformulé contraintes et drift avec ses mots.
```
