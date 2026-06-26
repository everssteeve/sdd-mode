# EXEC-SPEC-021-2 — Plan d'exécution phasé

> Exécution phasée (§3.6) — découpe la SPEC en **tranches verticales testables**.
> Interdiction de coder horizontalement : chaque tranche livre un incrément
> **et ses tests**. À la fin de chaque tranche : `npx aiad-sdd mini-gate SPEC-021-2 --phase N`.
>
> Marqueurs de statut : `[ ]` à faire · `[~]` en cours · `[x]` validé · `[!]` bloqué · `[-]` hors-scope.

**SPEC** : SPEC-021-2-restitution-empreinte-context
**Intent** : INTENT-021
**Mode phasé** : activé

---

## Phase 1 — formaterEmpreinte + tests unitaires  [x]

- Objectif : Ajouter `formaterEmpreinte(empreinte, { cible })` dans `lib/empreinte-artefact.js` — formatage trié, départage stable, avertissement couverture, exclusion coût €
- Fichiers : lib/empreinte-artefact.js
- Tests : test/footprint-formatter.test.js
- Done : `npm test` passe, 0 violation lint
- Conditions :

## Phase 2 — CLI `aiad-sdd footprint` + tests CLI  [x]

- Objectif : Enregistrer la sous-commande `footprint` dans `bin/aiad-sdd.js` + `lib/commands-registry.js` ; gérer agrégat, ciblage, absence de données
- Fichiers : bin/aiad-sdd.js, lib/commands-registry.js
- Tests : test/footprint-cli.test.js
- Done : `aiad-sdd footprint` renvoie exit 0 avec message, tests passent
- Conditions :

## Phase 3 — Directive /sdd context + test intégration  [x]

- Objectif : Ajouter dans `.claude/sdd/context.md` l'étape de restitution de l'empreinte mesurée (CA-006) ; MAJ SPEC §3 + _index.md
- Fichiers : .claude/sdd/context.md, .aiad/specs/SPEC-021-2-restitution-empreinte-context.md, .aiad/specs/_index.md
- Tests : test/footprint-context-directive.test.js
- Done : test passe, directive lisible, SPEC statut → done
- Conditions :
