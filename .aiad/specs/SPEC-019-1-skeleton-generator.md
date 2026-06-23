**Intent parent** : INTENT-019
**Auteur** : Steeve Evers
**Date** : 2026-06-23
**Statut** : done
**Format** : EARS
**SQS** : 5/5 (Gate OUVERTE — 2026-06-23)

---

## 1. Contexte

INTENT-019 veut que les SPECs EARS soient vérifiables par construction. `ears-validator` valide la syntaxe mais ne génère aucun test exécutable. Cette SPEC couvre le **générateur de squelettes** : `npx aiad-sdd suggest-tests SPEC-NNN-N` produit un fichier `test/SPEC-NNN-N.test.js` pré-rempli avec un cas par CA-NNN, annoté `@spec` + `@verified-by`, prêt pour implémentation humaine.

## 2. Comportement Attendu

### Input

- Chemin ou ID d'une SPEC Markdown (ex. `SPEC-019-1` ou `.aiad/specs/SPEC-019-1-skeleton-generator.md`)
- Flags optionnels : `--force` (écrase si existant), `--dry-run` (affiche sans écrire)

### Processing

1. Lire le fichier SPEC, vérifier la présence de `Format : EARS` dans l'en-tête.
2. Extraire chaque section `### CA-NNN — <titre>` et son pattern EARS (ligne `> Pattern : …`).
3. Générer un fichier `test/SPEC-NNN-N.test.js` avec :
   - En-tête : `// @spec SPEC-NNN-N` + `// @verified-by test/SPEC-NNN-N.test.js`
   - Un bloc `test('CA-NNN — <titre>', () => { todo() })` par CA-NNN
4. Écrire le fichier ou afficher (dry-run).

### Output

Fichier `test/SPEC-NNN-N.test.js` au format `node:test` :

```js
// @spec SPEC-019-1-skeleton-generator
// @verified-by test/SPEC-019-1.test.js
import { test, todo } from 'node:test';

test('CA-001 — Génération depuis SPEC EARS valide', () => { todo() });
test('CA-002 — Annotation en-tête présente', () => { todo() });
// …
```

### Cas limites

- SPEC sans `Format : EARS` → exit 1, message explicite, aucun fichier créé
- SPEC sans aucune section `CA-NNN` → exit 1, message explicite
- Fichier test déjà existant (sans `--force`) → exit 1, message "already exists"
- `--dry-run` → affiche le contenu sur stdout, exit 0, aucune écriture disque
- SPEC avec `CA-NNN` dont le titre contient des guillemets ou backticks → escaping correct dans la chaîne `test('…')`

## 3. Critères d'Acceptation (EARS)

### CA-001 — Génération depuis SPEC EARS valide

> Pattern : Event-driven

`WHEN a PE runs "npx aiad-sdd suggest-tests <SPEC-id>" on a SPEC with "Format : EARS" and ≥ 1 CA-NNN section, the generator SHALL write "test/<SPEC-id>.test.js" to disk.`

- [ ] Implémenté
- [ ] Testé : `test/suggest-tests.test.js::CA-001`

### CA-002 — Un cas de test par CA-NNN

> Pattern : Ubiquitous

`The generator SHALL include exactly one "test('CA-NNN — <titre>', () => { todo() })" entry per CA-NNN section found in the SPEC.`

- [ ] Implémenté
- [ ] Testé : `test/suggest-tests.test.js::CA-002`

### CA-003 — Annotations machine-vérifiables en en-tête

> Pattern : Ubiquitous

`The generator SHALL write "// @spec <SPEC-id>" and "// @verified-by test/<SPEC-id>.test.js" as the first two lines of the generated file.`

- [ ] Implémenté
- [ ] Testé : `test/suggest-tests.test.js::CA-003`

### CA-004 — Protection contre l'écrasement (exit code)

> Pattern : Unwanted behaviour

`IF the target test file already exists AND "--force" is absent, THEN the generator SHALL terminate with exit code 1 without modifying the existing file.`

