# EXEC-SPEC-018-5 — Plan d'exécution phasé

> Marqueurs : `[ ]` à faire · `[~]` en cours · `[x]` validé · `[!]` bloqué · `[-]` hors-scope

**SPEC** : SPEC-018-5-impact-effort-en-attente
**Intent** : INTENT-018
**Gouvernance** : AIAD-RGAA (tableau HTML)
**Mode phasé** : 1 tranche (SPEC légère — extension rice-matrix.js existant)

---

## Phase 1 — calculerImpactEffortEnAttente() + blocImpactEffortEnAttente() + injection + schéma + tests  [x]

- Objectif : filtre + tri sur riceMatrix existant, rendu HTML tableau, injection model, schéma
- Fichiers : `lib/dashboard/rice-matrix.js` (extension), `lib/dashboard/model/index.js` (injection), `lib/dashboard/schema/data-v2.schema.json`, `test/dashboard-impact-effort.test.js` (création)
- Tests : CA-001 à CA-006 — 5 Intents → 2 en attente, tri scoreRice, riceMatrix absent, HTML structure
- Done : `node --test test/dashboard-impact-effort.test.js` vert
- Conditions : —
