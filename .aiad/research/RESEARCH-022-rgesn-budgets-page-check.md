---
id: RESEARCH-022
intent: INTENT-016
spec: SPEC-016-4
author: Steeve Evers
date: 2026-06-22
status: done
verdict: GO
confidence: 100
---

# RESEARCH-022 — RGESN budgets de poids par page : Discovery pré-exécution SPEC-016-4

> Phase Research ciblée sur SPEC-016-4 — vérification exécution-readiness après
> rédaction de la SPEC. RESEARCH-020 avait validé la viabilité générale de
> INTENT-016 ; cette Research ancre les deux inconnues bloquantes identifiées
> à la lecture du code réel.

## Discovery (ancrage code — agent Explore, read-only)

### Parseur existant

- `lib/dashboard/perf-budgets.js:59-83` — `lirePerfBudgets(racineProjet, options)` — retourne `{ fichier, total, budgets: Array<{metric, budget, actuel, date, etat}> }`
- `lib/dashboard/perf-budgets.js:31-34` — colonnes reconnues : "Metric", "Budget", "Actuel", "Date" — regex case-insensitive
- **Inconnue levée** : la SPEC-016-4 propose "Page"/"Fichier"/"Budget HTML (KB)" — incompatible sans extension

### Pages HTML générées (tailles non compressées)

| Fichier | Taille réelle |
|---------|--------------|
| `dashboard/pm.html` | 521.9 KB |
| `dashboard/traceability.html` | 211.6 KB |
| `dashboard/intents.html` | 75.3 KB |
| `dashboard/graph.html` | 37.3 KB |
| `dashboard/kanban.html` | 43.0 KB |
| `dashboard/qa.html` | 32.7 KB |
| `dashboard/specs.html` | 28.9 KB |
| `dashboard/adrs.html` | 28.4 KB |
| `dashboard/governance.html` | 27.2 KB |
| `dashboard/index.html` | 24.4 KB |
| `dashboard/onboarding.html` | 20.3 KB |
| `dashboard/changelog.html` | 11.8 KB |
| `dashboard/legal.html` | 11.8 KB |
| `dashboard/metrics.html` | 8.9 KB |
| `dashboard/drifts.html` | 8.9 KB |
| `dashboard/dpo.html` | 8.5 KB |
| `dashboard/sre.html` | 6.1 KB |
| intent-pages (max) | 13.5 KB |
| `dashboard/assets/` (app.js + style.css) | 34.0 KB |

- **Inconnue levée** : les budgets originaux de la SPEC (30 KB pour pm.html, 10 KB pour intents.html) ne reflètent pas la réalité — les pages embarquent des données JSON volumineuses. Budgets aspirationnels → CI rouge immédiatement.

### CI

- `.github/workflows/ci.yml:54` — dashboard déjà généré dans job `validate-schema` (`npx aiad-sdd dashboard --quiet`)
- `.github/workflows/ci.yml` — aucun job `rgesn-budgets` existant — à ajouter

### À créer

- `scripts/check-page-budgets.js` — inexistant
- `.aiad/perf-budgets.md` — inexistant

---

## Faisabilité

**Réalisable sans risque de régression.** Trois livrables isolés :

1. Extension `perf-budgets.js` — ajout de colonnes "Page"/"Fichier"/"Budget HTML (KB)" sans casser l'API existante (ajout conditionnel, ancien format toujours supporté)
2. Nouveau script `check-page-budgets.js` — Node.js natif, `fs.statSync`, zéro dépendance
3. Nouveau job CI `rgesn-budgets` — après `test`, génère le dashboard puis exécute le script

---

## Risques & inconnues

Aucune inconnue ouverte après les décisions D1-B et D2-B.

**R1 — Extension parseur** : ajouter colonnes "Fichier" au parseur risque de casser les consommateurs existants si la signature change. Mitigation : retourner `{ ...existant, fichier: string|null }` sur chaque budget item — rétrocompatible.

**R2 — Budgets calibrés à +20 %** : si une page grandit naturellement, le budget tient 20 % avant de casser. À revérifier à chaque refactor majeur.

---

## Verdict : GO (confidence: 100 %)

> Tranché par **Steeve Evers** — 2026-06-22.
> Décisions : D1-B (extension parseur) · D2-B (budgets calibrés réel +20 %).
> Verdict machine : PASS (exit 0) — `/sdd exec` autorisé.

## Conditions (si CONDITIONAL GO)

_Aucune — verdict GO franc._
