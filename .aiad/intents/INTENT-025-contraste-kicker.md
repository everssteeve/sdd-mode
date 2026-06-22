---
id: INTENT-025
title: Corriger le contraste des kickers et pills gold (WCAG 1.4.3)
author: Steeve Evers
date: 2026-06-22
status: open
source: FACT-005
---

# INTENT-025 — Corriger le contraste des kickers et pills gold

## Intention

Le gate RGAA AA (SPEC-013-4b) a détecté que la couleur `--gold-600: #c5860f` ne respecte
pas le critère WCAG 1.4.3 (contraste minimum 4.5:1 pour le texte < 18pt) dans deux
contextes :

- `.kicker` : labels uppercase sur fond blanc → ratio ~2.9:1 (besoin 4.5:1)
- `.pill.gold` : texte sur fond `#fbeecd` → ratio ~2.6:1 (besoin 4.5:1)

Je veux remplacer `--gold-600` par une valeur qui passe WCAG AA dans les deux contextes
**sans dénaturer le style doré du site**. La couleur candidate `#7e5300` donne 6.0:1 sur
blanc et 5.3:1 sur `#fbeecd` — elle reste dans la famille dorée/ambrée.

## Pourquoi maintenant

- Le gate RGAA est opérationnel depuis SPEC-013-4b — la violation est visible dans le rapport CI.
- L'élément `.install` (ratio 1.05:1, texte invisible) a été patché en urgence (FACT-005).
- La correction du contraste `.kicker` est la dernière violation baseline en allowlist.
- Retirer `WCAG2AA.Principle1.Guideline1_4.1_4_3.G18.Fail` de l'allowlist est l'objectif final.

## Critère de succès

- `--gold-600` remplacé par une valeur ≥ 4.5:1 sur fond blanc ET sur `#fbeecd`
- `.pa11yci.json` : `defaults.ignore` vide (gate strict, aucune violation tolérée)
- Gate RGAA passe sur les 57 pages sans allowlist
