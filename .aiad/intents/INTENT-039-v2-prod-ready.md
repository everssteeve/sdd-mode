# INTENT-039-v2-prod-ready

**Auteur** : Steeve Evers
**Date** : 2026-11-17
**Statut** : active

> Transcription des mots de l'auteur, recueillis le 2026-11-17 : la consigne initiale, puis sa réponse au plan d'audit. Les champs que l'auteur n'a pas formulés sont laissés vides ; aucun n'a été rédigé par l'agent.

**Titre** : AIAD et SDD Mode 2.0 — de l'outil de recherche à l'outil utilisable en production

---

## POURQUOI MAINTENANT

« jusqu'ici aiad et sdd mode étaient des outils de recherche destinés uniquement à être théoriques. Je vise maintenant avec une version 2.0 pour les deux à devenir prod-ready »

## POUR QUI

*(non formulé par l'auteur — à écrire par lui)*

## OBJECTIF

« pouvoir être utilisés sur de vrais environnement de production avec des livrables réalisés grâce à aiad et sdd mode pouvant être déployés sur des environnements de production. »

« faire un audit très profond de aiad et sdd mode pour atteindre le plus haut niveau possible de qualité dans tous les sens du terme. »

« on proposera dans cette v2.0, une extension visant spécifiquement le milieu bancaire français avec un lot de subagents, skills, scripts permettant de rendre les productions compatibles avec le réglementaire qui s'impose pour cette industrie. »

## CONTRAINTES

- « Dans un premier temps, ton goal n'est que de faire un plan très précis de ce que tu devras réaliser dans un second temps. » *(plan remis le 2026-11-17)*
- « on peut livrer la publication dès maintenant et reprendre la boucle ALIS classique dans 28 jours » *(réponse de l'auteur au plan, 2026-11-17)*

## CRITÈRE DE DRIFT

*(non formulé par l'auteur — à écrire par lui)*

---

## Contexte factuel (relevé par l'agent — ne fait pas partie de l'intention)

- Audit du 2026-11-17 : 26 constats bloquants et le plan en neuf lots sont consignés hors dépôt (Drive AIAD, `06_AGENTS/outputs/PLAN-V2.0-PROD-READY.md`).
- Le plan proposait huit Intents (039 à 046). Ils sont regroupés ici en un seul, parce que l'auteur n'a formulé qu'une intention ; chaque lot du plan devient une SPEC de cet Intent.
- Décisions du plan (D2 à D13) non tranchées explicitement par l'auteur : l'agent applique ses recommandations et les signale dans chaque SPEC.

## Cycle SDD — ce qui a été fait et ce qui ne l'a pas été

- **Research** : tenue par l'audit du 2026-11-17 (lecture du code, reproductions en répertoire jetable, cinq sessions Claude Code réelles, vérification des références sur sources primaires).
- **Execution Gate** : non tenue par un humain à la date de création. Les SPEC sont rédigées par l'agent ; leur statut reste `draft` jusqu'à validation de l'auteur.

## Contrôle Human Authorship (skill `human-authorship-check`, 2026-11-17)

```
⚠️ HUMAN AUTHORSHIP — partiel
Auteur : Steeve Evers
Intent : INTENT-039
Note : POURQUOI MAINTENANT, OBJECTIF et CONTRAINTES sont les mots de l'auteur.
POUR QUI et CRITÈRE DE DRIFT sont absents et laissés vides par l'agent.
```
