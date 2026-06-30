---
status: archived
archivedAt: "2026-06-30T07:28:53.217Z"
archivedBy: evers.steeve@gmail.com
archivedReason: archive done
---
# SPEC-029-1 — Extension de l'archivage aux FACTs résolus

**Intent parent** : INTENT-029
**Research** : RESEARCH-039 (GO 95 %)
**Auteur** : Steeve Evers
**Date** : 2026-06-29
**Statut** : done
**Format** : prose
**SQS** : 5/5
**validated_at** : 2026-06-29

---

## 1. Contexte

INTENT-026 a livré l'archivage automatique des Intents et SPECs `done`. Les FACTs ont été omis : `TYPES_ARTEFACTS` et `SOUS_DOSSIERS_LIVRABLES` dans `lib/archive.js` ne couvrent pas le préfixe `FACT-`, et `STATUTS_LIVRES` ne contient pas `'résolu'`. Résultat : `.aiad/facts/` accumule indéfiniment les FACTs résolus, polluant le contexte agent et l'index de traçabilité (FACT-009).

L'extension est strictement additive — le pipeline `archiver()` / `archiverTous()` est entièrement réutilisable sans refactoring.

## 2. Comportement Attendu

### Input

- Commande `aiad-sdd archive FACT-NNN` — ID d'un FACT spécifique.
- Commande `aiad-sdd archive --all` / `archive done` — archivage en masse.
- FACTs éligibles : tout fichier `.aiad/facts/FACT-*.md` dont le frontmatter contient `status: résolu` ou `status: done`.

### Processing

1. `detecterSousDossier('FACT-NNN')` résout `facts/` via l'entrée ajoutée dans `TYPES_ARTEFACTS`.
2. `listerLivrables()` scanne `.aiad/facts/` (via `SOUS_DOSSIERS_LIVRABLES`) et filtre sur `STATUTS_LIVRES` (qui inclut désormais `'résolu'`).
3. `archiver()` patche le frontmatter (`status: archived`, `archivedAt`, `archivedBy: aiad-sdd`, `archivedReason: status résolu/done`) et déplace le fichier vers `.aiad/facts/archive/` (créé si absent) via `renameSync()`.
4. `collecterObservations()` dans `lib/memory.js` ignore le dossier `facts/archive/` (filtre `nom === 'archive'` symétrique à `sdd-trace.js`).
5. `construireMatrice()` dans `lib/sdd-trace.js` ignore `facts/archive/` lors de la lecture des FACTs actifs — les FACTs archivés ne génèrent pas de gaps orphelins.

### Output

- Fichier déplacé : `.aiad/facts/FACT-NNN-*.md` → `.aiad/facts/archive/FACT-NNN-*.md`
- Frontmatter patchée avec `status: archived`, `archivedAt: <ISO8601>`, `archivedBy: aiad-sdd`, `archivedReason: <valeur du status original>`
- Log CLI : `✓ FACT-NNN archivé → .aiad/facts/archive/`
- Dry-run (défaut) : liste les candidats sans déplacer ; `--apply` exécute.

### Cas limites

