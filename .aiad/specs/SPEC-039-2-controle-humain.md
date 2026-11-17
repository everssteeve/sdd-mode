---
id: SPEC-039-2
title: Contrôle humain — premiers verrous opposables
parent_intent: INTENT-039
status: draft
format: prose
author: Steeve Evers
date: "2026-11-17"
---

# SPEC-039-2-controle-humain

**Intent parent** : INTENT-039
**Auteur** : Steeve Evers *(rédaction : agent, 2026-11-17)*
**Statut** : draft — Gate non tenue par un humain
**Format** : prose

## 1. Contexte

L'audit du 2026-11-17 a montré que plusieurs contrôles présentés comme bloquants pouvaient être satisfaits ou désactivés par l'agent qu'ils contrôlent, ou ne contrôlaient rien :

- A21 — `gate-precheck` rend PASS sur un fichier vide ou sur le gabarit non rempli.
- A2 — le chaînage automatique du cycle est actif par défaut : la SPEC part en Gate, l'exécution en validation, sans décision humaine.
- A5 — un octet modifié dans `.aiad/specs/_index.md` satisfait le Drift Lock du pre-commit ; l'agent peut éditer les bascules et les scripts des garde-fous ; aucune règle de permission n'est livrée.
- `plugin uninstall ../../../x` supprime un dossier hors du projet.

Cette SPEC pose les verrous qui ne demandent aucune décision de conception. L'enregistrement humain de la Gate et l'exécuteur de preuves `verify` font l'objet de SPEC suivantes.

## 2. Comportement Attendu

1. `gate-precheck` rend FAIL quand la SPEC n'est pas rédigée : corps vide, marqueurs du gabarit encore présents, Intent parent absent, aucun critère d'acceptation.
2. Le chaînage automatique est désactivé par défaut, dans le gabarit de configuration comme dans le code. Il reste activable explicitement.
3. Le Drift Lock du pre-commit n'est satisfait que par une vraie SPEC (`.aiad/specs/SPEC-*.md`) dans le commit. Le scan de données sensibles trouve le binaire installé localement.
4. Le gabarit de `settings.json` livre des règles de permission : refus de modifier `.aiad/hooks/**`, `.aiad/hook-bypass.yml`, `.aiad/hooks-config*.json`, `.aiad/gouvernance/**` et de committer avec `--no-verify` ; confirmation humaine pour modifier `.aiad/config.yml`. Ces règles sont fusionnées dans un `settings.json` existant et retirées exactement à la désinstallation.
5. Un identifiant de plugin qui sortirait de `.aiad/plugins/` est refusé, à l'installation comme à la désinstallation.

### Cas limites

1. SPEC au format EARS sans liste « CA- » → considérée comme rédigée si elle porte des exigences `SHALL`.
2. SPEC existante du dépôt → aucune ne doit devenir FAIL par la règle de rédaction.
3. Règle de permission identique déjà posée par l'équipe → non dupliquée.

## 3. Critères d'Acceptation

- [x] CA-001 — `gate-precheck` : FAIL sur fichier vide, gabarit brut, SPEC sans Intent parent, SPEC sans critère ; les SPEC du dépôt passent (tests).
- [x] CA-002 — pre-commit : `_index.md` seul ne satisfait pas le Drift Lock, une vraie SPEC oui (test).
- [x] CA-003 — règles de permission livrées, fusionnées et retirées exactement (tests).
- [x] CA-004 — identifiant de plugin hors `.aiad/plugins/` refusé, rien n'est supprimé (tests).
- [x] CA-005 — chaînage automatique désactivé par défaut dans le code et dans le gabarit (tests).

## 4. Déploiement et retour arrière

Livré dans la 2.0. Rupture assumée : un projet qui comptait sur le chaînage automatique doit l'activer explicitement (`auto_chain.enabled: true`). Retour arrière : réactiver ce paramètre ; aucun format d'artefact n'est modifié.

## 5. Limites connues, traitées par des SPEC suivantes

- Les règles de permission ne couvrent pas une écriture indirecte par un script lancé depuis le shell (limite documentée de Claude Code) : le contrôle opposable reste celui rejoué en CI.
- Une modification d'une ligne dans une vraie SPEC satisfait encore le Drift Lock du pre-commit : le lien SPEC ↔ code doit être vérifié par la traçabilité.
- L'ouverture de la Gate n'est pas encore un enregistrement signé par un humain.
