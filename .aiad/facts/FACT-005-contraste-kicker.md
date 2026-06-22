---
id: FACT-005
title: Contraste insuffisant sur .kicker et .install (WCAG 1.4.3)
date: 2026-06-22
discovered_by: SPEC-013-4b (gate RGAA — pa11y-ci v4, premier audit)
severity: critique (A) + majeur (B)
status: partiellement résolu
linked_spec: SPEC-013-4b
linked_intent: INTENT-025
---

# FACT-005 — Contraste insuffisant sur `.kicker` et `.install`

## Écart constaté

Lors du premier audit pa11y-ci en exécution de SPEC-013-4b, violations WCAG 2.1 AA
sur les pages d'accueil (`site/fr/index.html`, `site/en/index.html`) :

### A — `.install` code block (critique — ratio 1.05:1)

- **Élément** : `<code class="install" style="background:var(--navy-900);border:none">`
- **Cause** : fond `--navy-900: #0a1f3d` (très sombre) sans couleur de texte explicite → héritage sombre → invisible
- **Statut** : ✅ **Patché** (2026-06-22) — `color:#fff` ajouté au style inline dans `fr/index.html` et `en/index.html`

### B — `.kicker` (majeur — ratio ~2.9:1)

- **Code** : `WCAG2AA.Principle1.Guideline1_4.1_4_3.G18.Fail`
- **Critère** : 1.4.3 — Contraste minimum (ratio 4.5:1 pour texte < 18pt)
- **Éléments** : tous les `<p class="kicker">` + `.pill.gold`
- **Cause** : `--gold-600: #c5860f` → ~2.9:1 sur fond blanc, ~2.6:1 sur `#fbeecd`
- **Valeur requise** : ≥ 4.5:1 — candidate : `#7e5300` (6.0:1 sur blanc, 5.3:1 sur `#fbeecd`)
- **Statut** : ⏳ **En allowlist temporaire** → INTENT-025 créé pour la correction design

## Fichiers concernés

- `site/assets/css/main.css` : `--gold-600: #c5860f`, `.kicker { color: var(--gold-600) }`, `.pill.gold { color: var(--gold-600) }`
- `site/fr/index.html`, `site/en/index.html` : éléments `.install` et `.kicker`

## Mitigation

- A patché directement.
- B : `WCAG2AA.Principle1.Guideline1_4.1_4_3.G18.Fail` dans `defaults.ignore` de `.pa11yci.json` (baseline historique jusqu'à INTENT-025).

## Correction restante (INTENT-025)

1. Remplacer `--gold-600: #c5860f` par `#7e5300` (ou valeur validée ≥ 4.5:1 dans les deux contextes).
2. Retirer `WCAG2AA.Principle1.Guideline1_4.1_4_3.G18.Fail` de `defaults.ignore` dans `.pa11yci.json`.
3. Vérifier le rendu visuel des `.pill.gold` et `.kicker` avec la nouvelle teinte.
