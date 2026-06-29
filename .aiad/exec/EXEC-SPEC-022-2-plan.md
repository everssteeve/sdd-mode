# EXEC-SPEC-022-2 — Plan d'exécution phasé

> Exécution phasée (§3.6).
> Marqueurs : `[ ]` à faire · `[~]` en cours · `[x]` validé · `[!]` bloqué · `[-]` hors-scope.

**SPEC** : SPEC-022-2
**Intent** : INTENT-022
**Mode phasé** : activé

---

## Phase 1 — Modifier lib/sdd-trace.js  [x]

- Objectif : Ajouter `detecterNouveauxFichiers()`, enrichir `codeSansSpec` → `{bloquant, non_bloquant, total, items}`, mettre à jour les appelants internes + `compterGapsBloquants()`, ajouter `--new-files-only`, annoter le fichier
- Fichiers : `lib/sdd-trace.js`
- Tests : `test/trace.test.js` (tests à ajouter en Phase 3)
- Done : `npx aiad-sdd trace --json | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.gaps.codeSansSpec.bloquant)"` retourne 0

## Phase 2 — Mettre à jour les appelants dans les autres modules  [x]

- Objectif : Migrer `.length` → `.total` et `for (const f of .codeSansSpec)` → `.items` dans sarif.js, drift-verdict.js, repl.js, workspace.js, cli-schema.js, dashboard/views/
- Fichiers : `lib/sarif.js`, `lib/drift-verdict.js`, `lib/repl.js`, `lib/workspace.js`, `lib/cli-schema.js`, `lib/dashboard/views/traceability.js`, `lib/dashboard/views/overview.js`
- Tests : `node --test test/trace.test.js` doit passer
- Done : `npm run lint` PASS + tests verts

## Phase 3 — Tests + AGENT-GUIDE  [x]

- Objectif : Ajouter tests unitaires sur `detecterNouveauxFichiers` + `--fail-on-gap` bloquant sur nouveau fichier, mettre à jour AGENT-GUIDE
- Fichiers : `test/trace.test.js`, `.aiad/AGENT-GUIDE.md`
- Tests : 4+ nouveaux cas dans test/trace.test.js
- Done : `node --test test/trace.test.js` PASS intégralement
