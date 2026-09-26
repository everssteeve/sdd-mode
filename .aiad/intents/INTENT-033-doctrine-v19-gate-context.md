# INTENT-033-doctrine-v19-gate-context

**Auteur** : Steeve Evers
**Date** : 2026-09-25
**Statut** : active

> Transcription des réponses de l'auteur, mot pour mot, recueillies le 2026-09-25 (pattern Interrogatory LLM). Aucun champ n'a été rédigé par l'agent.

**Titre** : Aligner /sdd gate et /sdd context sur la doctrine AIAD v1.9

---

## POURQUOI MAINTENANT

je reprends aiad après la pause estivale

## POUR QUI

tous ceux qui s'intéressent au cycle de dev à l'ère des agents IA

## OBJECTIF

être une source d'information pour le cycle de dev à l'ère de l'IA basée sur des retours du terrain, pas d'une théorie

**Métrique** : 100 % des SPEC déclarant des credentials, une ressource partagée en écriture ou une action irréversible sont contrôlées par la Gate ; 0 régression sur la suite de tests existante. *(Reformulation proposée par l'agent — cas prévu par la skill `human-authorship-check`, critère #4 — validée par l'auteur le 2026-09-25.)*

## CONTRAINTES

pas de régression sur les SPEC existantes

## CRITÈRE DE DRIFT

la Gate bloque des SPEC qui passaient avant

---

## Contexte factuel (relevé par l'agent — ne fait pas partie de l'intention)

- La doctrine publiée le 2026-09-25 (Framework AIAD v1.9) prescrit : section conditionnelle « Périmètre d'exécution de l'agent » (credentials, ressources partagées en écriture) ; classe de réversibilité et seuil d'arrêt pour les actions irréversibles ; section optionnelle « Points d'arrêt de l'agent » ; coût d'une délégation à un sous-agent qui hérite de la conversation parente (« déléguer tôt ») ; datation de toute hypothèse de capacité ou de prix.
- `/sdd gate` (`.claude/sdd/gate.md`) et `/sdd context` (`.claude/sdd/context.md`) n'implémentent aucun de ces points ; les commandes citent des modèles sans date (« Sonnet 4.6 », « Opus 4.8 »).

---

## Contrôle Human Authorship (skill `human-authorship-check`, 2026-09-25)

```
✅ HUMAN AUTHORSHIP — validé
Auteur : Steeve Evers
Intent : INTENT-033
Note : POURQUOI MAINTENANT, POUR QUI, OBJECTIF, CONTRAINTES et CRITÈRE DE DRIFT sont les mots de l'auteur ;
la métrique est une reformulation proposée par l'agent (cas prévu, critère #4) et validée par l'auteur.
Historique : un premier contrôle avait échoué (#2 contraintes et drift proposés par l'agent ; #4 objectif sans métrique) —
l'auteur a reformulé contraintes et drift avec ses mots.
```
