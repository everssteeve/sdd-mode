---
id: SPEC-026-2
title: "`archive done` — éligibilité SPECs `split` + détection originaux orphelins"
intent: INTENT-026
research: RESEARCH-027
fact: FACT-014
author: Steeve Evers
date: 2026-06-25
status: draft
format: EARS
sqs: À évaluer via /sdd gate
---

# SPEC-026-2 — `archive done` : SPECs `split` + originaux orphelins

**Intent parent** : INTENT-026
**Research** : RESEARCH-027 (GO — 90 %) — Discovery réutilisé ; SPEC-026-2 étend les mêmes fichiers (`lib/archive.js`, `bin/aiad-sdd.js`). Proportionnalité tracée ici (pas de nouvelle Research).
**Fact déclencheur** : FACT-014
**Auteur** : Steeve Evers
**Date** : 2026-06-25
**Statut** : draft
**Format** : EARS
**SQS** : À évaluer via /sdd gate

---

## 1. Contexte

`aiad-sdd archive done` (SPEC-026-1) identifie les candidats à l'archivage sur le critère `status: done` + `safe: true`. FACT-014 a révélé deux angles morts : les SPECs parentes marquées `split` (dont toutes les sous-SPECs sont livrées) sont silencieusement ignorées, et les fichiers copiés en `archive/` sans suppression de l'original ne sont jamais signalés.

Cette SPEC étend `listerLivrables` (`lib/archive.js:337`) et ajoute `listerOrphelins` pour couvrir ces deux cas sans modifier le comportement existant.

## 2. Comportement Attendu

### Input

```
aiad-sdd archive done [--apply] [--dry-run] [--reason <texte>]
```

Même interface que SPEC-026-1 — aucun nouveau flag.

### Processing

**Extension 1 — SPECs `split` terminées**

Dans `listerLivrables`, après le filtre `STATUTS_LIVRES.has(status)`, ajouter un second chemin pour le statut `split` :

1. Extraire le préfixe parent depuis l'ID (`SPEC-013-1` → préfixe `SPEC-013-1`).
2. Rechercher dans `.aiad/specs/` (racine + `archive/`) tous les fichiers dont l'ID commence par `<préfixe>` suivi d'une lettre (`/^SPEC-\d+-\d+[a-z]/i`).
3. Si au moins une sous-SPEC existe ET que toutes ont `status: done | archived | delivered | closed` → la SPEC parente est éligible (`safe: true`, `raison: 'Toutes sous-SPECs livrées — archivable.'`).
4. Si aucune sous-SPEC trouvée → ignorer (SPEC split sans sous-SPECs = situation anormale, ne pas archiver silencieusement).
5. Si au moins une sous-SPEC n'est pas terminée → ignorer (pas éligible).

**Extension 2 — Détection des originaux orphelins**

Nouvelle fonction exportée `listerOrphelins(racine)` :

1. Pour chaque sous-dossier dans `['intents', 'specs']` :
   a. Lire les fichiers à la racine du sous-dossier (hors `_index.md`, hors template).
   b. Parser le frontmatter de chaque fichier.
   c. Si `status: archived` dans le frontmatter → vérifier que le fichier N'est PAS dans `archive/` (il ne devrait pas être dans la racine).
   d. Si le fichier est à la racine ET a `status: archived` → ajouter à la liste `orphelins`.
2. Retourner `[{ id, kind, fichier, raison }]`.

**Affichage CLI**

Après la liste des candidats éligibles, si `listerOrphelins` retourne des entrées :

```
⚠  Originaux orphelins détectés (status: archived mais hors archive/) :
  INTENT-030 — Ecologits impact ecologique
  SPEC-030-1 — Eco estimator
  …
  Ces fichiers ont été copiés en archive/ sans suppression de l'original.
  Action : supprimer manuellement ou via `git rm`.
```

Les orphelins ne sont jamais déplacés par `--apply` — le signalement est uniquement informatif.

### Output

**Mode preview** (inchangé pour les candidats normaux, ajout de la section orphelins) :

