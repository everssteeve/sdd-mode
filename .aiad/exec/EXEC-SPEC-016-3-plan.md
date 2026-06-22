# EXEC-SPEC-016-3 — Plan d'exécution phasé

> Exécution phasée (§3.6) — découpe la SPEC en **tranches verticales testables**.
> Interdiction de coder horizontalement : chaque tranche livre un incrément
> **et ses tests**. À la fin de chaque tranche : `npx aiad-sdd mini-gate SPEC-016-3 --phase N`.
>
> Marqueurs de statut : `[ ]` à faire · `[~]` en cours · `[x]` validé · `[!]` bloqué · `[-]` hors-scope.

**SPEC** : SPEC-016-3 — data.json v2 versionné (JSON schema publié)
**Intent** : INTENT-016
**Research** : RESEARCH-021 — CONDITIONAL GO (100 %)
**Gate** : SQS 5/5 — OUVERTE (2026-06-22)
**Gouvernance** : PASS (AI-ACT NON / RGPD NON / RGAA NON / RGESN minimal)

---

## Phase 1 — Injection _meta.schema_version + _schema + JSON Schema  [x]

- Objectif : `data.json` contient `_meta.schema_version: "2.0"` et `_schema` ; fichier schéma publié.
- Fichiers : `lib/dashboard.js` (serializerDonnees, lignes 343-349), `lib/dashboard/schema/data-v2.schema.json` (nouveau)
- Tests : test/dashboard.test.js, test/dashboard-render.test.js
- Done : `npx aiad-sdd dashboard` produit un `data.json` avec `_meta.schema_version: "2.0"` et `_schema.local` ; `npm test` vert.

## Phase 2 — Script de validation + job CI  [x]

- Objectif : `node scripts/validate-data-schema.js` exit 0 sur data.json valide, exit 1 sur data.json invalide ; CI `validate-schema` passe.
- Fichiers : `scripts/validate-data-schema.js` (nouveau), `.github/workflows/ci.yml` (job validate-schema après test)
- Tests : test/validate-data-schema.test.js
- Done : `node scripts/validate-data-schema.js` exit 0 ; test exit 1 sur fixtures invalides ; `npm test` vert ; `npm run lint:deps` vert.
