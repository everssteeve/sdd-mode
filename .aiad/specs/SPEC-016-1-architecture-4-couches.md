# SPEC-016-1 — Architecture 4 couches (collect / model / views / ui)

**Intent parent** : INTENT-016
**Research** : RESEARCH-020 — GO (100 %)
**Auteur** : Steeve Evers
**Date** : 2026-06-22
**Statut** : done
**Format** : prose
**SQS** : 5.0

---

## 1. Contexte

`render.js` (1 003 LOC) et `dashboard.js:collecterEnrichi()` (165 lignes, 70+ appels en cascade) mélangent collecte, transformation métier, rendu HTML et helpers UI dans un seul niveau de responsabilité. Cette monolithisme rend impraticable tout refactor ciblé (INTENT-017, INTENT-018) et bloque l'audit RGAA (SPEC-016-2) et les budgets RGESN (SPEC-016-4). La SPEC-016-1 découpe le code existant en 4 couches sans régression fonctionnelle.

## 2. Comportement Attendu

### Input

Aucun changement d'input : `dashboard()` (point d'entrée `lib/dashboard.js:205`) est appelé identiquement depuis le CLI.

### Processing

**Nouvelle structure cible :**

```
lib/dashboard/
├── collect/          ← déjà partiellement là (collect.js reste en place)
│   └── index.js      ← ré-export de collect.js (compatibilité imports)
│
├── model/
│   └── index.js      ← contient collecterEnrichi() extrait de dashboard.js:408-572
│                        importe les calculateurs existants (qa.js, pm.js, velocity.js…)
│                        exporte enrichir(donnees) → donneeEnrichies
│
├── views/
│   ├── overview.js   ← pageOverview() extrait de render.js:374
│   ├── intents.js    ← pageIntents() extrait de render.js:532
│   ├── specs.js      ← pageSpecs() extrait de render.js:616
│   ├── traceability.js ← pageTraceability() extrait de render.js:692
│   ├── metrics.js    ← pageMetrics() extrait de render.js:794
│   ├── drifts.js     ← pageDrifts() extrait de render.js:928
│   └── changelog.js  ← pageChangelog() extrait de render.js:971
│       (les 10 pages déjà séparées — graph.js, qa.js, pm.js, kanban.js, etc. — restent où elles sont)
│
└── ui/
    ├── badges.js     ← statutBadge, sqsBadge, freshnessBadge extraits de render.js:99-155
    ├── sparklines.js ← sparkline, distributionBar extraits de render.js:75-97
    ├── tables.js     ← helpers table (caption, scope) — nouveaux pour SPEC-016-2
    ├── helpers.js    ← escape, lienSource, hrefSource, lienSourceLigne extraits de render.js:27-72
    └── assets.js     ← reste en place (CSS + JS client)
```

**render.js après refactor :**
- Conserve `layout()` (render.js:192), `listerAlertes()` (render.js:246), la constante `PAGES` (render.js:173) et les imports des modules views/ et ui/.
- LOC cible : ≤ 300 (vs 1 003 actuellement) — suppression du budget exceptionnel `.aiad-size-budget.json`.

**dashboard.js après refactor :**
- `collecterEnrichi()` (lignes 408-572) est remplacé par un appel à `enrichir()` importé depuis `model/index.js`.
- LOC cible : ≤ 400 (vs 676 actuellement).

**Règle d'éclatement :** chaque nouveau fichier dans views/ et ui/ reste ≤ 300 LOC. Si un renderer dépasse 300 LOC, il est découpé en sections (ex. `views/overview/kpis.js` + `views/overview/alerts.js`).

### Output

Le pipeline `dashboard()` produit exactement les mêmes 17 pages HTML + fichiers assets dans `dashboard/`. Aucun changement de contenu observable.

### Cas limites

