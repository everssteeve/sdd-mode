# INTENT-036-agents-de-role

**Auteur** : Steeve Evers
**Date** : 2026-11-15
**Statut** : active

> Transcription des mots de l'auteur, recueillis le 2026-11-15 en deux temps : la consigne initiale (OBJECTIF, POUR QUI, CONTRAINTES), puis sa réponse au compte rendu (POURQUOI MAINTENANT, CRITÈRE DE DRIFT). Aucun champ n'a été rédigé par l'agent.

**Titre** : Améliorer l'aspect agentique de SDD Mode — un agent par rôle, qui gère ses sous-agents

---

## POURQUOI MAINTENANT

« car l'agentique prend le dessus avec toujours plus de délégation aux agents qui sont plus efficaces et fiables » *(réponse de l'auteur du 2026-11-15 ; fautes de frappe corrigées, mots inchangés)*

## POUR QUI

« chacun des rôles nécessaires à l'édition logicielle » ; « Les rôles identifiés dans AIAD auront chacun un agent avec qui travailler, ce sont leur assistant personnel. »

## OBJECTIF

« Je souhaite améliorer l'aspect agentique de SDD MODE. Définis quels sont tous les agents qui doivent être mis en oeuvre ainsi que l'ensemble de leurs skills. SDD Mode doit devenir une expérience où chacun des rôles nécessaires à l'édition logicielle sont pris en charge par des agents. »

« Implémente ces agents, sous agents et skills et met à jour toute documentation utile. »

## CONTRAINTES

- « Human in the loop reste valable avec la primauté de l'intention humaine. »
- « Les rôles identifiés dans AIAD auront chacun un agent avec qui travailler, ce sont leur assistant personnel. »
- « Tous les autres agents seront gérés par ces 5 agents principaux. Par exemple, l'agent assurant les revues de code sera géré par l'agent du product engineer. »

## CRITÈRE DE DRIFT

« drift si on ne doit plus intervenir en tant qu'humain dans la création du produit » *(réponse de l'auteur du 2026-11-15 ; fautes de frappe corrigées, mots inchangés)*

---

## Contexte factuel (relevé par l'agent — ne fait pas partie de l'intention)

- Avant ce changement, le package ne livrait comme agents que les 4 agents de gouvernance Tier 1 générés par `emit-rules` (`.claude/agents/AIAD-*.md`) et 9 skills. Aucun agent ne correspondait aux 5 responsabilités AIAD.
- L'annexe F du framework (catalogue d'agents spécialisés) décrit des agents Security, Architecture, Quality, Code Review, Performance, Documentation, Refactoring, Migration — sans dire qui les lance.
- Claude Code applique la liste `Agent(...)` d'un agent quand celui-ci est lancé en session principale (`claude --agent <nom>`) : c'est ce mécanisme qui fait de « géré par » un contrôle appliqué plutôt qu'une consigne (documentation Claude Code, sous-agents, consultée le 2026-11-15).

## Cycle SDD — ce qui a été fait et ce qui ne l'a pas été

- **Research** : non conduite comme phase séparée. L'auteur a demandé conception et implémentation dans la même consigne.
- **Execution Gate** : SPEC-036-1 implémentée avant validation, puis **validée par l'auteur le 2026-11-15** (« validé »), en l'état, sans découpage — SQS 4/5, Atomicité à 0 assumée.
- **Version** : décision de l'auteur du 2026-11-15 — « la prochaine release sera majeure donc en 2.0 ».

## Contrôle Human Authorship (skill `human-authorship-check`, 2026-11-15)

```
✅ HUMAN AUTHORSHIP — validé
Auteur : Steeve Evers
Intent : INTENT-036
Note : les cinq champs sont les mots de l'auteur (consigne puis réponse du 2026-11-15).
Historique : premier contrôle partiel — POURQUOI MAINTENANT et CRITÈRE DE DRIFT absents, laissés vides par l'agent,
puis fournis par l'auteur.
```
