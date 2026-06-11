# EXEC-SPEC-013-3 — Plan d'exécution phasé

> Exécution phasée (§3.6) — tranches verticales testables. Chaque tranche livre
> un incrément **et ses tests**. Mini-gate à la fin de chaque tranche.
>
> Marqueurs : `[ ]` à faire · `[~]` en cours · `[x]` validé · `[!]` bloqué · `[-]` hors-scope.

**SPEC** : SPEC-013-3
**Intent** : INTENT-013
**Mode phasé** : activé

---

## Phase 1 — Noyau `lib/version-sync.js` (pur + testé)  [x]

- Objectif : module pur qui lit `package.json.version`, détecte les zones
  `<!--VERSION:START-->…<!--VERSION:END-->`, remplace leur contenu, et expose
  `--check` (comparaison sans écriture). Respecte C1 (zones marquées seulement).
- Fichiers : lib/version-sync.js
- Tests : test/version-sync.test.js
- Done : `node --test test/version-sync.test.js` vert (5 cas limites couverts).
- Conditions :

## Phase 2 — Handler CLI `aiad-sdd version-sync`  [x]

- Objectif : sous-commande `version-sync [--check] [--dry-run] [--json]` câblée
  dans bin/aiad-sdd.js (exit 1 sur écart en --check), + entrée AIDE.
- Fichiers : bin/aiad-sdd.js
- Tests : test/version-sync.test.js
- Done : `aiad-sdd version-sync --check` et `--dry-run` fonctionnels.

## Phase 3 — Check CI + zones marquées dans site/  [x]

- Objectif : workflow `.github/workflows/aiad-version-check.yml` (calqué sur
  aiad-docs-check) ; zones marquées ajoutées aux footers/pills de `site/` ;
  `version-sync --check` vert en local.
- Fichiers : .github/workflows/aiad-version-check.yml, site/ (57 fichiers)
- Tests : test/version-sync.test.js
- Done : `npx aiad-sdd version-sync --check` exit 0 (57 fichiers, 59 zones) ;
  rouge→vert vérifié sur écart simulé ; suite complète 3831 pass / 0 fail.
