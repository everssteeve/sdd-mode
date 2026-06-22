# Plan d'exécution — SPEC-017-1

**SPEC** : SPEC-017-1 — Page "Aujourd'hui" (radiator ≤ 4 sections)
**Intent** : INTENT-017
**Date** : 2026-06-22
**Statut** : in-progress

---

## Tranche 1 — `lib/dashboard/views/today.js` + tests

**Objectif** : créer le renderer de page + les 7 cas de test.

**Fichiers** :
- `lib/dashboard/views/today.js` (nouveau, ≤ 180 LOC)
- `test/dashboard-today.test.js` (nouveau, 7 cas)

**Tests** : CA-001 à CA-007b (dashboard-today.test.js + dashboard.test.js)

**Done** :
- [x] `construirePageAujourdhui(donnees)` → string HTML body
- [x] `pageAujourdhui(donnees, { layout })` → string HTML complète
- [x] 4 sections exactes avec aria-label
- [x] h1 + h2 hiérarchie séquentielle
- [x] 4 cas limites (vides) couverts
- [x] Annotations `@spec SPEC-017-1` + `@verified-by`
- [x] 7 tests verts

**Conditions** : —

---

## Tranche 2 — Wiring `render.js` PAGES

**Objectif** : brancher today.html dans le dashboard.

**Fichiers** :
- `lib/dashboard/render.js` (1 ligne additive dans PAGES + 1 export)

**Tests** : CA-007a + CA-007b dans `test/dashboard.test.js`

**Done** :
- [x] Entrée `{ slug: 'today', … }` en tête de PAGES
- [x] Export `pageAujourdhui` dans render.js
- [x] `today.html` écrit à chaque génération

**Conditions** : —

---

## Statuts machine

`[ ]` à faire · `[~]` en cours · `[x]` validé · `[!]` bloqué · `[-]` hors-scope