```
Artefacts éligibles à archiver (safe: true) :
  SPEC-013-1 — Déploiement site v1.18 + résolution « 7 valeurs » (split — toutes sous-SPECs livrées)
  SPEC-017-3 — Digest delta + snapshots persistants
  …
  Total : N artefact(s). Lance --apply pour archiver.

⚠  Originaux orphelins (status: archived, hors archive/) :
  INTENT-030 — Ecologits impact ecologique → supprimer manuellement.
  …
```

**Mode --apply** (inchangé pour les candidats) : les orphelins sont listés mais pas touchés.

**Aucun candidat, aucun orphelin** :

```
Aucun artefact éligible à archiver. Aucun orphelin détecté.
```

### Cas limites

1. **SPEC `split` sans sous-SPECs trouvées** : ignorée silencieusement (ne pas archiver).
2. **SPEC `split` avec au moins une sous-SPEC non terminée** : exclue de la liste des candidats.
3. **Fichier orphelin déjà supprimé du disque** (`status: archived` en frontmatter introuvable) : impossible — la condition de détection requiert que le fichier existe physiquement à la racine.
4. **Sous-dossier `archive/` inexistant** : `listerOrphelins` ne plante pas — retourne `[]` (aucun orphelin possible sans archive).
5. **Frontmatter absent sur une SPEC `split`** : statut non détectable → ignorée (comportement conservateur).

## 3. Critères d'Acceptation (EARS)

### CA-001 — `listerLivrables` inclut les SPECs `split` terminées

> Pattern : State-driven

`WHILE all sub-SPECs of a \`split\` SPEC have \`status: done\`, \`archived\`, \`delivered\`, or \`closed\`, the \`listerLivrables\` function SHALL include the parent SPEC in its returned array with \`safe: true\`.`

- [ ] Implémenté
- [ ] Testé : `test/archive.test.js::listerLivrables — CA-001 SPEC split toutes sous-SPECs done`

### CA-002 — SPEC `split` non terminée exclue

> Pattern : Unwanted behaviour

`IF at least one sub-SPEC of a \`split\` SPEC has a status other than \`done\`, \`archived\`, \`delivered\`, or \`closed\`, THEN the \`listerLivrables\` function SHALL NOT include the parent SPEC in its returned array.`

- [ ] Implémenté
- [ ] Testé : `test/archive.test.js::listerLivrables — CA-002 SPEC split sous-SPEC non terminée exclue`

### CA-003 — SPEC `split` sans sous-SPECs exclue

> Pattern : Unwanted behaviour

`IF a \`split\` SPEC has no matching sub-SPEC files in \`.aiad/specs/\` or \`.aiad/specs/archive/\`, THEN the \`listerLivrables\` function SHALL NOT include it in its returned array.`

- [ ] Implémenté
- [ ] Testé : `test/archive.test.js::listerLivrables — CA-003 SPEC split sans sous-SPECs exclue`

### CA-004 — `listerOrphelins` détecte les originaux hors archive

> Pattern : Event-driven

`WHEN \`listerOrphelins\` is called and a file in \`.aiad/intents/\` or \`.aiad/specs/\` root has frontmatter \`status: archived\`, the \`listerOrphelins\` function SHALL include that file in its returned array with its \`id\`, \`kind\`, and \`fichier\` fields.`

- [ ] Implémenté
- [ ] Testé : `test/archive.test.js::listerOrphelins — CA-004 détecte original avec status archived`

### CA-005a — Orphelins affichés avec avertissement par `--apply`

> Pattern : Unwanted behaviour

`IF \`aiad-sdd archive done --apply\` is invoked and \`listerOrphelins\` returns non-empty results, THEN the CLI SHALL display the orphan list with a \`⚠  Originaux orphelins\` warning header.`

- [ ] Implémenté
- [ ] Testé : `test/archive.test.js::archive done --apply — CA-005a affiche avertissement orphelins`

### CA-005b — Orphelins jamais déplacés par `--apply`

> Pattern : Unwanted behaviour

`IF \`aiad-sdd archive done --apply\` is invoked and \`listerOrphelins\` returns non-empty results, THEN the CLI SHALL NOT move or delete any orphan file.`

- [ ] Implémenté
- [ ] Testé : `test/archive.test.js::archive done --apply — CA-005b orphelins non touchés`

### CA-006 — Affichage de la section orphelins en preview

