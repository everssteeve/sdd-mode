---
id: INTENT-017
title: Vivre le projet au quotidien — Aujourd'hui, triage, digest
status: done
author: Steeve Evers
date: 2026-06-11
activated: 2026-06-22
closed: 2026-06-23
specs:
  - SPEC-017-1
  - SPEC-017-2
  - SPEC-017-3
  - SPEC-017-4
---

# INTENT-017 — Vivre le projet au quotidien

> ✅ Validé par Steeve Evers le 2026-06-22 — Human Authorship confirmé.

## Pourquoi maintenant

Le dashboard est une encyclopédie (17 pages, 100+ blocs), pas un radiateur :
sans vue « ma journée », il n'est pas consulté quotidiennement et ne sert aucune
décision. Le benchmark 2026 (Linear : My Issues + Inbox + Triage + Pulse) montre
que le pattern gagnant est « Today + triage + digest ».

## Pour qui

Le PE, le PM et l'équipe, au quotidien.

## Objectif

- Page **Aujourd'hui** (≤ 4 sections, lisible en 10 s) par défaut.
- **Inbox de triage** des facts/drifts (accept/defer), séparée du reste.
- **Digest delta** « depuis la dernière génération » + script de standup auto.
- Pages **détail Intent/SPEC** (#453) avec drill-down.
- Mode **live SSE** (#140) ; **snapshots persistants** pour tendances longues.

## Contraintes

- Dépend de INTENT-016 (fondations 4 couches accessibles).
- **Pas de notifications push** : digest en pull (anti dashboard fatigue).

## Critère de drift

Page Aujourd'hui dépassant 4 sections / 1 écran, ou réintroduction de
notifications push unitaires → drift.

## SPECs liées

- [ ] SPEC-017-1 — Page "Aujourd'hui" (radiator ≤ 4 sections) · draft EARS
- [ ] SPEC-017-2 — Inbox de triage facts/drifts (localStorage) · draft EARS
- [ ] SPEC-017-3 — Digest delta + snapshots persistants · draft EARS
- [ ] SPEC-017-4 — Pages détail SPEC (drill-down) · draft EARS
- ~~SPEC-017-5 — Mode live SSE~~ → livré dans INTENT-016 (`assets.js:734`, polling 30s, C2 RESEARCH-023)
- ~~SPEC-017-6 — Snapshots persistants~~ → patterns établis dans INTENT-016 (pm-snapshots, sante-globale)
