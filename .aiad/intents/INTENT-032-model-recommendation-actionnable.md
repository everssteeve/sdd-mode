# INTENT-032-model-recommendation-actionnable

**Auteur** : Steeve Evers
**Date** : 2026-06-25
**Statut** : done

---

## POURQUOI MAINTENANT

FACT-015 ouvert le 2026-06-25 constate une friction UX réelle : chaque commande
`/sdd` et `/aiad` documente un modèle recommandé (ligne d'entête + « Étape 0 »
en mode guidé), mais n'offre pas de chemin **actionnable uniforme** pour le
switcher. Les commandes `/aiad` n'ont même pas d'« Étape 0 ». Le FACT qualifie
la sévérité de mineure, mais la remédiation est triviale — la repousser
accumulerait de la dette UX sans raison.

## POUR QUI

Product Engineers utilisant le CLI `aiad-sdd` au quotidien (solo ou en équipe),
toutes commandes `/sdd` et `/aiad` confondues.

## OBJECTIF

100 % des commandes `/sdd` et `/aiad` proposent, avant leur exécution, une
instruction `/model <id>` actionnable adaptée à la commande invoquée — y compris
les commandes à double modèle (critères de choix explicites).

## CONTRAINTES

- Claude Code ne fournit pas d'API agent pour changer de modèle
  programmatiquement : seul l'utilisateur peut exécuter `/model <id>`.
  Le switch automatique est donc hors scope.
- Les fichiers sources sont dans `.claude/sdd/` et `.claude/aiad/` — la
  modification doit rester dans ces fichiers sans toucher le cycle de build.
- Pas de régression sur le `-94 %` de cold-start obtenu par le routage lazy.

## CRITÈRE DE DRIFT

Il reste au moins une commande `/sdd` ou `/aiad` (fichiers `.claude/sdd/*.md` et
`.claude/aiad/*.md`) sans instruction `/model <id>` actionnable après la
remédiation — détectable par un grep sur `@model` ou `/model` dans ces fichiers.

---

## SPECs liées

- [x] SPEC-032-1 — /model actionnable — uniformisation 33 commandes /sdd et /aiad

---

_Résout : FACT-015_