- [ ] Implémenté
- [ ] Testé : `test/suggest-tests.test.js::CA-004`

### CA-004b — Protection contre l'écrasement (message d'erreur)

> Pattern : Unwanted behaviour

`IF the target test file already exists AND "--force" is absent, THEN the generator SHALL write "already exists — use --force to overwrite" to stderr.`

- [ ] Implémenté
- [ ] Testé : `test/suggest-tests.test.js::CA-004b`

### CA-005 — Rejet SPEC non-EARS (exit code)

> Pattern : Unwanted behaviour

`IF the SPEC does not declare "Format : EARS", THEN the generator SHALL terminate with exit code 1 without creating any file.`

- [ ] Implémenté
- [ ] Testé : `test/suggest-tests.test.js::CA-005`

### CA-005b — Rejet SPEC non-EARS (message d'erreur)

> Pattern : Unwanted behaviour

`IF the SPEC does not declare "Format : EARS", THEN the generator SHALL write "not an EARS spec — run /sdd spec --ears first" to stderr.`

- [ ] Implémenté
- [ ] Testé : `test/suggest-tests.test.js::CA-005b`

### CA-006 — Rejet SPEC sans CA (exit code)

> Pattern : Unwanted behaviour

`IF the SPEC declares "Format : EARS" but contains no "### CA-NNN" section, THEN the generator SHALL terminate with exit code 1 without creating any file.`

- [ ] Implémenté
- [ ] Testé : `test/suggest-tests.test.js::CA-006`

### CA-006b — Rejet SPEC sans CA (message d'erreur)

> Pattern : Unwanted behaviour

`IF the SPEC declares "Format : EARS" but contains no "### CA-NNN" section, THEN the generator SHALL write "no acceptance criteria found" to stderr.`

- [ ] Implémenté
- [ ] Testé : `test/suggest-tests.test.js::CA-006b`

### CA-007 — Mode dry-run

> Pattern : Optional feature

`WHERE "--dry-run" is passed, the generator SHALL print the generated file content to stdout without writing any file to disk.`

- [ ] Implémenté
- [ ] Testé : `test/suggest-tests.test.js::CA-007`

## 4. Interface / API

```
npx aiad-sdd suggest-tests <SPEC-id|path> [--force] [--dry-run]

Exit codes :
  0  — succès (fichier écrit ou dry-run)
  1  — erreur (SPEC non-EARS / sans CA / fichier déjà existant sans --force)
```

Nouveau module : `lib/test-skeleton-generator.js`
Export : `genererSquelettesTests(specPath, options)` → `{ outputPath, content, skipped }`

Enregistrement CLI dans `bin/aiad-sdd.js` :
```js
case 'suggest-tests': await suggestTests(argv); break;
```

## 5. Dépendances

- `lib/dashboard/acceptance-criteria.js` — `extraireCriteres()` réutilisé pour parser les CA-NNN
- RESEARCH-025 — Discovery ancré, GO tranché

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~300 tokens
- Cette SPEC : ~600 tokens
- `lib/dashboard/acceptance-criteria.js` (parseur EARS) : ~200 tokens
- `bin/aiad-sdd.js` (routing CLI) : ~150 tokens
- `test/dashboard-digest.test.js` (référence convention) : ~100 tokens
- **Total estimé** : ~1 350 tokens

## 7. Definition of Output Done (DoOD)

- [x] `lib/test-skeleton-generator.js` créé, lint passing
- [x] Commande `aiad-sdd suggest-tests` enregistrée dans le CLI
- [x] Tests `test/suggest-tests.test.js` couvrant CA-001/002/003/004/004b/005/005b/006/006b/007
- [x] **EARS lint : 0 violation** (`/sdd gate`)
- [x] Annotations `@spec SPEC-019-1-skeleton-generator` + `@verified-by` posées dans `test/suggest-tests.test.js`
- [x] SPEC mise à jour si écart (Drift Lock)
- [x] RGESN vérifié (aucune dépendance lourde ajoutée)
