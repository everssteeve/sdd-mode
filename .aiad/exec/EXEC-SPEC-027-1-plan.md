# EXEC-SPEC-027-1 — Plan d'exécution phasé

> Exécution phasée (§3.6) — découpe la SPEC en **tranches verticales testables**.
> Interdiction de coder horizontalement : chaque tranche livre un incrément
> **et ses tests**. À la fin de chaque tranche : `npx aiad-sdd mini-gate SPEC-027-1 --phase N`.
>
> Marqueurs de statut : `[ ]` à faire · `[~]` en cours · `[x]` validé · `[!]` bloqué · `[-]` hors-scope.

**SPEC** : SPEC-027-1
**Intent** : INTENT-027
**Mode phasé** : activé

---

## Phase 1 — lib/spec-stamp.js + dispatch CLI + tests  [x]

- Objectif : Stamper `validated_at` (ISO 8601 UTC) dans le frontmatter YAML d'une SPEC via `aiad-sdd spec stamp-validated <SPEC-ID>`. Couvrir idempotence, SPEC introuvable, frontmatter absent, format ISO, body préservé.
- Fichiers : `lib/spec-stamp.js`, `bin/aiad-sdd.js` (case `spec`), `test/spec-stamp.test.js`
- Tests : test/spec-stamp.test.js
- Done : 6/6 tests passent · lint 601 fichiers OK · zéro dépendance runtime ajoutée
- Conditions :
