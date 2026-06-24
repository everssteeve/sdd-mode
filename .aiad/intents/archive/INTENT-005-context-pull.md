---
id: INTENT-005
title: Budget d'instructions push → pull (gouvernance par paths, §3.7)
status: archived
author: Steeve Evers
date: "2026-06-08"
specs: SPEC-005-1
archivedAt: "2026-06-24T07:17:03.657Z"
archivedBy: evers.steeve@gmail.com
archivedReason: archive done
---
# INTENT-005 — Budget d'instructions push → pull

## Pourquoi

Dex (cf. `docs/analyse-claude-code-best-practice.md` §2.4) : au-delà de ~150-200 instructions, l'adhérence du modèle s'effondre. Aujourd'hui SDD **pousse** en permanence : `CLAUDE.md` + `AGENTS.md` + 4 référentiels Tier 1 + matrices, tous injectés à froid. Cela dilue l'adhérence — le harness ne peut pas suivre des centaines d'instructions advisory en même temps. C'est l'inverse de la « Sobriété Intentionnelle ».

## Intention

Passer la gouvernance advisory du **push** (toujours en contexte) au **pull** (chargée à la demande, par zone de risque). La règle RGPD ne se charge que sur les fichiers de données, RGAA que sur l'UI, etc., via la primitive native `.claude/rules/*.md` à frontmatter `paths:`. Régler explicitement le budget de contexte (auto-compaction, plafond des descriptions de skills). **À coordonner avec §3.1** : on n'allège l'advisory que parce que le vrai garde-fou est déjà **enforced** (hooks `deny`/`Stop` + subagents read-only). Les deux couches sont complémentaires.

## Périmètre

- **SPEC-A** — règles `.claude/rules/{rgpd,rgaa,ai-act,rgesn}.md` à chargement `paths:` générées depuis la source unique `.aiad/gouvernance/` + réglages de budget dans les settings émis.
- **SPEC-B** — progressive disclosure (les skills chargent déjà leur corps à l'invocation ; lever principal = plafond des descriptions ≤ 1536). Minimalisation complète de `CLAUDE.md` = itération ultérieure (risque de régression élevé).

## Hors périmètre

- Refonte « CLAUDE.md minimal » + déplacement des tableaux de commandes vers `references/` — itération ultérieure, après audit des assertions de contenu existantes.
- Mesure fine du gain de tokens à froid (extension `bench`/coldstart) — ultérieur.
