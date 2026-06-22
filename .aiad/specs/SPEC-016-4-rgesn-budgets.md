# SPEC-016-4 — Budgets de poids RGESN par page + CI

**Intent parent** : INTENT-016
**Research** : RESEARCH-020 — GO (100 %)
**Auteur** : Steeve Evers
**Date** : 2026-06-22
**Statut** : draft
**Format** : EARS
**SQS** : [À évaluer via /sdd gate]

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

**`.aiad/perf-budgets.md` (nouveau fichier) :**

Déclare un budget de poids HTML seul (hors assets partagés) par page, en KB non compressé. Les assets partagés (`app.js` + `style.css`) sont comptabilisés une fois, séparément.

```markdown
# Budgets de poids RGESN — Dashboard

> Poids mesuré = taille du fichier HTML généré (non compressé), hors assets partagés.
> Assets partagés (app.js + style.css) : budget global 60 KB.

| Page | Fichier | Budget HTML (KB) |
|------|---------|-----------------|
| Overview | dashboard/index.html | 20 |
| PM Cockpit | dashboard/pm.html | 30 |
| Intents | dashboard/intents.html | 10 |
| Specs | dashboard/specs.html | 10 |
| Traceability | dashboard/traceability.html | 15 |
| Graph | dashboard/graph.html | 15 |
| Metrics | dashboard/metrics.html | 15 |
| QA | dashboard/qa.html | 20 |
| ADRs | dashboard/adrs.html | 30 |
| Legal | dashboard/legal.html | 10 |
| Governance | dashboard/governance.html | 15 |
| Drifts | dashboard/drifts.html | 10 |
| Changelog | dashboard/changelog.html | 10 |
| Onboarding | dashboard/onboarding.html | 25 |
| Kanban | dashboard/kanban.html | 10 |
| SRE | dashboard/sre.html | 10 |
| DPO | dashboard/dpo.html | 10 |
| Intent-pages (par page) | dashboard/intents/*.html | 5 |
| Assets partagés (total) | dashboard/assets/ | 60 |
```

**Script de vérification (`scripts/check-page-budgets.js`) :**
1. Lit `.aiad/perf-budgets.md` via `perf-budgets.js` (parseur existant).
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

- [ ] Implémenté
- [ ] Testé : `test/check-page-budgets.test.js::exceeds-budget-exits-1`

### CA-001b — Affichage du dépassement

> Pattern : Event-driven

`WHEN \`scripts/check-page-budgets.js\` detects that a generated page exceeds its declared budget, the script SHALL display the page filename, actual size in KB, and declared budget in KB.`

- [ ] Implémenté
- [ ] Testé : `test/check-page-budgets.test.js::exceeds-budget-display`

### CA-002 — Exit 0 si fichier budgets absent

> Pattern : IF/THEN (Unwanted behaviour)

`IF \`.aiad/perf-budgets.md\` is absent, THEN \`scripts/check-page-budgets.js\` SHALL exit with code 0.`

- [ ] Implémenté
- [ ] Testé : `test/check-page-budgets.test.js::missing-file-exits-0`

### CA-002b — Avertissement si fichier budgets absent

> Pattern : IF/THEN (Unwanted behaviour)

`IF \`.aiad/perf-budgets.md\` is absent, THEN \`scripts/check-page-budgets.js\` SHALL display the warning "perf-budgets.md absent — vérification ignorée".`

- [ ] Implémenté
- [ ] Testé : `test/check-page-budgets.test.js::missing-file-warning`

### CA-003 — Exit 1 si page déclarée absente

> Pattern : IF/THEN (Unwanted behaviour)

`IF \`.aiad/perf-budgets.md\` declares a page path that does not exist in the \`dashboard/\` directory, THEN \`scripts/check-page-budgets.js\` SHALL exit with code 1.`

- [ ] Implémenté
- [ ] Testé : `test/check-page-budgets.test.js::missing-page-exits-1`

### CA-003b — Affichage du chemin manquant

