# EXEC-SPEC-016-2 — Plan d'exécution phasé

> Exécution phasée (§3.6) — découpe la SPEC en **tranches verticales testables**.
> Interdiction de coder horizontalement : chaque tranche livre un incrément
> **et ses tests**. À la fin de chaque tranche : `npx aiad-sdd mini-gate SPEC-016-2 --phase N`.
>
> Marqueurs de statut : `[ ]` à faire · `[~]` en cours · `[x]` validé · `[!]` bloqué · `[-]` hors-scope.

**SPEC** : SPEC-016-2 — Design system accessible + axe-core en CI
**Intent** : INTENT-016
**SQS** : 5/5 — Gate OUVERTE (2026-06-22)
**Gouvernance** : AIAD-RGAA (PASS) · AIAD-RGESN (PASS)
**Mode phasé** : activé

---

## Phase 1 — CSS RGAA : focus-visible + prefers-reduced-motion  [x]

- **Objectif** : Ajouter les 2 règles CSS RGAA manquantes dans `assets.js` (section CSS ~L8-589)
- **Fichiers** : `lib/dashboard/assets.js` (CSS section)
- **Tests** : `test/dashboard-assets.test.js` — vérifier présence de `:focus-visible` avec outline ≥ 3px ET du bloc `@media (prefers-reduced-motion: reduce)`
- **Done** : tests CA-004 et CA-005 verts · `npm test` passe
- **Conditions** : vérifier que la règle `:focus-visible` couvre bien `a, button, input, select, [tabindex]` (pas seulement `:focus`)

## Phase 2 — SVG sparklines accessibles (role + aria-label)  [x]

- **Objectif** : Ajouter `role="img"` et `aria-label` non vide sur toutes les `<svg>` de `sparkline()`, y compris cas vide (→ "Données non disponibles") et cas 1 valeur
- **Fichiers** : `lib/dashboard/ui/sparklines.js`
- **Tests** : `test/dashboard-render.test.js` — CA-006 (role-img), CA-006b (aria-label non vide), CA-007 (aria-label="Données non disponibles" si valeurs vide)
- **Done** : 3 cas couverts par tests · annotations `@spec SPEC-016-2` + `@governance AIAD-RGAA` posées
- **Conditions** : `aria-label` accepte une option `opts.label` pour personnalisation côté appelant

## Phase 3 — HTML helpers : labels inputs + caption + scope th  [x]

- **Objectif** : Mettre à jour le générateur HTML pour ajouter les balises RGAA manquantes sur les inputs de filtre, les tables et leurs `<th>` dans `lib/dashboard/assets.js` (section JS ~L590-878)
- **Fichiers** : `lib/dashboard/assets.js` (section `bindFilter()` et fonctions de rendu tables)
- **Tests** : `test/dashboard-render.test.js` — CA-002 (label-on-filter-inputs), CA-003 (table-caption), CA-003b (table-th-scope)
- **Done** : 3 assertions vertes · annotation `@spec SPEC-016-2 @governance AIAD-RGAA` posée sur les fonctions modifiées
- **Conditions** : si l'input est visuellement labellisé autrement, préférer `aria-label` plutôt que `<label>` visible

## Phase 4 — CI a11y : pa11yci + job GitHub Actions  [x]

- **Objectif** : Compléter `.pa11yci.json` avec les 17 URLs + 5 intent-pages, puis ajouter le job `a11y` dans `.github/workflows/ci.yml`
- **Fichiers** : `.pa11yci.json`, `.github/workflows/ci.yml`
- **Tests** : vérification structurelle — `test/dashboard-render.test.js` ou test dédié : URLs présentes dans `.pa11yci.json`, job `a11y` présent dans `ci.yml` avec `timeout-minutes: 2`
- **Done** : CA-001 (17 pages listées), CA-001b (job échoue sur violation — commentaire dans yml), CA-008 (`timeout-minutes: 2` ≤ 120s)
- **Conditions** : graph.html CDN — ignorer les erreurs réseau CDN uniquement si elles apparaissent (`--ignore` conditionnel + commentaire justificatif dans `.pa11yci.json`)
