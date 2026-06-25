---
id: INTENT-031
title: Chaînage automatique conditionnel du cycle SDD + correctif hook Stop
author: Steeve Evers
date: 2026-06-25
status: draft
facts: FACT-010, FACT-011
---

# INTENT-031 — Chaînage automatique conditionnel du cycle SDD + correctif hook Stop

**Auteur** : Steeve Evers
**Date** : 2026-06-25
**Statut** : draft

---

## POURQUOI MAINTENANT

Deux FACTs ouverts formalisent la même friction vécue à chaque cycle SDD :

- **FACT-010** : le hook Stop émet un faux-positif `spec_validated_not_implemented` sur les
  SPECs `ready` (gate passée, exec non démarré) — l'absence d'annotations `@spec` est normale
  avant l'exécution, pas un drift. Pour débloquer, le PE doit éditer manuellement le statut 2 fois.
- **FACT-011** : un cycle complet `spec→gate→exec→validate→drift-check` requiert 5 à 7
  interruptions manuelles, y compris pour des décisions algorithmiquement déterminables
  (SQS ≥ 4/5, budget contexte < 40%, 0 veto gouvernance). Cette friction décourage l'usage
  sur les tâches routinières et ralentit le flux.

Ces deux écarts ont été tracés formellement. L'accumulation justifie une réponse structurelle
plutôt que des patchs isolés.

## POUR QUI

Le **Product Engineer** qui conduit des cycles SDD complets en autonomie (usage quotidien,
tâches routinières sans dimension stratégique ou réglementaire majeure).

## OBJECTIF

Réduire le nombre d'interruptions manuelles par cycle SDD complet de **5-7 à ≤ 2** —
en conservant uniquement les deux points de décision humaine non-délégables :

1. Verdict GO/NO-GO de la phase Research (research → spec)
2. Confirmation légère avant lancement de l'exécution agent (gate → exec)

Toutes les autres transitions (`spec→gate`, `exec→validate`, `validate→drift-check`,
`drift-check→trace`) s'enchaînent automatiquement quand les conditions sont satisfaites.

Secondairement : corriger le faux-positif du hook Stop sur la fenêtre `ready` (gate
passée, exec non démarré).

## CONTRAINTES

- **Human Authorship** : les transitions research→spec (GO/NO-GO) et gate→exec conservent
  une confirmation humaine — non-bypassable, quel que soit le mode.
- **Budget contexte** : seuil de 40% partout — le chaînage auto s'arrête si le budget
  dépasse ce seuil sur n'importe quelle étape.
- **Paramètre** : `auto_chain.enabled` activé par défaut (`true`), désactivable au niveau
  projet dans `.aiad/config.yml`. Pas de changement de comportement pour les projets qui
  désactivent le paramètre.
- **Compatibilité** : aucune régression sur les hooks existants ni sur le comportement
  manuel (toutes les commandes restent invocables individuellement).
- **Gouvernance** : si un veto Tier 1 (AI-ACT, RGPD, RGAA, RGESN) est détecté en cours
  de chaînage, le chaînage s'arrête immédiatement et remonte au PE.

## CRITÈRE DE DRIFT

Signal observable : un cycle `spec→gate→exec→validate→drift-check` déclenché sur une SPEC
dont les conditions sont satisfaites (SQS ≥ 4/5, budget contexte < 40%, 0 veto gouvernance,
`auto_chain.enabled = true`) se termine **sans aucun prompt intermédiaire** autre que la
confirmation gate→exec. Le hook Stop ne génère aucun gap `spec_validated_not_implemented`
pour une SPEC en statut `ready` sans exec démarré.

---

## SPECs liées

- [ ] SPEC-031-1 — Correctif hook Stop : exclusion du gap `spec_validated_not_implemented` pour fenêtre `ready` pré-exec
- [ ] SPEC-031-2 — Moteur de chaînage automatique conditionnel (conditions + registre de transitions)
- [ ] SPEC-031-3 — Paramètre `auto_chain` dans `.aiad/config.yml` + intégration commandes SDD