> Pattern : IF/THEN (Unwanted behaviour)

`IF \`.aiad/perf-budgets.md\` declares a page path that does not exist in the \`dashboard/\` directory, THEN \`scripts/check-page-budgets.js\` SHALL display the missing path.`

- [ ] Implémenté
- [ ] Testé : `test/check-page-budgets.test.js::missing-page-display`

### CA-004 — Exécution du job CI rgesn-budgets

> Pattern : Ubiquitous

`The CI pipeline SHALL execute \`node scripts/check-page-budgets.js\` after generating the dashboard.`

- [ ] Implémenté
- [ ] Testé : job `rgesn-budgets` dans `.github/workflows/ci.yml`

### CA-004b — Échec CI sur exit 1

> Pattern : Event-driven

`WHEN \`scripts/check-page-budgets.js\` exits with code 1, the CI pipeline SHALL fail the build.`

- [ ] Implémenté
- [ ] Testé : job `rgesn-budgets` dans `.github/workflows/ci.yml`

### CA-005 — Mesure des assets partagés

> Pattern : Ubiquitous

`The \`scripts/check-page-budgets.js\` script SHALL measure the combined uncompressed size of \`dashboard/assets/app.js\` and \`dashboard/assets/style.css\`.`

- [ ] Implémenté
- [ ] Testé : `test/check-page-budgets.test.js::shared-assets-measure`

### CA-005b — Dépassement du budget assets partagés

> Pattern : IF/THEN (Unwanted behaviour)

`IF the combined uncompressed size of \`dashboard/assets/app.js\` and \`dashboard/assets/style.css\` exceeds 60 KB, THEN \`scripts/check-page-budgets.js\` SHALL exit with code 1.`

- [ ] Implémenté
- [ ] Testé : `test/check-page-budgets.test.js::shared-assets-budget`

### CA-006 — Mesure des intent-pages

> Pattern : Ubiquitous

`The \`scripts/check-page-budgets.js\` script SHALL measure the uncompressed size of each generated intent-page in the \`dashboard/\` directory.`

- [ ] Implémenté
- [ ] Testé : `test/check-page-budgets.test.js::intent-pages-measure`

### CA-006b — Dépassement budget intent-page

> Pattern : IF/THEN (Unwanted behaviour)

`IF any single intent-page exceeds the per-page budget declared in \`.aiad/perf-budgets.md\`, THEN \`scripts/check-page-budgets.js\` SHALL exit with code 1.`

- [ ] Implémenté
- [ ] Testé : `test/check-page-budgets.test.js::intent-pages-max-budget`

## 4. Interface / API

```js
// scripts/check-page-budgets.js
// node scripts/check-page-budgets.js [--root <path>]
// exit 0 → tous dans les budgets (ou perf-budgets.md absent)
// exit 1 → au moins un dépassement ou page déclarée manquante

// Sortie exemple :
// Page                    Taille réelle  Budget  Statut
// dashboard/index.html    17.2 KB        20 KB   OK
// dashboard/pm.html       32.1 KB        30 KB   ⚠ DÉPASSEMENT (+2.1 KB)
// dashboard/assets/       55.0 KB        60 KB   OK

// lib/dashboard/perf-budgets.js (parseur existant)
export function lirePerfBudgets(racine) → Array<{ page, fichier, budgetKo }>
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

- [ ] Code + lint passing
- [ ] `npm test` passe (nouveaux tests `check-page-budgets.test.js`)
- [ ] **EARS lint : 0 violation** (skill `ears-validator`)
- [ ] Job CI `rgesn-budgets` passe sur la branche (toutes les pages dans les budgets déclarés)
- [ ] `.aiad/perf-budgets.md` commité avec les budgets initiaux
- [ ] Annotations `@spec SPEC-016-4 @governance AIAD-RGESN` posées sur `check-page-budgets.js`
- [ ] SPEC mise à jour si écart (Drift Lock)
- [ ] Gouvernance RGESN vérifiée — budgets de poids déclarés et vérifiés en CI
