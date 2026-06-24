---
id: SPEC-026-1
title: Commande `archive done` — archivage des artefacts done (Intents + SPECs)
intent: INTENT-026
research: RESEARCH-027
author: Steeve Evers
date: 2026-06-24
status: validation
format: EARS
sqs: 5/5
---

# SPEC-026-1 — Commande `archive done`

**Intent parent** : INTENT-026
**Research** : RESEARCH-027 (GO — 90 %)
**Auteur** : Steeve Evers
**Date** : 2026-06-24
**Statut** : validation
**Format** : EARS
**SQS** : 5/5

---

## 1. Contexte

Les répertoires `.aiad/intents/` et `.aiad/specs/` accumulent des artefacts au
statut `done` sans mécanisme de déplacement. Après 27 intents et ~49 specs,
le signal/bruit (actif vs clôturé) dégrade la lisibilité du cycle SDD. Cette
SPEC introduit la commande `aiad-sdd archive done` qui déplace les artefacts
éligibles vers leurs répertoires `archive/` respectifs, sur décision explicite
du PE (pas d'archivage silencieux).

## 2. Comportement Attendu

### Input

```
aiad-sdd archive done [--apply] [--dry-run] [--reason <texte>]
```

- Sans flag : mode preview — affiche les candidats, ne modifie aucun fichier.
- `--apply` : archive effectivement les candidats éligibles.
- `--dry-run` : alias explicite de l'absence de flag (preview).
- `--reason <texte>` : raison d'archivage inscrite dans le frontmatter (défaut : `"archive done"`).

Candidats éligibles : fichiers `.aiad/intents/*.md` et `.aiad/specs/*.md`
(racine seulement, pas de récursion) avec frontmatter `status: done` **et**
`safe: true` (l'ID n'est plus référencé dans le code source via `@spec`/`@intent`).

### Processing

1. `listerLivrables(racine)` dans `lib/archive.js` — lit les candidats, calcule `safe`.
2. Filtrer `safe: true` uniquement (option A : les `safe: false` sont ignorés silencieusement).
3. En mode preview : afficher la liste.
4. En mode `--apply` : pour chaque candidat, appeler `archiver(racine, id, { raison, dryRun: false })`.
   - Déplace le fichier vers `archive/` (crée le répertoire si absent).
   - Patche le frontmatter : `status: archived`, `archivedAt` (ISO 8601), `archivedBy`, `archivedReason`.
   - Appends un événement dans `.aiad/audit/audit.jsonl`.

### Output

**Mode preview / dry-run** :
```
Artefacts éligibles à archiver (safe: true, status: done) :
  INTENT-001 — Feedback qualitatif utilisateurs SDD Mode
  INTENT-002 — Gouvernance SDD enforced
  …
  SPEC-001-1 — Feedback qualitatif opt-in
  …
  Total : N artefact(s). Lance --apply pour archiver.
```

**Mode --apply** :
```
✓ INTENT-001 archivé → .aiad/intents/archive/INTENT-001-feedback-qualitatif.md
✓ SPEC-001-1 archivé → .aiad/specs/archive/SPEC-001-1-feedback-qualitatif.md
…
Archivage terminé : N artefact(s) déplacé(s).
```

**Aucun candidat** :
```
Aucun artefact éligible à archiver.
```

### Cas limites

1. **Tous les `done` sont `safe: false`** : aucun candidat affiché, sortie propre.
2. **Répertoire `archive/` inexistant** : créé automatiquement avant le premier déplacement.
3. **Fichier déjà dans `archive/`** : `localiserArtefact()` le détecte, `archiver()` lève une erreur — à afficher proprement sans crash.
4. **`--apply` sans candidat** : affiche "Aucun artefact éligible à archiver." et exit 0.
5. **`--reason` non fourni** : valeur par défaut `"archive done"` appliquée silencieusement.

## 3. Critères d'Acceptation (EARS)

### CA-001 — Listing des candidats

> Pattern : Event-driven

`WHEN the user runs \`aiad-sdd archive done\`, the CLI SHALL display the ID and title of each \`.aiad/intents/\` and \`.aiad/specs/\` artefact with frontmatter \`status: done\` and \`safe: true\`.`

- [x] Implémenté
- [x] Testé : `test/archive.test.js::archive done — CA-001 affiche la liste des candidats safe`

### CA-002 — Pas de mutation sans --apply

> Pattern : Unwanted behaviour

`IF \`aiad-sdd archive done\` is invoked without \`--apply\`, THEN the CLI SHALL preserve all artefact files in their original directories.`

- [x] Implémenté
- [x] Testé : `test/archive.test.js::archive done — CA-002 sans --apply aucune mutation`

### CA-003 — Déplacement des fichiers avec --apply

> Pattern : Event-driven

`WHEN the user runs \`aiad-sdd archive done --apply\`, the CLI SHALL move each eligible artefact file to the \`archive/\` subdirectory of its parent directory (\`.aiad/intents/archive/\` or \`.aiad/specs/archive/\`).`

- [x] Implémenté
- [x] Testé : `test/archive.test.js::archive done — CA-003 --apply déplace les fichiers`

### CA-004 — Patch frontmatter à l'archivage

> Pattern : Event-driven

`WHEN \`aiad-sdd archive done --apply\` moves an artefact, the CLI SHALL update its frontmatter with \`status: archived\`, \`archivedAt\` (ISO 8601 timestamp), \`archivedBy\` (git user email), and \`archivedReason\`.`

- [x] Implémenté
- [x] Testé : `test/archive.test.js::archive done — CA-004 patch frontmatter`

### CA-005 — Exclusion silencieuse des safe: false

> Pattern : Unwanted behaviour

`IF an artefact has frontmatter \`status: done\` and \`safe: false\`, THEN the CLI SHALL exclude it from the candidate list without displaying any warning.`

- [x] Implémenté
- [x] Testé : `test/archive.test.js::archive done — CA-005 safe: false exclu silencieusement`

### CA-006 — Création du répertoire archive/ si absent

> Pattern : Unwanted behaviour

`IF the \`archive/\` subdirectory does not exist when \`aiad-sdd archive done --apply\` runs, THEN the CLI SHALL create it before moving any file.`

- [x] Implémenté
- [x] Testé : `test/archive.test.js::archive done — CA-006 crée archive/ si absent`

### CA-007 — Aucun candidat éligible

> Pattern : Event-driven

`WHEN \`aiad-sdd archive done\` finds zero eligible artefacts, the CLI SHALL display "Aucun artefact éligible à archiver."`

- [x] Implémenté
- [x] Testé : `test/archive.test.js::archive done — CA-007 zéro candidat`

### CA-008 — Entrée audit par artefact archivé

> Pattern : Event-driven

`WHEN \`aiad-sdd archive done --apply\` archives an artefact, the CLI SHALL append one event entry to \`.aiad/audit/audit.jsonl\` per archived artefact.`

- [x] Implémenté
- [x] Testé : `test/archive.test.js::archive done — CA-008 audit entry par artefact archivé`

### CA-009 — Robustesse trace : exclusion explicite de archive/

> Pattern : Ubiquitous

`The artefact reader in \`lib/sdd-trace.js\` SHALL skip directory entries named \`archive\` when iterating over \`.aiad/intents/\` and \`.aiad/specs/\` with \`readdirSync()\`.`

- [x] Implémenté
- [x] Testé : `test/trace.test.js::construireMatrice — CA-009 exclut les artefacts dans archive/`

### CA-010 — collect.js : archive/ exclue des artefacts actifs

> Pattern : Ubiquitous

`The \`lireIntents()\` and \`lireSpecs()\` functions in \`lib/dashboard/collect.js\` SHALL return only files located in the root of their respective directory, excluding any file inside an \`archive/\` subdirectory.`

- [x] Implémenté (déjà vrai par construction — `listerFichiersMd` ne descend pas)
- [x] Testé : `test/dashboard-collect.test.js::lireIntents — CA-010 exclut les fichiers dans archive/`

## 4. Interface / API

```
# Preview (aucune mutation)
aiad-sdd archive done
aiad-sdd archive done --dry-run

# Archivage effectif
aiad-sdd archive done --apply
aiad-sdd archive done --apply --reason "Atelier intention 2026-06"

# Sortie JSON (pour CI / scripts)
aiad-sdd archive done --json
aiad-sdd archive done --apply --json
```

Nouvelles fonctions dans `lib/archive.js` :

```js
/**
 * Archive tous les artefacts éligibles (safe: true, status: done).
 * @param {string} racine   — racine projet
 * @param {object} options  — { raison, dryRun, json }
 * @returns {{ total: number, archived: number, skipped: number, items: object[] }}
 */
export function archiverTous(racine, options = {}) { … }
```

Dispatch dans `bin/aiad-sdd.js` — branche ajoutée dans `case 'archive'` (ligne ~2549) :

```js
if (positionals[1] === 'done' || values.done) {
  const { archiverTous } = await import('../lib/archive.js');
  const r = archiverTous(cwd(), {
    raison: values.reason || 'archive done',
    dryRun: !values.apply,
    json: values.json,
  });
  // affichage + exit
}
```

Modification dans `lib/sdd-trace.js` (×2, `lireIntents` et `lireSpecs`) :

```js
for (const nom of readdirSync(dir)) {
  if (nom === 'archive' || !nom.endsWith('.md') || nom.startsWith('_')) continue;
  …
}
```

## 5. Dépendances

- `lib/archive.js` — `archiver()`, `listerLivrables()`, `STATUTS_LIVRES` (existants)
- `bin/aiad-sdd.js:2549` — `case 'archive'` (existant, à étendre)
- `lib/sdd-trace.js:226` — `lireIntents()` (existant, à renforcer)
- `lib/sdd-trace.js:251` — `lireSpecs()` (existant, à renforcer)
- `test/archive.test.js` — tests existants (à compléter)
- `test/dashboard-collect.test.js` — tests existants (à compléter)
- `test/trace.test.js` — tests existants (à compléter)

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~400 tokens
- Cette SPEC : ~700 tokens
- `lib/archive.js` (405 lignes) : ~900 tokens
- `bin/aiad-sdd.js` zones dispatch (~50 lignes) : ~150 tokens
- `lib/sdd-trace.js` zones lireIntents/lireSpecs (~50 lignes) : ~150 tokens
- **Total estimé** : ~2 300 tokens (≪ 60 % de 200k — contexte sain)

## 7. Definition of Output Done (DoOD)

- [x] `lib/archive.js` — `archiverTous()` implémentée et exportée (`lib/archive.js:365`)
- [x] `bin/aiad-sdd.js` — branche `done` dans `case 'archive'` opérationnelle (`bin/aiad-sdd.js:2563`)
- [x] `lib/sdd-trace.js` — guard `archive/` explicite dans `lireIntents()` et `lireSpecs()`
- [x] Tests CA-001 à CA-010 verts (node --test) — 64 tests verts (36 + 12 + 16)
- [x] **EARS lint : 0 violation** (validé à la gate, SQS 5/5)
- [x] `npx aiad-sdd trace --fail-on-gap` exit 0 — SPECs validées non-implémentées : 0
- [x] Annotations `@spec SPEC-026-1-archive-done` posées sur les fonctions modifiées
- [x] Fix post-livraison : `import { C } from '../lib/term.js'` ajouté dans `bin/aiad-sdd.js` (ReferenceError au runtime — `C` utilisé mais non importé dans le bin)
- [x] Gouvernance vérifiée : PASS (AI-ACT/RGPD/RGAA/RGESN)
