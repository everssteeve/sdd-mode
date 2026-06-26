---
status: archived
archivedAt: "2026-06-26T12:02:40.782Z"
archivedBy: evers.steeve@gmail.com
archivedReason: INTENT-021 complété — SPEC-021-1 (attribution tokens) + SPEC-021-2 (restitution /sdd context) livrées, 4170 tests, drift lock OK
---
# SPEC-021-2-restitution-empreinte-context — variante EARS

**Intent parent** : INTENT-021
**Auteur** : Steeve Evers
**Date** : 2026-06-25
**Statut** : done
**Format** : EARS
**SQS** : 5/5
**Research** : RESEARCH-034 (CONDITIONAL GO, conditions C1/C2/C3)

---

## 1. Contexte

SPEC-021-1 produit l'attribution des tokens par Intent/SPEC (`collecterEmpreinteParArtefact`). Cette SPEC **restitue** cette empreinte dans la commande `/sdd context` (`.claude/sdd/context.md`), pour fermer la boucle de sobriété (Art. IV). Périmètre borné A+B de RESEARCH-034 : **pas de page dashboard « Valeur »** (reportée tant que la décision sur INTENT-018 archivé n'est pas prise — condition C1).

## 2. Comportement Attendu

### Input

- `.aiad/metrics/hook-runs.jsonl` enrichi par SPEC-021-1.
- Optionnel : un ID de SPEC ou d'Intent passé à `aiad-sdd footprint <ID>` pour cibler l'empreinte d'un artefact.

### Processing

1. Une fonction `formaterEmpreinte(empreinte, options)` met en forme la sortie de `collecterEmpreinteParArtefact` (SPEC-021-1) en bloc texte trié par tokens décroissants.
2. Une sous-commande `aiad-sdd footprint [<SPEC-ID>|<INTENT-ID>]` affiche l'empreinte agrégée (tous artefacts, ou l'artefact ciblé).
3. La directive `/sdd context` (`.claude/sdd/context.md`) ajoute une étape affichant l'empreinte mesurée de la SPEC auditée, à côté de l'estimation §6.

### Output

- Bloc texte : par artefact → `tokens` cumulés, `sessions`, part des `nonAttribues`.
- Exit 0 si données présentes ; exit 0 avec message explicite « aucune empreinte mesurée » si `hook-runs.jsonl` absent ou vide.

### Cas limites

- `hook-runs.jsonl` absent → message « aucune empreinte mesurée (active la mesure via /sdd exec) », exit 0.
- Artefact ciblé sans aucune entrée attribuée → ligne à `0 token` + note « non encore mesuré ».
- Part `nonAttribues` majoritaire (> 50 % des tokens) → la sortie affiche un avertissement de couverture d'attribution.

## 3. Critères d'Acceptation (EARS)

### CA-001 — Restitution agrégée par artefact

> Pattern : Event-driven

`WHEN aiad-sdd footprint is invoked without argument, the CLI SHALL display total tokens grouped by specId, sorted by descending tokens.`

- [x] Implémenté
- [x] Testé : `test/footprint-cli.test.js::aggregate`

### CA-002 — Ciblage d'un artefact

> Pattern : Event-driven

`WHEN aiad-sdd footprint <SPEC-ID> is invoked, the CLI SHALL display the cumulative tokens and session count attributed to that specId.`

- [x] Implémenté
- [x] Testé : `test/footprint-cli.test.js::targeted`

### CA-003 — Absence de données (message)

> Pattern : Unwanted behaviour

`IF hook-runs.jsonl is absent or empty, THEN aiad-sdd footprint SHALL print "aucune empreinte mesurée".`

- [x] Implémenté
- [x] Testé : `test/footprint-cli.test.js::empty-message`

### CA-004 — Absence de données (code de sortie)

> Pattern : Unwanted behaviour

`IF hook-runs.jsonl is absent or empty, THEN aiad-sdd footprint SHALL exit 0.`

