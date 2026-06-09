---
id: INTENT-006
title: Canary suite + alignement des références modèles (§3.10)
status: active
author: Steeve Evers
date: 2026-06-09
specs: SPEC-006-1
---

# INTENT-006 — Canary suite + alignement des références modèles

## Pourquoi

« Frozen weights ≠ frozen behavior » (`docs/analyse-claude-code-best-practice.md` §2.2) : la variance de serving mesurée (±8-14 % — bugs infra, routing MoE, post-training silencieux, context pollution comme cause #1) interdit de distinguer une **régression réelle** d'un **bruit de serving**. Sans point de référence stable, `/aiad retro` risque de transformer du bruit en Lesson Learned. Par ailleurs, les références documentaires (« Opus 4.7 / 1M ») dérivent par rapport à l'état réel (Opus 4.8, Claude Code v2.1.168).

## Intention

Donner au cycle SDD un **repère empirique stable** : une canary suite figée rejouée régulièrement, qui sépare nettement deux régimes — la **stabilité déterministe** (verdicts CLI 100 % reproductibles ; tout écart = bug code) et la **dispersion modèle** (volets génératifs tolérés dans une bande). Et aligner les références modèles sur l'état courant. Empirisme sans Concession : on ne mémorise une régression que si elle sort de la bande de bruit.

## Périmètre

- **SPEC-A** — canary suite déterministe : `lib/canary.js` (parsing de cas figés, évaluation deterministic/generative, agrégat PASS/CONDITIONAL/FAIL/JNSP), schéma `canary.schema.json`, CLI `aiad-sdd canary`, cas figés `.aiad/canary/cases/`, snapshot modèle épinglé dans `config.yml`, workflow CI nocturne, lien `/aiad retro`.
- **SPEC-B** — alignement des références modèles : remplacer `Opus 4.7` → `Opus 4.8` dans la documentation (CLAUDE.md, SDDMode.md, GUIDE.md, corps de commandes).

## Hors périmètre

- Exécution réelle des volets génératifs (collecte d'échantillons modèle) : la canary lit des échantillons figés ; sans échantillon, le volet est `JNSP` (non mesuré), jamais inventé.
- §3.8 (memory) et §3.9 (graphe Tasks) — Intents/SPECs distincts de P2.
