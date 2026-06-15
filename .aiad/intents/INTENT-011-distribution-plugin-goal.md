---
id: INTENT-011
title: Distribution plugin + boucles /goal + toggles de hooks (§3.13)
status: done
author: Steeve Evers
date: 2026-06-09
specs: SPEC-011-1
---

# INTENT-011 — Distribution plugin + /goal + toggles de hooks

## Pourquoi

Trois leviers de diffusion/automatisation (`docs/analyse-claude-code-best-practice.md` §2.4, §2.5) : (1) packager SDD comme **plugin Claude Code** (distribution à l'échelle via marketplace) ; (2) exploiter les boucles **`/goal`** évaluées sur une condition machine-vérifiable (« itérer jusqu'à SQS ≥ 4/5 ») ; (3) une **config plate de toggles** (`hooks-config.json` + `.local.json`) pour activer/désactiver les mécanismes par environnement.

## Intention

Rendre SDD **installable et pilotable** sans friction : un plugin natif additif (la voie npm reste par défaut), des recettes `/goal` dont la condition est un **verdict CLI déterministe** (§3.4, jamais un jugement flou), et des toggles par environnement — **sans jamais** pouvoir désactiver silencieusement un veto de gouvernance Tier 1 (§3.1, fail-closed).

## Périmètre

- **SPEC-A** — toggles : `lib/hooks-config.js` (chargement + précédence local, protection gouvernance), CLI `aiad-sdd hooks-config <show|check>`, lecture par les hooks togglables (drift-lock, skill-usage…), `.local.json` gitignored, recettes `/goal` (doc).
- **SPEC-B** — packaging plugin : `.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json`, doc d'installation README.

## Hors périmètre

- Câblage du toggle dans la totalité des hooks P0 historiques (démontré sur drift-lock + skill-usage ; mécanique identique pour les autres).
- Publication effective sur un marketplace tiers (manifeste fourni ; publication = action de release).