- **FACT avec `status: ouvert` ou `status: partiellement résolu`** : non éligible, ignoré par `listerLivrables()`.
- **`facts/archive/` inexistant** : créé automatiquement par `archiver()` (pattern existant).
- **FACT déjà archivé** (présent dans `facts/archive/`) : `localiserArtefact()` le trouve dans `dirArchive`, `archiver()` retourne une erreur non-bloquante `"déjà archivé"`.
- **Frontmatter absent ou malformé** : le parseur frontmatter existant retourne `{}` ; le filtre `status` ne matche pas → FACT ignoré (comportement sûr, cohérent avec intents/specs).
- **`aiad-sdd archive FACT-NNN` sur un FACT non résolu** : archivage forcé par ID direct (comportement existant — l'utilisateur override explicitement).

## 3. Critères d'Acceptation

- [ ] CA-1 : `aiad-sdd archive FACT-009 --apply` déplace `FACT-009-*.md` vers `.aiad/facts/archive/` et retourne exit 0.
- [ ] CA-2 : après `aiad-sdd archive --all --apply`, `ls .aiad/facts/*.md | xargs grep -l "status: résolu\|status: done"` retourne 0 résultat (aucun FACT éligible restant).
- [ ] CA-3 : le frontmatter du FACT archivé contient `status: archived`, `archivedAt` (ISO 8601), `archivedBy: aiad-sdd`, `archivedReason` non vide.
- [ ] CA-4 : `aiad-sdd archive --all` (sans `--apply`) liste les FACTs éligibles sans les déplacer (dry-run préservé).
- [ ] CA-5 : `aiad-sdd trace` sur un projet contenant `.aiad/facts/archive/FACT-NNN.md` ne génère pas de gap orphelin pour ce FACT.
- [ ] CA-6 : `collecterObservations()` appelée après archivage ne retourne pas les FACTs présents dans `facts/archive/`.
- [ ] CA-7 : `npm run lint:deps` passe — zéro nouvelle dépendance npm ajoutée.
- [ ] CA-8 : `npm test` passe — les nouveaux tests FACT dans `test/archive.test.js` couvrent `detecterSousDossier('FACT-001')`, `listerLivrables()` avec FACT résolu, `archiverTous()` avec FACT.

## 4. Interface / API

Pas de changement d'API publique. Changements internes dans `lib/archive.js` :

```js
// lib/archive.js — additions strictement additives

// TYPES_ARTEFACTS (ligne ~46) — ajouter l'entrée facts :
const TYPES_ARTEFACTS = {
  intents: { ... },  // existant
  specs:   { ... },  // existant
  facts:   { prefixes: ['FACT-'], sousDossier: 'facts' },  // NOUVEAU
};

// SOUS_DOSSIERS_LIVRABLES (ligne ~321) — ajouter 'facts' :
const SOUS_DOSSIERS_LIVRABLES = ['intents', 'specs', 'research', 'facts'];

// STATUTS_LIVRES (ligne ~326) — ajouter 'résolu' :
const STATUTS_LIVRES = new Set([..., 'résolu']);
```

```js
// lib/memory.js — collecterObservations() (ligne ~86) — filtre symétrique :
if (nom === 'archive' || nom.startsWith('_')) continue;
```

```js
// lib/sdd-trace.js — lecture FACTs (pattern symétrique à lireIntents/lireSpecs) :
if (nom === 'archive' || nom.startsWith('_')) continue;
```

## 5. Dépendances

- `lib/archive.js` — fichier principal (3 constantes à étendre)
- `lib/memory.js` — correctif filtre `archive/` dans `collecterObservations()`
- `lib/sdd-trace.js` — filtre `facts/archive/` dans la lecture des FACTs actifs
- `test/archive.test.js` — nouveaux tests FACT (helper `ecrireFact()` + 3 suites)
- Pas de dépendance sur d'autres SPECs en cours.

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE condensé : ~300 tokens
- Cette SPEC : ~600 tokens
- Fichiers source pertinents : `lib/archive.js` (~500 tokens), `lib/memory.js` (~200 tokens), `lib/sdd-trace.js` (~300 tokens), `test/archive.test.js` (~400 tokens)
- **Total estimé** : ~2 300 tokens (confortable sur Sonnet 4.6 200k)

## 7. Definition of Output Done (DoOD)

- [ ] `npm test` passe (tests FACT ajoutés dans `test/archive.test.js`)
- [ ] `npm run lint:deps` passe (zéro nouvelle dépendance)
- [ ] `aiad-sdd archive --all --apply` archive les 4 FACTs éligibles existants (FACT-006, FACT-008, FACT-009, FACT-014)
- [ ] `aiad-sdd trace` ne génère pas de gaps pour les FACTs archivés
- [ ] SPEC mise à jour si écart découvert pendant l'implémentation (Drift Lock)
- [ ] Gouvernance : RGESN applicable (pas de runtime IO nouveau, pas de RGPD/RGAA/AI-ACT)
