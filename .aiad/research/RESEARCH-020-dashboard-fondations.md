---
id: RESEARCH-020
intent: INTENT-016
author: Steeve Evers
date: 2026-06-22
status: done
verdict: GO
confidence: 100
---

# RESEARCH-020 — Dashboard exemplaire : fondations accessibles, sobres, maintenables  (← INTENT-016)

> Phase Research (§3.5) — entre l'Intent et la SPEC. Elle ne score PAS la
> qualité d'une SPEC (c'est le rôle du SQS) mais la **viabilité de l'intention**,
> ancrée dans le code réel. La Research informe ; **l'humain tranche le GO/NO-GO**.
> Verdict machine : `npx aiad-sdd research RESEARCH-020`.

## Discovery (ancrage code — agent Explore, read-only)

### Zones critiques cartographiées

**Orchestration (à refactoriser en model/)**
- `lib/dashboard.js:279` — `await collecterEnrichi()` — 165 lignes, 70+ appels calculateurs en cascade
- `lib/dashboard.js:408-572` — logique métier mélangée à l'agrégation de données
- `lib/dashboard.js:185-202` — dictionnaire `RENDERERS` (17 pages) — point d'entrée refactor views/

**Rendu monolithique (à éclater en views/ + ui/)**
- `lib/dashboard/render.js:1003` LOC — 7 renderers de pages + 120+ helpers dans 1 fichier
- `lib/dashboard/render.js:27-155` — HTML helpers (escape, badge, sparkline, distributionBar, sqsBadge, freshnessBadge)
- `lib/dashboard/render.js:192-242` — `layout()` — structure HTML complète, nav 17 pages
- `lib/dashboard/render.js:374-971` — pageOverview, pageIntents, pageSpecs, pageTraceability, pageMetrics, pageDrifts, pageChangelog
- Budget exceptionnel déclaré : `.aiad-size-budget.json:4` → render.js = 860 LOC max (actuellement à la limite)

**CSS/JS client (à auditer WCAG AA)**
- `lib/dashboard/assets.js:8-589` — CSS (878 LOC total, budget 800 LOC)
- `lib/dashboard/assets.js:8` — `:root` CSS variables (--bg, --fg, --accent, --ok-bg…) — pas de contraste ratio documenté
- `lib/dashboard/assets.js:32-58` — dark mode sans `prefers-reduced-motion`
- `lib/dashboard/assets.js:590-878` — JS client (bindFilter, bindSort, bindThemeToggle, aria-live polite déjà en place)

**Collecte (stable, extension mineure)**
- `lib/dashboard/collect.js:40-65` — helpers FS (lireFichier, extraireChamp, extraireSection)
- `lib/dashboard/collect.js:138-400` — lireurs artefacts (lireProjet, lireIntents, lireSpecs, lireGouvernance)
- `lib/dashboard/collect.js:605` LOC — stable, peu de changements attendus

**Données (à versionner en v2)**
- `dashboard/data.json:1` — `_meta.version: "1.14.0"`, pas de `$schema`, 4 144 lignes, 95 KB
- Données brutes et calculées mélangées au même niveau racine (60+ champs calculés par collecterEnrichi)
- Pas de JSON schema publié, data.json non documenté comme API

**Accessibilité (état actuel)**
- `lib/dashboard/render.js:231` — aria-label sur toggle theme ✓
- `lib/dashboard/render.js:600` — aria-label sur PM filter toolbar ✓
- `lib/dashboard/assets.js:680` — aria-live polite sur copy toast ✓
- `lib/dashboard/pm.js:450,498` — role=progressbar avec aria-valuenow/min/max ✓
- Manques : pas de `<label>` sur inputs de filtre, pas de `<caption>` / `scope` sur tables, pas de `:focus-visible` renforcé, pas de `prefers-reduced-motion`
- Sparklines SVG : `role=img aria-label` présents dans certains modules (velocity-comparison.js:94) mais pas systématiques

**CI et tests**
- `.pa11yci.json` — config WCAG2AA prête, standard + timeout + concurrency=4 — mais **pas intégré en CI**
- `.github/workflows/ci.yml` — aucun job pa11y-ci ni axe-core
- `test/dashboard-render.test.js:866` LOC — couverture badges/helpers/pages
- `test/dashboard.test.js` — 25 KLOC — orchestration complète
- Pas de test axe-core, pas de visual regression, pas de JSON schema validation
- `scripts/lint-size.js` — budgets LOC par module, pas de budgets poids par page HTML

