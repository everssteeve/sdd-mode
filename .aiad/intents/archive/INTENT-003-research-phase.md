---
id: INTENT-003
title: Phase Research + Discovery obligatoire avant la SPEC (§3.5)
status: archived
author: Steeve Evers
date: "2026-06-08"
specs: SPEC-003-1
archivedAt: "2026-06-24T07:17:03.650Z"
archivedBy: evers.steeve@gmail.com
archivedReason: archive done
---
# INTENT-003 — Phase Research + Discovery obligatoire avant la SPEC

## Pourquoi

Le cycle SDD score aujourd'hui la *qualité de la SPEC* (SQS) mais **jamais la viabilité de l'intention** elle-même. Le mapping RPI↔SDD (cf. `docs/analyse-claude-code-best-practice.md` §2.3) montre un trou : `RESEARCH.md + GO/NO-GO` n'a aucun équivalent SDD. De plus, l'absence de **Discovery codebase obligatoire** avant la spécification est exactement le piège « specs-to-code » dénoncé par Matt/Dex/Karpathy : « le code est ton champ de bataille ». Spécifier sans regarder le code réel produit des SPECs déconnectées qui dérivent à l'exécution.

## Intention

Intercaler une phase **Research → GO/NO-GO** entre l'Intent et la SPEC, ancrée dans le code via un **Discovery obligatoire** (agent `Explore` read-only). La Research *informe* ; **l'humain tranche** le GO/NO-GO (Human Authorship — la décision d'aller ou non ne se délègue pas). Le passage en SPEC/exécution devient conditionné à une Research liée prête (Discovery ancré, verdict GO/CONDITIONAL GO).

## Périmètre

- **SPEC-A** — gate Research GO/NO-GO déterministe (`GO | CONDITIONAL GO | DEFER | NO-GO`), artefact `RESEARCH-NNN`, Discovery ancré dans le code, commande `/sdd research`, scorer CLI.
- **SPEC-B** — prérequis Discovery enforced : CLI `discovery-check`, hook `UserPromptSubmit` sur `/sdd spec|exec`, prérequis dans les corps de commande, cycle documenté `Intent → Research → SPEC → …`.

## Hors périmètre

- §3.6 (exécution phasée) et §3.7 (contexte pull) — Intents/SPECs ultérieurs de P1.
- Obligation dure et universelle de la Research : volontairement **proportionnée** (mode `--fast` pour les intentions simples ; court-circuit explicite tracé admis).
