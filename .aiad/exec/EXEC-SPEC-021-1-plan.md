# EXEC-SPEC-021-1 — Plan d'exécution phasé

> Exécution phasée (§3.6) — découpe la SPEC en **tranches verticales testables**.
> Interdiction de coder horizontalement : chaque tranche livre un incrément
> **et ses tests**. À la fin de chaque tranche : `npx aiad-sdd mini-gate SPEC-021-1 --phase N`.
>
> Marqueurs de statut : `[ ]` à faire · `[~]` en cours · `[x]` validé · `[!]` bloqué · `[-]` hors-scope.

**SPEC** : SPEC-021-1-attribution-tokens-artefact
**Intent** : INTENT-021
**Mode phasé** : activé

---

## Phase 1 — Résolution d'artefact dans `buildEntry`  [x]

- Objectif : enrichir `lib/eco-hook.js::buildEntry` pour résoudre l'artefact actif (env > fichier d'état > absent) et persister `specId`/`intentId` optionnels dans l'entrée JSONL
- Fichiers : `lib/eco-hook.js`
- Tests : `test/eco-hook-attribution.test.js` (CA-001 env-spec, CA-002 file-fallback, CA-003 no-attribution)
- Done : `buildEntry` retourne les champs `specId`/`intentId` selon la source résolue ; les 3 cas de test passent
- Conditions :

## Phase 2 — Agrégateur `collecterEmpreinteParArtefact`  [x]

- Objectif : créer `lib/empreinte-artefact.js` avec la fonction `collecterEmpreinteParArtefact(racine)` qui lit `hook-runs.jsonl` et groupe les tokens par specId/intentId/nonAttribues
- Fichiers : `lib/empreinte-artefact.js` (nouveau)
- Tests : `test/empreinte-artefact.test.js` (CA-004 legacy-entries, CA-005 legacy-no-throw, CA-006 group-by-spec, CA-010 local-only, CA-011 no-network)
- Done : `collecterEmpreinteParArtefact` retourne la structure `{ parSpec, parIntent, nonAttribues }` ; tous les cas de test passent dont les entrées héritées et le fichier corrompu (fail-open)
- Conditions :

## Phase 3 — CLI `track set/clear` + mise à jour `exec.md`  [x]

- Objectif : ajouter les sous-commandes `aiad-sdd track set <SPEC-ID> [--intent <INTENT-ID>]` et `aiad-sdd track clear` dans `bin/aiad-sdd.js` ; mettre à jour `.claude/sdd/exec.md` pour invoquer `track set` au lancement et `track clear` en fin de session
- Fichiers : `bin/aiad-sdd.js`, `.claude/sdd/exec.md`
- Tests : `test/track-cli.test.js` (CA-007 set-writes-state, CA-008 clear-removes, CA-009 clear-idempotent)
- Done : `aiad-sdd track set SPEC-021-1 --intent INTENT-021` écrit `.aiad/metrics/active-artifact.json` avec `specId`, `intentId`, `since` ISO 8601 ; `clear` supprime idempotent ; les 3 tests passent
- Conditions :
