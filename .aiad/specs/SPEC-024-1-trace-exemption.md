---
id: SPEC-024-1
title: Exemption de traçabilité pour SPECs sans code applicatif
parent_intent: INTENT-024
research: court-circuitée (cf. §2)
status: done
format: EARS
sqs: 5.0
author: Steeve Evers
date: 2026-06-19
governance:
---

# SPEC-024-1 — Exemption de traçabilité pour SPECs sans code applicatif

**Intent parent** : INTENT-024 · **Origine** : [[FACT-004]]
**Statut** : done
**Gouvernance** : aucune (outillage interne, pas d'IA/données perso/UI ; RGESN
non significatif — aucune dépendance ajoutée, contrainte zéro-dep préservée).

## 1. Contexte

`lib/sdd-trace.js` calcule le gap `specsValideesNonImplementees` (ligne 535) :
toute SPEC en statut `ready`/`validation`/`done` sans `@spec` dans un fichier de
`EXTENSIONS_CODE` (ligne 70 — code applicatif uniquement) est comptée comme
« validée non implémentée », ce qui fait échouer le trace `--fail-on-gap` et le
Stop hook. Les SPECs au livrable documentaire/CI/contenu n'ont aucun fichier
scanné où poser `@spec` → faux gap (FACT-004). Cette SPEC ajoute une **exemption
explicite** au frontmatter pour ces SPECs.

## 2. Court-circuit Research (§3.5)

**Décision** : Research court-circuitée — Steeve Evers (PE), 2026-06-19.
**Justification** : faisabilité nulle en risque — Discovery déjà faite dans
FACT-004 (mécanisme, ligne exacte, fix proposé identifiés). Surface : un seul
prédicat dans une fonction pure de `sdd-trace.js`. **Proportionnalité** : garde-fou
levé sciemment et tracé.

## 3. Comportement attendu

### Input
- Les SPECs de `.aiad/specs/*.md` avec leur frontmatter parsé (`parseFrontmatter`),
  dont un champ **optionnel** `traceability` (valeur attendue : `exempt`) et un
  champ **`traceability_reason`** (texte libre, obligatoire si exempt).

### Processing
1. À la construction des gaps, une SPEC est **exemptée** du gap
   `specsValideesNonImplementees` si et seulement si `traceability === 'exempt'`
   ET `traceability_reason` est une chaîne non vide.
2. Une SPEC marquée `exempt` **sans** raison non vide n'est **pas** exemptée
   (configuration invalide → fail-honest, le gap reste).
3. L'exemption n'affecte **que** ce gap : `specsSansCode` (informatif, non
   bloquant) et tous les autres gaps sont inchangés.

### Output
- Le modèle de trace expose les SPECs exemptées dans un champ dédié
  (`specsExemptees`) pour visibilité ; le compteur `specsValideesNonImplementees`
  les exclut.

### Cas limites
1. SPEC `done` + `traceability: exempt` + raison → exemptée (pas de gap).
2. SPEC `done` + `traceability: exempt` SANS raison → non exemptée (gap maintenu).
3. SPEC `done` sans champ `traceability` et sans code → gap maintenu (rétro-compat).
4. SPEC `exempt` mais qui possède DU code annoté → pas de gap de toute façon ;
   l'exemption est inerte (pas d'effet de bord).

## 4. Critères d'Acceptation (EARS)

### CA-001 — Exemption valide

> Pattern : Optional feature

`WHERE a SPEC declares traceability: exempt with a non-empty traceability_reason, the trace engine SHALL exclude that SPEC from the specsValideesNonImplementees gap.`

- [x] Implémenté
- [x] Testé : `test/trace.test.js`

### CA-002 — Exemption sans raison rejetée

> Pattern : Unwanted behaviour

`IF a SPEC declares traceability: exempt with an empty or missing traceability_reason, THEN the trace engine SHALL keep that SPEC in the specsValideesNonImplementees gap.`

- [x] Implémenté
- [x] Testé : `test/trace.test.js`

### CA-003 — Rétro-compatibilité

> Pattern : Ubiquitous

`The trace engine SHALL count a frozen-status SPEC (ready, validation or done) that has no code annotation and no traceability exemption as a specsValideesNonImplementees gap.`

- [x] Implémenté
- [x] Testé : `test/trace.test.js`

### CA-004 — Visibilité des exemptées

> Pattern : Ubiquitous

`The trace engine SHALL expose every exempted SPEC in a dedicated specsExemptees collection of the trace model.`

- [x] Implémenté
- [x] Testé : `test/trace.test.js`

### CA-005 — Isolation du périmètre

> Pattern : Ubiquitous

`The trace engine SHALL leave every gap other than specsValideesNonImplementees unchanged for an exempted SPEC.`

- [x] Implémenté
- [x] Testé : `test/trace.test.js`

## 5. Interface / API

> ⚠ **Convention de clés** : `parseFrontmatter` (lib/frontmatter.js) **ne camélise
> pas** — les clés sont brutes (regex `^([A-Za-z_][\w-]*)`). Comme partout dans
> `sdd-trace.js` (`data.parent_intent`, `data.statut`…), on lit donc
> `data.traceability` et `data.traceability_reason` en **snake_case**.

**Étape A — exposer les champs sur l'objet `spec`** au site de parsing des SPECs
(`lireSpecs`, sdd-trace.js ~274), à côté de `status`/`title` :

```js
traceability: String(data.traceability || '').toLowerCase(),
traceabilityReason: typeof data.traceability_reason === 'string'
  ? data.traceability_reason
  : '',
```

**Étape B — calcul des gaps** (~ligne 535) :

```js
const estExempte = (s) =>
  s.traceability === 'exempt' && s.traceabilityReason.trim().length > 0;

specsValideesNonImplementees: specs
  .filter((s) => ['ready', 'validation', 'done'].includes(s.status))
  .filter((s) => !codeParSpec.has(shortSpecId(s.id)))
  .filter((s) => !estExempte(s)),         // ← nouvelle exclusion
specsExemptees: specs.filter(estExempte), // ← visibilité
```

```yaml
# Frontmatter d'une SPEC sans code applicatif (clés snake_case)
traceability: exempt
traceability_reason: "Livrable documentaire (site/), aucun fichier scanné — FACT-004"
```

## 6. Dépendances

- `lib/sdd-trace.js` (construction des gaps + parsing frontmatter des SPECs).
- `lib/frontmatter.js` (lecture des champs `traceability` / `traceability_reason`).
- Aucune dépendance externe (zéro-dep préservé).

## 7. Definition of Output Done (DoOD)

- [x] `lib/sdd-trace.js` annoté `@intent INTENT-024` / `@spec SPEC-024-1-trace-exemption`
      / `@verified-by test/trace.test.js`.
- [x] Tests `node --test` couvrant CA-001 à CA-005 (11/11 verts).
- [x] SPEC-013-1a/013-2/013-4a basculées `done` + `traceability: exempt` + raison ;
      013-3 `review`→`done` (a du code). Même PR (Drift Lock).
- [x] `_index.md` SPECs + intents mis à jour ; INTENT-024 `done`.
- [x] FACT-004 `ouvert → résolu`.