> Pattern : Event-driven

`WHEN \`aiad-sdd archive done\` is invoked without \`--apply\` and \`listerOrphelins\` returns at least one entry, the CLI SHALL display a \`⚠  Originaux orphelins\` section listing each orphan's ID, title, and the instruction \`→ supprimer manuellement ou via \`git rm\`.\``

- [ ] Implémenté
- [ ] Testé : `test/archive.test.js::archive done — CA-006 affiche section orphelins en preview`

### CA-007a — Message vide quand aucun candidat ni orphelin

> Pattern : Event-driven

`WHEN \`aiad-sdd archive done\` is invoked and both \`listerLivrables\` and \`listerOrphelins\` return empty arrays, the CLI SHALL display \`Aucun artefact éligible à archiver. Aucun orphelin détecté.\`.`

- [ ] Implémenté
- [ ] Testé : `test/archive.test.js::archive done — CA-007a message vide aucun candidat`

### CA-007b — Exit 0 quand aucun candidat ni orphelin

> Pattern : Event-driven

`WHEN \`aiad-sdd archive done\` is invoked and both \`listerLivrables\` and \`listerOrphelins\` return empty arrays, the CLI SHALL exit with code 0.`

- [ ] Implémenté
- [ ] Testé : `test/archive.test.js::archive done — CA-007b exit 0 aucun candidat`

## 4. Interface / API

```js
// lib/archive.js — exports ajoutés / modifiés

/**
 * Identifie les sous-SPECs d'une SPEC parente `split`.
 * @param {string} parentId  ex. "SPEC-013-1"
 * @param {string} specsDir  chemin vers .aiad/specs/
 * @returns {{ id: string, status: string }[]}
 */
function listerSousSpecs(parentId, specsDir) { … }

/**
 * Étend listerLivrables pour inclure les SPECs `split` dont toutes
 * les sous-SPECs sont terminées.
 * Signature inchangée.
 */
export function listerLivrables(racine) { … }

/**
 * Détecte les fichiers artefacts (intents / specs) présents à la racine
 * du sous-dossier mais dont le frontmatter indique `status: archived`.
 *
 * @param {string} racine
 * @returns {{ id: string, kind: string, fichier: string, raison: string }[]}
 */
export function listerOrphelins(racine) { … }
```

```js
// bin/aiad-sdd.js — section case 'archive' / 'done'
// Après affichage des candidats :
const orphelins = listerOrphelins(racine);
if (orphelins.length > 0) {
  console.log('\n⚠  Originaux orphelins (status: archived, hors archive/) :');
  for (const o of orphelins) console.log(`  ${o.id} — ${o.titre} → supprimer manuellement ou via \`git rm\`.`);
}
```

## 5. Dépendances

- `lib/archive.js` — `listerLivrables` (à étendre), `listerOrphelins` (à créer)
- `bin/aiad-sdd.js:2549` — dispatcher `case 'archive'` / branche `done` (affichage orphelins)
- `test/archive.test.js` — 7 nouveaux cas de test (CA-001 à CA-007)
- SPEC-026-1 — comportement existant inchangé (non-régression obligatoire)

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~400 tokens
- Cette SPEC : ~700 tokens
- `lib/archive.js` (337–372) : ~200 tokens
- `bin/aiad-sdd.js` (2549–2602) : ~150 tokens
- `test/archive.test.js` (297–350) : ~150 tokens
- **Total estimé** : ~1 600 tokens

## 7. Definition of Output Done (DoOD)

- [ ] `listerLivrables` inclut les SPECs `split` terminées (CA-001)
- [ ] `listerOrphelins` exportée et fonctionnelle (CA-004)
- [ ] CLI affiche section orphelins sans jamais les déplacer (CA-005, CA-006)
- [ ] 7 nouveaux tests passent (CA-001 à CA-007)
- [ ] Tests existants `archive.test.js` non régressés
- [ ] EARS lint : 0 violation
- [ ] Annotations `@spec SPEC-026-2` posées dans les fichiers modifiés
- [ ] Drift Lock : SPEC-026-2 + code dans la même PR
- [ ] Gouvernance RGESN : aucune requête réseau ajoutée — lecture fichiers locale uniquement
