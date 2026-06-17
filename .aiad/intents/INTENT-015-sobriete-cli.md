---
id: INTENT-015
title: Sobriété du CLI — noyau assumé, longue traîne extraite
status: active
author: Steeve Evers
date: 2026-06-11
specs:
  - SPEC-015-1
---

# INTENT-015 — Sobriété du CLI

> POURQUOI approprié par Steeve Evers le 2026-06-16 (Human Authorship) — passage
> `draft` → `active`. Prochaine étape : phase Research avant SPEC.

## Pourquoi maintenant

84 commandes CLI contredisent « Sobriété Intentionnelle » (« on construit le
nécessaire, non l'impressionnant »). Une large part relève de la longue traîne
(`obsidian`, `storybook`, `cert`, `marketplace`, `tour`, `repl`…) sans signal
d'usage connu. Le poids cognitif et de maintenance croît sans intention explicite.

## Pour qui

Les utilisateurs (lisibilité du produit) et le mainteneur (charge de maintenance).

## Objectif

- Définir un **noyau** (~25 commandes : cycle SDD + gouvernance + trace + dashboard)
  et extraire/déprécier la longue traîne en packs optionnels.
- Décider sur **données d'usage** (télémétrie locale opt-in), pas à l'intuition.
- Publier une matrice **enforced vs advisory** des garde-fous.

## Contraintes

- Décision pilotée par la donnée d'usage, pas par préférence.
- Rétro-compatibilité : dépréciations annoncées (retrait v2), pas de rupture brutale.

## Critère de drift

Ajout d'une commande au noyau sans intention explicite ni signal d'usage → drift
de sobriété.

## SPECs liées

- [x] SPEC-015-1 — Télémétrie d'usage des commandes (locale, opt-in) → `SPEC-015-1-telemetrie-usage.md` (EARS, draft, Research RESEARCH-016)
- [ ] SPEC-015-2 — Tiering core/extended/plugin + plan de dépréciation
- [ ] SPEC-015-3 — Matrice enforced/advisory + resserrage des bypass
