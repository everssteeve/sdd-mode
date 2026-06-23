# EXEC-SPEC-018-3 — Plan d'exécution phasé

> Marqueurs : `[ ]` à faire · `[~]` en cours · `[x]` validé · `[!]` bloqué · `[-]` hors-scope

**SPEC** : SPEC-018-3-hill-charts-sdd
**Intent** : INTENT-018
**Gouvernance** : AIAD-RGAA — PASS pré-lancement
**Mode phasé** : activé

---

## Phase 1 — `calculerHillCharts()` + tests unitaires  [x]

- Objectif : fonction pure qui calcule positionX (0–100) par Intent actif, avec règle de branche Discovery/Doing/Done et support trajectoire historique
- Fichiers : `lib/dashboard/hill-charts.js` (création), `test/dashboard-hill-charts.test.js` (création)
- Tests : `test/dashboard-hill-charts.test.js` — 3 Intents (0 SPEC → 0, 2/4 done → 75, 4/4 done → 100), dégradé < 3 snapshots, jnsp=true sans SPEC
- Done : `node --test test/dashboard-hill-charts.test.js` vert
- Conditions : —

## Phase 2 — `blocHillCharts()` SVG accessible + injection modèle + schéma  [x]

- Objectif : rendu SVG hill chart avec points positionnés sur la courbe Bézier, accessibilité RGAA (title/desc/aria-label/reduced-motion), injection dans model/index.js, schéma étendu
- Fichiers : `lib/dashboard/hill-charts.js` (compléter), `lib/dashboard/model/index.js` (injection), `lib/dashboard/schema/data-v2.schema.json` (hillCharts), `test/dashboard-hill-charts.test.js` (test SVG structure)
- Tests : `test/dashboard-hill-charts.test.js` — test SVG `<title>`, `<desc>`, `aria-label`, forme cercle/rect, cas 0 Intent, cas JNSP
- Done : tous tests verts + `@spec SPEC-018-3` posé dans les fichiers touchés
- Conditions : —