- [x] Implémenté
- [x] Testé : `test/footprint-cli.test.js::empty-exit`

### CA-005 — Avertissement de couverture

> Pattern : State-driven

`WHILE the nonAttribues bucket holds more than 50 percent of total tokens, aiad-sdd footprint SHALL display a coverage warning line.`

- [x] Implémenté
- [x] Testé : `test/footprint-cli.test.js::coverage-warning`

### CA-006 — Intégration dans /sdd context

> Pattern : Ubiquitous

`The /sdd context directive SHALL include a step that displays the measured token footprint of the audited SPEC alongside the section 6 estimate.`

- [x] Implémenté
- [x] Testé : `test/footprint-context-directive.test.js::context-step`

### CA-007 — Tri principal déterministe

> Pattern : Ubiquitous

`The footprint formatter SHALL order artefacts by descending tokens.`

- [x] Implémenté
- [x] Testé : `test/footprint-cli.test.js::sort-tokens`

### CA-008 — Départage stable

> Pattern : Ubiquitous

`The footprint formatter SHALL break equal-token ties by ascending specId.`

- [x] Implémenté
- [x] Testé : `test/footprint-cli.test.js::stable-tiebreak`

### CA-009 — Restitution des tokens

> Pattern : Event-driven

`WHEN an artefact footprint is displayed, the footprint formatter SHALL report its token count.`

- [x] Implémenté
- [x] Testé : `test/footprint-cli.test.js::reports-tokens`

### CA-010 — Coût € exclu (condition C2)

> Pattern : Unwanted behaviour

`IF an artefact footprint is displayed, THEN aiad-sdd footprint SHALL report no monetary cost value.`

- [x] Implémenté
- [x] Testé : `test/footprint-cli.test.js::no-euro-cost`

## 4. Interface / API

```js
// lib/empreinte-artefact.js (étendu)
formaterEmpreinte(empreinte, { cible }) → string   // bloc texte trié

// bin/aiad-sdd.js (nouvelle sous-commande)
aiad-sdd footprint              // agrégat tous artefacts → exit 0
aiad-sdd footprint <SPEC-ID>    // empreinte ciblée → exit 0
aiad-sdd footprint <INTENT-ID>  // empreinte de l'Intent → exit 0
```

Exemple de sortie :
```
Empreinte mesurée (tokens, local opt-in)
  SPEC-021-1   12 400 tok   3 sessions
  SPEC-020-2    8 100 tok   2 sessions
  non attribués 4 200 tok   1 session
```

## 5. Dépendances

- **SPEC-021-1** (bloquante — fournit `collecterEmpreinteParArtefact` + données taguées)
- `.claude/sdd/context.md:30` (directive — étape de restitution ajoutée)
- `bin/aiad-sdd.js` (zone d'enregistrement des sous-commandes)

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~400 tokens
- Cette SPEC : ~800 tokens
- Fichiers source pertinents : `lib/empreinte-artefact.js` (issu de 021-1), `bin/aiad-sdd.js`, `.claude/sdd/context.md`
- **Total estimé** : ~5 000 tokens

## 7. Definition of Output Done (DoOD)

- [x] Code + lint passing
- [x] Tests unitaires sur cas limites (vide, couverture, ciblage absent)
- [x] **EARS lint : 0 violation** (skill `ears-validator`)
- [x] SPEC mise à jour si écart (Drift Lock)
- [x] Annotations machine-vérifiables posées (`@spec SPEC-021-2`, `@intent INTENT-021`, `@verified-by`)
- [x] Code review passée
- [x] Gouvernance vérifiée (RGPD : local-only ; RGESN : lecture seule, pas de surcoût)

## Historique des modifications

- **2026-06-25** — Implémentation complète (3 phases) : `formaterEmpreinte` (CA-007/008/009/010/005), CLI `footprint` (CA-001/002/003/004), directive `/sdd context` enrichie (CA-006). 16/16 tests passent. Suite complète : 4170/4171 sans régression.
