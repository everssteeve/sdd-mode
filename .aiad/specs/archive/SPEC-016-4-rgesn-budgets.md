---
status: archived
archivedAt: "2026-06-24T09:49:36.978Z"
archivedBy: evers.steeve@gmail.com
archivedReason: FACT-008 — SPECs done sans frontmatter YAML détectées via fallback body
---
# SPEC-016-4 — Budgets de poids RGESN par page + CI

**Intent parent** : INTENT-016
**Research** : RESEARCH-020 — GO (100 %) · RESEARCH-022 — GO (100 %) — pré-exec
**Auteur** : Steeve Evers
**Date** : 2026-06-22
**Statut** : done
**Format** : EARS
**SQS** : 5/5 — Gate OUVERTE (2026-06-22)

---

## 1. Contexte

Le RGESN exige de maîtriser le poids transféré par page. Le dashboard dispose d'un parseur de budgets (`lib/dashboard/perf-budgets.js`) et d'un job CI `lint:size` pour les modules LOC, mais `.aiad/perf-budgets.md` n'est pas créé par défaut et aucun job CI ne vérifie le poids des pages HTML générées. Les pages varient de 5 KB (simple) à 25 KB (pm.html) hors assets partagés — des dérives silencieuses sont possibles. La SPEC-016-4 crée `.aiad/perf-budgets.md`, câble le vérificateur en CI, et garantit que tout dépassement est détecté et bloquant.

## 2. Comportement Attendu

### Input

- Pages HTML générées dans `dashboard/*.html` (17 pages + N intent-pages).
- Assets partagés : `dashboard/assets/app.js` (~14.6 KB gzippé), `dashboard/assets/style.css` (~16 KB).
- `.aiad/perf-budgets.md` — fichier de déclaration des budgets par page (à créer).
- `lib/dashboard/perf-budgets.js` — parseur existant qui lit `.aiad/perf-budgets.md`.

### Processing

**Extension du parseur `lib/dashboard/perf-budgets.js` (D1-B) :**

Le parseur accepte désormais les colonnes "Page", "Fichier", "Budget HTML (KB)" en plus des colonnes existantes ("Metric", "Budget", …). Le champ `fichier` est ajouté à chaque item retourné — rétrocompatible (null si absent). Regex ajoutées :

- `idxFichier` : `/^(fichier|file|path|chemin)/i`
- `idxBudgetHtml` : `/^budget html/i` (traité comme `idxBudget` si `idxBudget` absent)

**`.aiad/perf-budgets.md` (nouveau fichier) :**

Déclare un budget de poids HTML seul (hors assets partagés) par page, en KB non compressé. Budgets calibrés = tailles réelles mesurées × 1,2 (RESEARCH-022 — D2-B). Les assets partagés (`app.js` + `style.css`) sont comptabilisés une fois, séparément.

```markdown
# Budgets de poids RGESN — Dashboard

> Poids mesuré = taille du fichier HTML généré (non compressé), hors assets partagés.
> Budgets calibrés : tailles réelles × 1,2 (RESEARCH-022 — D2-B).
> Assets partagés (app.js + style.css) : budget global 45 KB.

| Page | Fichier | Budget HTML (KB) |
|------|---------|-----------------|
| Overview | dashboard/index.html | 30 |
| PM Cockpit | dashboard/pm.html | 630 |
| Intents | dashboard/intents.html | 90 |
| Specs | dashboard/specs.html | 35 |
| Traceability | dashboard/traceability.html | 255 |
| Graph | dashboard/graph.html | 45 |
| Metrics | dashboard/metrics.html | 11 |
| QA | dashboard/qa.html | 40 |
| ADRs | dashboard/adrs.html | 35 |
| Legal | dashboard/legal.html | 15 |
| Governance | dashboard/governance.html | 33 |
| Drifts | dashboard/drifts.html | 11 |
| Changelog | dashboard/changelog.html | 15 |
| Onboarding | dashboard/onboarding.html | 25 |
| Kanban | dashboard/kanban.html | 55 |
| SRE | dashboard/sre.html | 8 |
| DPO | dashboard/dpo.html | 11 |
| Intent-pages (par page) | dashboard/intent-INTENT-*.html | 17 |
| Assets partagés (total) | dashboard/assets/ | 45 |
```

