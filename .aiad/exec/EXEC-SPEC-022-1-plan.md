# EXEC-SPEC-022-1 — Plan d'exécution phasé

> Exécution phasée (§3.6) — découpe la SPEC en **tranches verticales testables**.
> Interdiction de coder horizontalement : chaque tranche livre un incrément
> **et ses tests**. À la fin de chaque tranche : `npx aiad-sdd mini-gate SPEC-022-1 --phase N`.
>
> Marqueurs de statut : `[ ]` à faire · `[~]` en cours · `[x]` validé · `[!]` bloqué · `[-]` hors-scope.

**SPEC** : SPEC-022-1
**Intent** : INTENT-022
**Mode phasé** : activé

---

## Phase 1 — Annotations modules couverts par cette SPEC  [x]

- Objectif : Annoter `lib/init.js`, `lib/fs-ops.js`, `lib/frontmatter.js` avec `@spec SPEC-022-1-retro-annotations-core`
- Fichiers : `lib/init.js`, `lib/fs-ops.js`, `lib/frontmatter.js`
- Tests : `test/init.test.js` (existant — couvre lib/init.js)
- Done : Les 3 modules absents de `code_without_spec` sur les fonctions exportées
- Conditions :

## Phase 2 — Annotations modules → SPECs archivées  [x]

- Objectif : Annoter `lib/governance.js` → SPEC-002-1, `lib/hooks.js` → SPEC-011-1, `lib/emit-rules.js` (fonctions non couvertes) → SPEC-005-1, `lib/doctor.js` → SPEC-004-1
- Fichiers : `lib/governance.js`, `lib/hooks.js`, `lib/emit-rules.js`, `lib/doctor.js`
- Tests : `test/emit-rules.test.js`, `test/governance.test.js` (si existant), `test/hooks.test.js` (si existant)
- Done : Les 4 modules absents de `code_without_spec` ; `npx aiad-sdd trace` sans gap bloquant sur ces fichiers
- Conditions :
