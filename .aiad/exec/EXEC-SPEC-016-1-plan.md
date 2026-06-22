# EXEC-SPEC-016-1 — Plan d'exécution phasé

> Exécution phasée (§3.6) — tranches verticales testables.
> Marqueurs : `[ ]` à faire · `[~]` en cours · `[x]` validé · `[!]` bloqué · `[-]` hors-scope.

**SPEC** : SPEC-016-1 — Architecture 4 couches (collect / model / views / ui)
**Intent** : INTENT-016
**Gate** : OUVERTE — SQS 5/5 — 2026-06-22
**Mode phasé** : activé

---

## Phase 1 — Couche ui/ (helpers, badges, sparklines)  [x]

- Objectif : Extraire `render.js:27-155` dans `ui/helpers.js`, `ui/badges.js`, `ui/sparklines.js`. Ajouter des re-exports dans `render.js` pour ne pas casser les imports existants des tests.
- Fichiers : `lib/dashboard/ui/helpers.js` (nouveau), `lib/dashboard/ui/badges.js` (nouveau), `lib/dashboard/ui/sparklines.js` (nouveau), `lib/dashboard/render.js` (re-exports ajoutés, helpers supprimés)
- Tests : `npm test` — aucune assertion modifiée (re-exports transparents). Vérifier aussi `npm run lint:esm`.
- Done : `render.js` ne contient plus les fonctions `escape`, `lienSource`, `hrefSource`, `lienSourceLigne`, `badge`, `statutBadge`, `sqsBadge`, `freshnessBadge`, `sparkline`, `distributionBar`. Tous re-exportés. `npm test` passe.
- Conditions :

## Phase 2 — Couche model/ (collecterEnrichi → enrichir)  [x]

- Objectif : Extraire `dashboard.js:408-572` dans `lib/dashboard/model/index.js`. Remplacer l'appel dans `dashboard.js` par `import { enrichir } from './dashboard/model/index.js'`.
- Fichiers : `lib/dashboard/model/index.js` (nouveau), `lib/dashboard.js` (remplacement de collecterEnrichi)
- Tests : `test/dashboard.test.js` — assertions inchangées. Vérifier le cycle `leadership-metrics.js` ↔ `collect.js` (analyser avec `node --eval "require('./lib/dashboard/collect.js')"`) et documenter.
- Done : `enrichir(donnees)` produit le même objet que l'ancienne `collecterEnrichi()`. `npm test` passe. Cycle import documenté avec `// cycle toléré :` ou brisé.
- Conditions :

## Phase 3 — Couche views/ (7 renderers de pages)  [x]

- Objectif : Extraire les 7 fonctions de pages de `render.js` dans `lib/dashboard/views/`. Ajouter des re-exports dans `render.js`. `render.js` ne conserve que `layout()`, `listerAlertes()` et la constante `PAGES`.
- Fichiers : `lib/dashboard/views/overview.js`, `views/intents.js`, `views/specs.js`, `views/traceability.js`, `views/metrics.js`, `views/drifts.js`, `views/changelog.js` (nouveaux), `lib/dashboard/render.js` (nettoyage final)
- Tests : `npm test`. `render.js` doit être ≤ 300 LOC après extraction. Chaque fichier views/ ≤ 300 LOC.
- Done : `render.js` ≤ 300 LOC. 7 fichiers views/ créés, chacun ≤ 300 LOC. `npm test` passe.
- Conditions :

## Phase 4 — Budgets LOC + lint final  [x]

- Objectif : Mettre à jour `.aiad-size-budget.json` (remplacer les entrées `render.js: 860` et `assets.js: 800` par les nouveaux plafonds). Vérifier que `scripts/lint-size.js` parcourt `lib/dashboard/*/`.
- Fichiers : `.aiad-size-budget.json`, `scripts/lint-size.js` (si modification requise)
- Tests : `npm run lint:size`, `npm run lint:esm`, `npm run lint:deps`.
- Done : `lint:size` passe avec les nouveaux budgets. `lint:esm` et `lint:deps` passent. `dashboard.js` ≤ 400 LOC.
- Conditions :

## Phase 5 — Validation output final  [x]

- Objectif : Vérifier que `npx aiad-sdd dashboard` produit un output HTML byte-for-byte identique à l'état pré-refactor.
- Fichiers : aucun (vérification uniquement)
- Tests : `npx aiad-sdd dashboard`, `npm test` complet, `npm run lint` complet. Diff entre output avant/après (ou vérification que les tests d'assertion HTML passent sans modification).
- Done : Toutes les 17 pages HTML identiques. Annotations `@spec SPEC-016-1` posées sur tous les nouveaux modules. Coverage ≥ 75/70/65 %.
- Conditions :