**Script de vérification (`scripts/check-page-budgets.js`) :**
1. Lit `.aiad/perf-budgets.md` via `perf-budgets.js` (parseur étendu — D1-B).
2. Pour chaque page déclarée, mesure `fs.statSync(path).size` en KB (non compressé).
3. Affiche un tableau : page, taille réelle, budget, statut (OK / DÉPASSEMENT).
4. Exit 1 si au moins un dépassement ; exit 0 si tout est dans les budgets.
5. Si `.aiad/perf-budgets.md` est absent → affiche un avertissement et exit 0 (non bloquant, guard-rail progressif).

**CI (`.github/workflows/ci.yml`) :**
- Nouveau job `rgesn-budgets` exécuté après le job `test` : `node scripts/check-page-budgets.js`.
- Pré-requis : les pages doivent être générées (ajout d'un step `npx aiad-sdd dashboard` avant le check).

### Output

- `.aiad/perf-budgets.md` — nouveau fichier de budgets.
- `scripts/check-page-budgets.js` — nouveau script de vérification.
- `.github/workflows/ci.yml` — job `rgesn-budgets` ajouté.

### Cas limites

- **Fichier absent** : si `.aiad/perf-budgets.md` est absent, le script exit 0 avec avertissement — pas de régression pour les projets qui ne l'ont pas encore créé.
- **Page manquante** : si une page déclarée dans `.aiad/perf-budgets.md` n'existe pas dans `dashboard/`, le script émet une erreur nommée et exit 1 (la déclaration doit être cohérente avec la réalité).
- **Intent-pages** : le budget par intent-page est mutualisé (5 KB max). Le script vérifie la moyenne et le maximum parmi les intent-pages générées.
- **graph.html** : charge D3 via CDN — le poids HTML seul (sans CDN) est mesuré, le CDN est exclu du budget (zéro-dep runtime ne s'applique pas au JS client côté browser).

## 3. Critères d'Acceptation (EARS)

### CA-001 — Exit 1 sur dépassement de budget

> Pattern : Event-driven

`WHEN \`scripts/check-page-budgets.js\` detects that a generated page exceeds its declared budget in \`.aiad/perf-budgets.md\`, the script SHALL exit with code 1.`

- [x] Implémenté
- [x] Testé : `test/check-page-budgets.test.js::exceeds-budget-exits-1`

### CA-001b — Affichage du dépassement

> Pattern : Event-driven

`WHEN \`scripts/check-page-budgets.js\` detects that a generated page exceeds its declared budget, the script SHALL display the page filename, actual size in KB, and declared budget in KB.`

- [x] Implémenté
- [x] Testé : `test/check-page-budgets.test.js::exceeds-budget-display`

### CA-002 — Exit 0 si fichier budgets absent

> Pattern : IF/THEN (Unwanted behaviour)

`IF \`.aiad/perf-budgets.md\` is absent, THEN \`scripts/check-page-budgets.js\` SHALL exit with code 0.`

- [x] Implémenté
- [x] Testé : `test/check-page-budgets.test.js::missing-file-exits-0`

### CA-002b — Avertissement si fichier budgets absent

> Pattern : IF/THEN (Unwanted behaviour)

`IF \`.aiad/perf-budgets.md\` is absent, THEN \`scripts/check-page-budgets.js\` SHALL display the warning "perf-budgets.md absent — vérification ignorée".`

- [x] Implémenté
- [x] Testé : `test/check-page-budgets.test.js::missing-file-warning`

### CA-003 — Exit 1 si page déclarée absente

> Pattern : IF/THEN (Unwanted behaviour)

`IF \`.aiad/perf-budgets.md\` declares a page path that does not exist in the \`dashboard/\` directory, THEN \`scripts/check-page-budgets.js\` SHALL exit with code 1.`

- [x] Implémenté
- [x] Testé : `test/check-page-budgets.test.js::missing-page-exits-1`

### CA-003b — Affichage du chemin manquant

> Pattern : IF/THEN (Unwanted behaviour)

`IF \`.aiad/perf-budgets.md\` declares a page path that does not exist in the \`dashboard/\` directory, THEN \`scripts/check-page-budgets.js\` SHALL display the missing path.`

- [x] Implémenté
- [x] Testé : `test/check-page-budgets.test.js::missing-page-display`

### CA-004 — Exécution du job CI rgesn-budgets

> Pattern : Ubiquitous

`The CI pipeline SHALL execute \`node scripts/check-page-budgets.js\` after generating the dashboard.`

- [x] Implémenté
- [x] Testé : job `rgesn-budgets` dans `.github/workflows/ci.yml`

### CA-004b — Échec CI sur exit 1

> Pattern : Event-driven

`WHEN \`scripts/check-page-budgets.js\` exits with code 1, the CI pipeline SHALL fail the build.`

- [x] Implémenté
- [x] Testé : job `rgesn-budgets` dans `.github/workflows/ci.yml`

### CA-005 — Mesure des assets partagés

> Pattern : Ubiquitous

`The \`scripts/check-page-budgets.js\` script SHALL measure the combined uncompressed size of \`dashboard/assets/app.js\` and \`dashboard/assets/style.css\`.`

- [x] Implémenté
- [x] Testé : `test/check-page-budgets.test.js::shared-assets-measure`

### CA-005b — Dépassement du budget assets partagés

> Pattern : IF/THEN (Unwanted behaviour)

`IF the combined uncompressed size of \`dashboard/assets/app.js\` and \`dashboard/assets/style.css\` exceeds 45 KB, THEN \`scripts/check-page-budgets.js\` SHALL exit with code 1.`

- [x] Implémenté
- [x] Testé : `test/check-page-budgets.test.js::shared-assets-budget`

### CA-006 — Mesure des intent-pages

> Pattern : Ubiquitous

`The \`scripts/check-page-budgets.js\` script SHALL measure the uncompressed size of each generated intent-page in the \`dashboard/\` directory.`

- [x] Implémenté
- [x] Testé : `test/check-page-budgets.test.js::intent-pages-measure`

### CA-006b — Dépassement budget intent-page

> Pattern : IF/THEN (Unwanted behaviour)

`IF any single intent-page exceeds the per-page budget declared in \`.aiad/perf-budgets.md\`, THEN \`scripts/check-page-budgets.js\` SHALL exit with code 1.`

- [x] Implémenté
- [x] Testé : `test/check-page-budgets.test.js::intent-pages-max-budget`

## 4. Interface / API

```js
// scripts/check-page-budgets.js
// node scripts/check-page-budgets.js [--root <path>]
// exit 0 → tous dans les budgets (ou perf-budgets.md absent)
// exit 1 → au moins un dépassement ou page déclarée manquante

// Sortie exemple :
// Page                    Taille réelle  Budget  Statut
// dashboard/index.html    24.4 KB        30 KB   OK
// dashboard/pm.html       521.9 KB       630 KB  OK
// dashboard/assets/       34.0 KB        45 KB   OK

// lib/dashboard/perf-budgets.js (parseur étendu — D1-B)
// Ancienne signature préservée ; champ `fichier` ajouté (null si colonne absente)
export function lirePerfBudgets(racine) → { fichier, total, budgets: Array<{ metric, budget, actuel, date, etat, fichier }> }
```

```markdown
<!-- .aiad/perf-budgets.md — format attendu par le parseur -->
| Page | Fichier | Budget HTML (KB) |
|------|---------|-----------------|
| Overview | dashboard/index.html | 20 |
```

## 5. Dépendances

- SPEC-016-1 — structure `views/` stabilisée avant de mesurer les pages finales
- `lib/dashboard/perf-budgets.js` — parseur existant (à réutiliser sans modification)
- `.github/workflows/ci.yml`
- Zéro nouvelle dépendance runtime (`fs.statSync` natif Node.js)

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~300 tokens
- Cette SPEC : ~700 tokens
- Fichiers source pertinents : `lib/dashboard/perf-budgets.js`, `dashboard/` (tailles actuelles), `.github/workflows/ci.yml`
- **Total estimé** : ~2 000 tokens

## 7. Definition of Output Done (DoOD)

- [x] Code + lint passing
- [x] `npm test` passe (nouveaux tests `check-page-budgets.test.js`) — 10/10 vert
- [x] **EARS lint : 0 violation** (skill `ears-validator`) — Gate 5/5
- [x] Job CI `rgesn-budgets` ajouté dans `.github/workflows/ci.yml`
- [x] `.aiad/perf-budgets.md` créé avec budgets calibrés (D2-B × 1,2)
- [x] Annotations `@spec SPEC-016-4-rgesn-budgets @intent INTENT-016 @governance AIAD-RGESN` posées sur `check-page-budgets.js`
- [x] SPEC mise à jour — tous CAs cochés (Drift Lock)
- [x] Gouvernance RGESN vérifiée — budgets de poids déclarés et vérifiés en CI
