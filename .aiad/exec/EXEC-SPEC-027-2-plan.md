# EXEC-SPEC-027-2 — Plan d'exécution phasé

> Exécution phasée (§3.6) — découpe la SPEC en **tranches verticales testables**.
> Interdiction de coder horizontalement : chaque tranche livre un incrément
> **et ses tests**. À la fin de chaque tranche : `npx aiad-sdd mini-gate SPEC-027-2 --phase N`.
>
> Marqueurs de statut : `[ ]` à faire · `[~]` en cours · `[x]` validé · `[!]` bloqué · `[-]` hors-scope.

**SPEC** : SPEC-027-2
**Intent** : INTENT-027
**Mode phasé** : activé

---

## Phase 1 — calculateCycleTimeDaysFromSpec + flag --auto + tests  [x]

- Objectif : Implémenter `calculateCycleTimeDaysFromSpec(racineProjet, deployDate)` dans `lib/dora-record.js`, ajouter le flag `--auto` dans le dispatch `dora --record` de `bin/aiad-sdd.js`, couvrir les 6 critères (calcul nominal, résultat négatif, aucun validated_at, priorité --cycle, arrondi, date paramétrable).
- Fichiers : lib/dora-record.js, bin/aiad-sdd.js, test/dora-auto.test.js
- Tests : test/dora-auto.test.js

- Done : 6/6 tests CA-001 à CA-006 passent · lint PASS · zero-dep runtime
- Conditions :
