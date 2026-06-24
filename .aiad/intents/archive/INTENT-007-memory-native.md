---
id: INTENT-007
title: Memory native — promotion from logs + auto-curation + anti dock rot (§3.8)
status: archived
author: Steeve Evers
date: "2026-06-09"
specs: SPEC-007-1
archivedAt: "2026-06-24T07:17:03.663Z"
archivedBy: evers.steeve@gmail.com
archivedReason: archive done
---
# INTENT-007 — Memory native

## Pourquoi

Les Lessons Learned d'`AGENT-GUIDE.md` et les traces `.aiad/facts/` sont un markdown que le modèle peut ignorer et que **rien ne curate**. L'analyse (`docs/analyse-claude-code-best-practice.md` §2.2 « Agent memory », §2.4) montre la primitive native `memory:` (store markdown auto-curaté) et deux principes : mémoire **from logs, pas from one transcript** (« make the button pink » ≠ « tous les boutons roses ») et **anti dock rot** (ne pas garder les livrables indéfiniment en contexte chaud).

## Intention

Donner au cycle SDD une mémoire **honnête et sobre** : on ne promeut un apprentissage que s'il **récurre sur plusieurs sources** (jamais sur un cas isolé), la promotion exige un **auteur humain** (Human Authorship — la décision d'apprendre ne se délègue pas), et le store s'auto-cure (éclatement par thème au-delà de 200 lignes). En miroir, un cycle anti dock rot sort du contexte chaud les artefacts livrés et clos.

## Périmètre

- **SPEC-A** — `lib/memory.js` : collecte des observations (facts + drifts), proposition de promotions (récurrence ≥ seuil, cross-sources), promotion fail-closed sans auteur, auto-curation (> 200 lignes → thèmes + index), store `.aiad/memory/MEMORY.md`. CLI `aiad-sdd memory <propose|promote|curate>`.
- **SPEC-B** — cycle anti dock rot : `listerLivrables` (status done, flag `safe` si non référencé par du code vivant) + CLI `aiad-sdd archive --delivered [--apply]`, rappel dans `/aiad health`.

## Hors périmètre

- Migration destructive des Lessons d'`AGENT-GUIDE.md` : la mémoire native est **additive** ; `AGENT-GUIDE.md` reste la source du contexte permanent stable.
- Collecte automatique multi-session via la primitive harness `memory: project` des subagents (dépend du runtime) — le store projet `.aiad/memory/` en est l'équivalent versionné.
