# EXEC-<SPEC-id> — Plan d'exécution phasé

> Exécution phasée (§3.6) — découpe la SPEC en **tranches verticales testables**.
> Interdiction de coder horizontalement : chaque tranche livre un incrément
> **et ses tests**. À la fin de chaque tranche : `npx aiad-sdd mini-gate <SPEC-id> --phase N`.
>
> Marqueurs de statut : `[ ]` à faire · `[~]` en cours · `[x]` validé · `[!]` bloqué · `[-]` hors-scope.

**SPEC** : SPEC-<id>
**Intent** : INTENT-<id>
**Mode phasé** : activé (désactivable via `.aiad/config.yml` → `exec.phased: false`)

---

## Phase 1 — <titre de la tranche>  [ ]

- Objectif : <l'incrément vertical livré par cette tranche>
- Fichiers : <chemins à créer/modifier, séparés par des virgules>
- Tests : <chemins des tests livrés par la tranche — OBLIGATOIRE>
- Done : <critère observable de fin de tranche>
- Conditions : <dette explicitée si la tranche passe en CONDITIONAL — sinon vide>

## Phase 2 — <titre>  [ ]

- Objectif :
- Fichiers :
- Tests :
- Done :

<!-- Ajoute autant de tranches que nécessaire. Pour une SPEC triviale, une
     seule tranche est admise (proportionnalité — cf. §3.6 §9). -->
