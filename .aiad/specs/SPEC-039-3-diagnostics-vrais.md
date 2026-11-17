---
id: SPEC-039-3
title: Diagnostics vrais et intégration continue verte dès l'installation
parent_intent: INTENT-039
status: draft
format: prose
author: Steeve Evers
date: "2026-11-17"
---

# SPEC-039-3-diagnostics-vrais

**Intent parent** : INTENT-039
**Auteur** : Steeve Evers *(rédaction : agent, 2026-11-17)*
**Statut** : draft — Gate non tenue par un humain
**Format** : prose

## 1. Contexte

Deux constats de l'audit du 2026-11-17 :

- A24 — quand les garde-fous Claude Code ne sont pas câblés, rien ne le dit : `doctor` ne contrôle que le hook pre-commit de git.
- A23 — les contrôles d'intégration continue installés par `init` échouent dès le premier jour : `emit-rules --check` vérifie des runtimes jamais générés, `docs --check` exige un fichier que `init` ne crée pas, les gabarits de projet référencent un Intent et une SPEC qu'ils ne livrent pas, et générer le tableau de bord fait échouer la traçabilité. Les workflows installent `aiad-sdd@latest`, et l'un d'eux publie le tableau de bord sur GitHub Pages à chaque push.

Un contrôle rouge dès le départ est désactivé par l'équipe ; un diagnostic qui ne voit pas l'absence d'un garde-fou ne sert à rien.

## 2. Comportement Attendu

1. `doctor` compare les hooks attendus (gabarit livré) à ceux réellement câblés dans `.claude/settings.json` et présents dans `.aiad/hooks/`. Un écart est une erreur (code de sortie non nul) qui nomme les hooks manquants.
2. `emit-rules --check` sans `--runtime` ne vérifie que les runtimes déjà générés dans le projet.
3. Le workflow de contrôle de documentation se déclare non applicable quand `DOCUMENTATION.md` n'existe pas.
4. Les gabarits de projet livrent l'Intent et la SPEC d'amorçage que leur code référence, marqués comme à remplacer.
5. La sortie du tableau de bord porte un fichier témoin `.aiad-generated` ; tout dossier qui le contient est exclu de la traçabilité.
6. Les workflows livrés installent une version majeure fixée (`aiad-sdd@^2`) au lieu de `latest`.
7. Le workflow de publication du tableau de bord ne se déclenche que sur demande ; la publication à chaque push est un choix explicite de l'équipe.

### Cas limites

1. Profil minimal (sans `.aiad/hooks/`) → le contrôle des hooks Claude Code est non applicable.
2. `settings.json` illisible → signalé comme tel, tous les hooks comptés non câblés.
3. `emit-rules --check --runtime all` explicite → tous les runtimes sont vérifiés.

## 3. Critères d'Acceptation

- [x] CA-001 — `doctor` : hooks câblés reconnus ; hooks décâblés, script absent, `settings.json` illisible et `package.json` des hooks absent signalés, code de sortie 1 (tests).
- [x] CA-002 — Projet neuf : `emit-rules --check`, `trace --fail-on-gap` et `update --check` sortent à 0, y compris après génération du tableau de bord (test).
- [x] CA-003 — Gabarits `node-aiad` et `fastapi-aiad` : `trace --fail-on-gap` sort à 0 (test).
- [x] CA-004 — Aucun workflow livré n'installe `latest` ; le workflow du tableau de bord n'a pas de déclencheur `push` actif (test).

## 4. Déploiement et retour arrière

Livré dans la 2.0. Les workflows déjà installés dans un projet ne sont pas modifiés par `update` ; le guide de migration indique de les régénérer.

## 5. Limites connues

- Créer ou changer l'Intent actif rend les fichiers générés par `emit-rules` divergents jusqu'à leur régénération : c'est voulu (ils citent l'Intent actif), mais le contrôle CI échoue entre-temps.
- `^2` fixe la version majeure, pas la version exacte : la reproductibilité stricte passe par une dépendance de développement et un fichier de verrouillage.
