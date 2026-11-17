---
id: SPEC-039-1
title: Installation fiable — hooks câblés, portables, fail-closed
parent_intent: INTENT-039
status: draft
format: prose
author: Steeve Evers
date: "2026-11-17"
---

# SPEC-039-1-installation-fiable

**Intent parent** : INTENT-039
**Auteur** : Steeve Evers *(rédaction : agent, 2026-11-17)*
**Statut** : draft — Gate non tenue par un humain
**Format** : prose

## 1. Contexte

L'audit du 2026-11-17 a reproduit sept défauts qui font que les garde-fous annoncés ne s'exécutent pas dans des projets ordinaires, ou que l'outil abîme le projet qui l'adopte :

- A3 — avec un `.claude/settings.json` préexistant, `init` n'installe aucun hook et `update` n'en pose qu'un.
- A4 — le veto Tier 1 laisse passer le commit quand la CLI est absente ou plante.
- A6 — dans un chemin contenant un espace, aucun hook ne s'exécute (confirmé en session Claude Code).
- A25 — dans un projet `"type": "commonjs"`, les sept hooks plantent.
- A22 / A26 — le verdict de traçabilité est coupé à 64 Ko dans un tube, et le code de `node_modules/` est analysé quand il n'est pas ignoré par git.
- A19 — `update --dry-run` écrit réellement.
- A7 / A20 — `uninstall` tronque `CLAUDE.md`, supprime des commandes du projet et laisse des résidus.

## 2. Comportement Attendu

1. `init` et `update` câblent tous les hooks du gabarit dans `.claude/settings.json`, que le fichier existe ou non. Les entrées de l'utilisateur (hooks, permissions, autres clés) sont conservées ; les entrées AIAD sont reconnues à leur commande, qui référence `.aiad/hooks/`.
2. `update` resynchronise tous les scripts de `.aiad/hooks/`, pas seulement `session-start.js`.
3. Les commandes de hooks mettent le chemin du projet entre guillemets. Le filtre `if` est porté par chaque hook.
4. `.aiad/hooks/package.json` déclare `"type": "module"` : les hooks s'exécutent quel que soit le champ `type` du projet hôte.
5. Le veto refuse le commit quand il n'obtient aucun verdict lisible, et le dit. Il ne s'applique qu'aux commandes `git commit`. Son message n'invite plus l'agent à poser lui-même l'annotation `@governance`.
6. Le hook Stop est synchrone, respecte `stop_hook_active`, et distingue « CLI introuvable » de « verdict illisible ».
7. Les sorties du CLI sont complètes dans un tube, quelle que soit leur taille.
8. La traçabilité ignore `node_modules/` et les autres dossiers exclus même quand `.gitignore` ne les couvre pas.
9. `update --dry-run` n'écrit rien et l'annonce.
10. `uninstall` ne retire de `CLAUDE.md` que le bloc AIAD, ne supprime que les commandes livrées par le paquet, retire ses hooks de `settings.json` en conservant ceux de l'utilisateur, et retire les agents, règles et workflows qu'il a posés.

### Cas limites

1. `settings.json` illisible (JSON invalide) → le fichier n'est pas modifié ; l'anomalie est signalée, code de sortie non nul.
2. Hook maison de l'utilisateur sur le même événement qu'un hook AIAD → conservé, placé avant.
3. Texte de l'utilisateur placé après la section SDD Mode dans `CLAUDE.md` → conservé par `uninstall`.
4. Commande du projet nommée `aiad-*.md` ou `sdd-*.md` → jamais supprimée.

## 3. Critères d'Acceptation

- [x] CA-001 — Fusion : hooks AIAD ajoutés, entrées utilisateur intactes, opération idempotente (test).
- [x] CA-002 — Retrait : seules les entrées AIAD partent (test).
- [x] CA-003 — `init` sur un projet avec `settings.json` préexistant câble les six hooks (test).
- [x] CA-004 — `update` resynchronise tous les scripts de hooks et câble tous les hooks (test).
- [x] CA-005 — Aucun chemin non quoté dans les commandes de hooks du gabarit (test).
- [x] CA-006 — Chaque hook s'exécute dans un projet `"type": "commonjs"` (test).
- [x] CA-007 — Veto sans CLI : code 2 et motif explicite (test).
- [x] CA-008 — Verdict de plus de 64 Ko lu en entier à travers un tube (test).
- [x] CA-009 — `node_modules/` non ignoré par git : aucun écart n'en provient (test).
- [x] CA-010 — `update --dry-run` laisse l'arbre inchangé (test).
- [x] CA-011 — `uninstall` conserve le texte utilisateur de `CLAUDE.md` et les commandes du projet, et ne laisse aucun hook AIAD (test).

## 4. Déploiement et retour arrière

Livré dans la 2.0. Retour arrière : réinstaller la version précédente et relancer `update` ; aucun format d'artefact n'est modifié.

## 5. Décisions appliquées sans arbitrage explicite de l'auteur

- Le veto devient réellement fail-closed : un projet qui n'a pas installé le paquet voit ses commits d'agent refusés jusqu'à l'installation. C'est la promesse écrite depuis la v1.x ; elle n'était pas tenue.
- Le hook Stop n'est plus un hook d'arrière-plan.
