---
status: archived
archivedAt: "2026-06-24T09:49:37.015Z"
archivedBy: evers.steeve@gmail.com
archivedReason: FACT-008 — SPECs done sans frontmatter YAML détectées via fallback body
---
**Intent parent** : INTENT-019
**Auteur** : Steeve Evers
**Date** : 2026-06-23
**Statut** : done
**Format** : EARS
**SQS** : 5/5 (Gate OUVERTE — 2026-06-23)

---

## 1. Contexte

SPEC-019-1 produit des squelettes de tests. Cette SPEC ferme la boucle côté traçabilité : `sdd-trace` détecte les SPECs EARS actives sans aucun test lié (`earsSpecsSansTests`) et `trace --fail-on-gap` bloque la CI si ce gap est non vide. C'est la preuve que le cycle « EARS → test → code » est complet et machine-vérifiable.

## 2. Comportement Attendu

### Input

- Matrice de traçabilité produite par `construireMatrice(racineProjet)` (existante)
- SPECs avec `Format : EARS` et statut ≠ `draft` / ≠ `archived`

### Processing

1. Dans `compterGapsBloquants(matrice)`, ajouter le critère `earsSpecsSansTests` :
   - Pour chaque SPEC avec `Format : EARS` et statut `ready`/`in-progress`/`validation`/`done`
   - Vérifier qu'au moins un fichier test a une annotation `@spec <SPEC-id>` ou figure dans `testsParPathCode`
   - Si aucun test lié → ajouter à `earsSpecsSansTests`
2. Inclure `earsSpecsSansTests` dans la sortie `trace.md`, `trace.json`, `trace.html`.
3. Quand `--suggest` est actif, ajouter une commande `npx aiad-sdd suggest-tests <SPEC-id>` pour chaque SPEC dans ce gap.

### Output

Section `earsSpecsSansTests` dans le rapport de traçabilité :
```
| SPEC-NNN-N | titre | EARS | done | 0 test lié |
```

`trace.json` :
```json
{ "gaps": { "earsSpecsSansTests": ["SPEC-019-1", ...] } }
```

### Cas limites

- SPEC EARS en statut `draft` → exclue du gap (non bloquante)
- SPEC EARS en statut `archived` → exclue du gap
- SPEC EARS avec `Testé : …` dans les CA mais fichier test absent du dépôt → compte comme gap (fichier manquant = gap réel)
- Projet sans aucune SPEC EARS → `earsSpecsSansTests: []`, pas d'erreur
- `--fail-on-gap` avec `earsSpecsSansTests` vide → exit 0

## 3. Critères d'Acceptation (EARS)

### CA-001 — Détection du gap earsSpecsSansTests

> Pattern : Event-driven

`WHEN "npx aiad-sdd trace" runs and ≥ 1 EARS SPEC (status ≠ draft, ≠ archived) has no test file linked via "@spec <SPEC-id>" or "@verified-by", the trace report SHALL list that SPEC under "earsSpecsSansTests".`

- [ ] Implémenté
- [ ] Testé : `test/trace-ears-gap.test.js::CA-001`

### CA-002 — Blocage CI sur gap non vide

> Pattern : Event-driven

`WHEN "npx aiad-sdd trace --fail-on-gap" runs and "earsSpecsSansTests" is non-empty, the CLI SHALL exit 1.`

- [ ] Implémenté
- [ ] Testé : `test/trace-ears-gap.test.js::CA-002`

### CA-003 — Absence de faux positif sur SPEC couverte

> Pattern : Unwanted behaviour

`IF a SPEC has "Format : EARS" AND at least one test file in the project has the annotation "@spec <SPEC-id>", THEN the gap checker SHALL NOT include that SPEC in "earsSpecsSansTests".`

- [ ] Implémenté
- [ ] Testé : `test/trace-ears-gap.test.js::CA-003`

### CA-004 — Exclusion des statuts non actifs

> Pattern : Unwanted behaviour

`IF a SPEC has "Format : EARS" AND status "draft" OR "archived", THEN the gap checker SHALL NOT include it in "earsSpecsSansTests" regardless of test coverage.`

- [ ] Implémenté
- [ ] Testé : `test/trace-ears-gap.test.js::CA-004`

### CA-005 — Suggestion de commande via --suggest

> Pattern : Optional feature

`WHERE "--suggest" is passed and "earsSpecsSansTests" is non-empty, the trace output SHALL include a "npx aiad-sdd suggest-tests <SPEC-id>" line for each SPEC in that gap.`

- [ ] Implémenté
- [ ] Testé : `test/trace-ears-gap.test.js::CA-005`

### CA-006 — Projet sans SPEC EARS

> Pattern : Unwanted behaviour

`IF the project contains no SPEC with "Format : EARS", THEN the gap checker SHALL report "earsSpecsSansTests" as an empty list without emitting any gap warning.`

- [ ] Implémenté
- [ ] Testé : `test/trace-ears-gap.test.js::CA-006`

## 4. Interface / API

Extension de `lib/sdd-trace.js` :

```js
// compterGapsBloquants(matrice) — ajout
gaps.earsSpecsSansTests = matrice.specs
  .filter(s => s.format === 'EARS' && !['draft','archived'].includes(s.statut))
  .filter(s => !aTestLie(s.id, matrice))
  .map(s => s.id);
```

Champ `trace.json` ajouté :
```json
{
  "gaps": {
    "specsValideesNonImplementees": [...],
    "earsSpecsSansTests": ["SPEC-019-1"]
  }
}
```

## 5. Dépendances

- SPEC-019-1 — commande `suggest-tests` référencée dans CA-005 et dans le DoOD
- `lib/sdd-trace.js:1065` — `compterGapsBloquants()` à étendre
- `lib/sdd-trace.js:462` — `construireMatrice()` doit exposer `spec.format` et `spec.statut`

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~300 tokens
- Cette SPEC : ~500 tokens
- `lib/sdd-trace.js` (sections 462–605 + 1065–1075) : ~400 tokens
- SPEC-019-1 (interface `suggest-tests`) : ~200 tokens
- **Total estimé** : ~1 400 tokens

## 7. Definition of Output Done (DoOD)

- [x] `compterGapsBloquants()` étendu avec `earsSpecsSansTests`
- [x] `construireMatrice()` expose `format` et `statut` par SPEC
- [x] `trace.json` et `trace.md` incluent la section `earsSpecsSansTests`
- [x] `--suggest` affiche `npx aiad-sdd suggest-tests` pour chaque SPEC dans le gap
- [x] Tests `test/trace-ears-gap.test.js` couvrant CA-001 à CA-006 (7/7 pass)
- [x] **EARS lint : 0 violation** (`/sdd gate` — 2026-06-23)
- [x] Annotations `@spec SPEC-019-2-trace-ears-gap` + `@verified-by` posées dans `test/trace-ears-gap.test.js`
- [x] SPEC mise à jour (Drift Lock)
- [x] GitHub Action `sdd-trace.yml` : `--fail-on-gap` couvre le nouveau gap via `compterGapsBloquants()` étendu
