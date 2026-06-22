---
id: FACT-005
title: Contraste insuffisant sur .kicker (WCAG 1.4.3 — gold-600 sur fond clair)
date: 2026-06-22
discovered_by: SPEC-013-4b (gate RGAA — pa11y-ci v4, premier audit)
severity: medium
status: open
linked_spec: SPEC-013-4b
---

# FACT-005 — Contraste insuffisant sur `.kicker`

## Écart constaté

Lors du premier audit pa11y-ci en exécution de SPEC-013-4b, 6 violations WCAG 2.1 AA
ont été détectées sur les pages d'accueil (`site/fr/index.html`, `site/en/index.html`) :

- **Code** : `WCAG2AA.Principle1.Guideline1_4.1_4_3.G18.Fail`
- **Critère** : 1.4.3 — Contraste minimum (ratio 4.5:1 pour texte < 18pt)
- **Éléments** : tous les `<p class="kicker">` des sections de la page d'accueil
- **Valeur actuelle** : `--gold-600: #c5860f` → ratio ~2.9:1 sur fonds clairs
- **Valeur requise** : ≥ 4.5:1 (WCAG AA) → couleur approximative `#7e5300` ou similaire

Un 6ème élément ajoute une violation critique : `<code class="install" style="background:var(--navy-900);border:none">` avec un ratio de 1.05:1 (texte presque invisible).

## Fichiers concernés

- `site/assets/css/main.css` : `.kicker { color: var(--gold-600); }` + `--gold-600: #c5860f`
- `site/fr/index.html`, `site/en/index.html` (toutes les `.kicker` des sections)

## Mitigation temporaire

Violation ajoutée au `defaults.ignore` de `.pa11yci.json` en tant que baseline historique
(SPEC-013-4b §4, décision 2026-06-22). Le gate RGAA bloquera toute **nouvelle** violation
de contraste sur d'autres éléments ou pages.

## Correction attendue

1. Remplacer `--gold-600: #c5860f` par une couleur ≥ 4.5:1 sur fond blanc (ex. `#7e5300`).
2. Corriger l'élément `.install` code block (contraste 1.05:1 — texte invisible).
3. Retirer `WCAG2AA.Principle1.Guideline1_4.1_4_3.G18.Fail` du `defaults.ignore` de `.pa11yci.json`.
4. Vérifier les variantes dark mode si applicable.