- **Dépendance circulaire** : `leadership-metrics.js` ↔ `collect.js` — analyser avec `node --eval "require('./lib/dashboard/collect.js')"` avant de déplacer. Si cycle, briser via lazy import ou inversion de dépendance.
- **Imports cassés** : les 70 fichiers test importent depuis `render.js` directement — les chemins doivent être mis à jour vers `ui/` et `views/`. Les re-exports depuis render.js pendant la transition évitent les cassures en cascade.
- **Budget LOC `.aiad-size-budget.json`** : les entrées `lib/dashboard/render.js: 860` et `lib/dashboard/assets.js: 800` doivent être remplacées par les nouveaux plafonds (300 par fichier views/, 200 par fichier ui/). `lint-size.js` doit couvrir les sous-dossiers.

## 3. Critères d'Acceptation

- [ ] `lib/dashboard/model/index.js` exporte `enrichir(donnees)` qui produit le même objet que l'ancienne `collecterEnrichi()` — vérifié par `test/dashboard.test.js` sans modification des assertions.
- [ ] `render.js` est ≤ 300 LOC après extraction des renderers et helpers.
- [ ] Chaque fichier dans `views/` et `ui/` est ≤ 300 LOC.
- [ ] `npm test` passe sans modification des assertions de test (seuls les chemins d'import sont mis à jour).
- [ ] `npm run lint:size` passe avec les nouveaux budgets LOC définis dans `.aiad-size-budget.json`.
- [ ] `npm run lint:esm` passe — tous les nouveaux fichiers sont ESM (pas de `require`, pas de `module.exports`).
- [ ] `npm run lint:deps` passe — zéro nouvelle dépendance runtime introduite.
- [ ] La commande `npx aiad-sdd dashboard` produit un `dashboard/index.html` byte-for-byte identique à l'état pré-refactor (ou diff limité aux whitespace/order non sémantiques).
- [ ] Le cycle d'import `leadership-metrics.js` ↔ `collect.js` est documenté dans un commentaire `// cycle toléré : …` ou brisé.

## 4. Interface / API

```js
// lib/dashboard/model/index.js
export async function enrichir(donnees) → Promise<DonneesEnrichies>

// lib/dashboard/views/overview.js
export function pageOverview(donnees) → string  // HTML fragment

// lib/dashboard/ui/badges.js
export function statutBadge(statut) → string    // HTML span
export function sqsBadge(sqs) → string
export function freshnessBadge(opts) → string

// lib/dashboard/ui/helpers.js
export function escape(str) → string
export function lienSource(opts) → string
export function hrefSource(opts) → string
export function lienSourceLigne(opts) → string

// lib/dashboard/ui/sparklines.js
export function sparkline(valeurs, opts) → string   // SVG inline
export function distributionBar(data) → string

// render.js (interface publique inchangée)
export { layout, listerAlertes, PAGES }
```

## 5. Dépendances

- `lib/dashboard/collect.js` — stable, non modifié (source de `collecterDonnees`)
- `lib/dashboard/qa.js`, `pm.js`, `velocity.js`, `kanban.js` et ~60 calculateurs — non modifiés
- `.aiad-size-budget.json` — à mettre à jour avec les nouveaux plafonds
- `scripts/lint-size.js` — vérifier qu'il parcourt les sous-dossiers `lib/dashboard/*/`

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~300 tokens
- Cette SPEC : ~600 tokens
- Fichiers source pertinents : `lib/dashboard/render.js` (1 003 LOC), `lib/dashboard.js` (676 LOC)
- Fichiers test à mettre à jour : `test/dashboard-render.test.js` (866 LOC), `test/dashboard.test.js` (~25 KLOC)
- **Total estimé** : ~3 500 tokens (SPEC + fichiers clés condensés)

## 7. Definition of Output Done (DoOD)

- [ ] Code + lint passing (`lint:size`, `lint:esm`, `lint:deps`)
- [ ] `npm test` passe (assertions inchangées)
- [ ] Coverage ≥ seuils actuels (75/70/65 %)
- [ ] `.aiad-size-budget.json` mis à jour (anciens plafonds render.js/assets.js supprimés, nouveaux ajoutés)
- [ ] Annotations `@spec SPEC-016-1` posées sur les nouveaux modules
- [ ] SPEC mise à jour si écart pendant l'exécution (Drift Lock)
- [ ] Gouvernance RGESN vérifiée (zéro nouvelle dépendance, structure statique maintenue)