**RGESN / budgets de poids**
- `lib/dashboard/perf-budgets.js` — parseur `.aiad/perf-budgets.md` existant
- `.aiad/perf-budgets.md` — **absent** (pas créé par défaut)
- Poids observés : app.js 14.6 KB gzippé, style.css 16 KB — pas de seuils par page HTML

**Dépendances**
- Runtime : **zéro dépendances externes** (contrainte forte, avantage compétitif)
- D3.js chargé via CDN dans graph.html uniquement
- `devDependencies` : `pa11y-ci@^4.1.1` installé mais inactif en CI
- Pas de Chart.js, pas de Plotly, SVG inline générés côté Node

### Contraintes établies (ne pas casser)

- `package.json` — zero-dep runtime — **CRITIQUE : pas de lib graphique autorisée**
- Statique-généré sans backend — **CRITIQUE : toute donnée doit être pre-computed dans data.json**
- ESM-only — ci.yml lint:esm — tous les nouveaux fichiers doivent rester ESM
- 17 pages fixes dans `PAGES` constant (`render.js:173-190`) — ajouts possibles sous 800 LOC
- Budget LOC modules : render.js ≤ 860, assets.js ≤ 800

### Surface de test existante

- `test/dashboard-render.test.js` (866 LOC), `test/dashboard.test.js` (25 KLOC)
- ~70 fichiers test dashboard total, ~25 KLOC
- CI : lint (node --check, zero-dep, size, ESM, claims) + tests + coverage (75/70/65%)

---

## Faisabilité

**Réalisable avec l'architecture actuelle ?** Oui, mais le coût est significatif.

L'architecture cible en 4 couches (collect/ → model/ → views/ → ui/) est alignée avec ce qui existe déjà partiellement : `qa.js`, `pm.js`, `graph.js` sont déjà séparés. Le refactor consiste principalement à :

1. **Éclater render.js** en helpers ui/ (badges, sparklines, tables) + renderers views/ (une page par fichier)
2. **Extraire collecterEnrichi()** de dashboard.js vers model/index.js
3. **Auditer et durcir assets.js** pour WCAG AA (focus, reduced-motion, contrast)
4. **Activer pa11y-ci** en CI (config prête, juste à câbler)
5. **Versionner data.json v2** avec un JSON schema publié
6. **Créer .aiad/perf-budgets.md** et câbler en CI (perf-budgets.js parseur existe)

Les 25 KLOC de tests existants seront à adapter (refactor imports), pas à réécrire.

**Coût estimé :** 4 SPECs de taille moyenne (SPEC-016-1 à 4), exécutées séquentiellement ou en parallèle avec dépendances (1b dépend de 1a, 4 peut partir en parallèle).

**Alternatives écartées :**
- Refactor tout-en-un : risque de regression trop élevé sur 17 pages × 70 fichiers test
- Rester monolithique + patcher ARIA : ne résout pas la maintenabilité, INTENT-017/018 bloqués

---

## Risques & inconnues

**R1 — Dépendances circulaires** : `lib/dashboard/leadership-metrics.js` ↔ `lib/dashboard/collect.js` — un cycle d'import est toléré à runtime mais fragilise le refactor. À analyser avant la SPEC-016-1.

**R2 — Budget LOC render.js** : actuellement 1003 LOC avec budget exceptionnel justifié à 860 LOC. L'éclatement réduira le fichier ; les nouveaux fichiers views/ doivent rester sous 800 LOC chacun. À vérifier : lint-size.js couvre-t-il les nouveaux sous-dossiers ?

**R3 — data.json v2 rétrocompatibilité** : les 30+ intent-pages générées consomment data.json directement. Le schéma v2 doit rester lisible par tous les consommateurs sans migration forcée. `slim: true` suggère qu'un mode allégé a été anticipé mais jamais activé — à décider.

**R4 — pa11y-ci / Chromium en CI** : le job pa11y-ci nécessite un navigateur headless (Chromium) en GitHub Actions — déjà résolu pour SPEC-013-4b (pa11y-ci câblé sur le site). Transposable au dashboard si les pages sont servies localement (serve + pa11y-ci --sitemap ou liste URLs).

**R5 — Tests à adapter** : dashboard-render.test.js (866 LOC) et dashboard.test.js (25 KLOC) importent directement depuis render.js. L'éclatement en views/ changera les chemins d'import → adaptation non triviale.

Aucun `TODO-JNSP` — les inconnues sont bornées et décidables avec les informations disponibles.

---

## Verdict : GO (confidence: 100 %)

> Tranché par **Steeve Evers** — 2026-06-22.
> Verdict machine : PASS (exit 0) — `/sdd spec` autorisé.

## Conditions (si CONDITIONAL GO)

_Aucune — verdict GO franc._
