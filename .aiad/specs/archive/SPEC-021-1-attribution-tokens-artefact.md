---
status: archived
archivedAt: "2026-06-26T12:02:40.777Z"
archivedBy: evers.steeve@gmail.com
archivedReason: INTENT-021 complété — SPEC-021-1 (attribution tokens) + SPEC-021-2 (restitution /sdd context) livrées, 4170 tests, drift lock OK
---
# SPEC-021-1-attribution-tokens-artefact — variante EARS

**Intent parent** : INTENT-021
**Auteur** : Steeve Evers
**Date** : 2026-06-25
**Statut** : done
**Format** : EARS
**SQS** : 5/5
**Research** : RESEARCH-034 (CONDITIONAL GO, conditions C1/C2/C3)

---

## 1. Contexte

INTENT-021 veut mesurer l'empreinte (tokens) **par fonctionnalité**. L'infrastructure de capture existe déjà (INTENT-030 : `lib/eco-hook.js:27` écrit `{ ts, event, sessionId, model, ecoMetrics }` dans `.aiad/metrics/hook-runs.jsonl`), mais agrège **par session harness**, sans lien Intent/SPEC. Cette SPEC ajoute l'**attribution** : taguer chaque entrée de tokens avec l'artefact actif, de façon **rétro-compatible** et **best-effort** (conditions C2/C3 de RESEARCH-034). Aucune mesure brute ni grille de coût € n'est introduite (C2 : tokens seuls).

## 2. Comportement Attendu

### Input

- Variables d'environnement optionnelles `AIAD_CURRENT_SPEC` (ex. `SPEC-021-1`) et `AIAD_CURRENT_INTENT` (ex. `INTENT-021`).
- Fichier d'état optionnel `.aiad/metrics/active-artifact.json` : `{ "specId": string|null, "intentId": string|null, "since": ISO8601 }`.
- Le payload Stop existant du harness (inchangé) : `{ usage: { input_tokens, output_tokens }, session_id }`.

### Processing

1. Une commande `aiad-sdd track set <SPEC-ID> [--intent <INTENT-ID>]` écrit le fichier d'état ; `aiad-sdd track clear` le supprime.
2. La directive `/sdd exec` (`.claude/sdd/exec.md`) invoque `track set` au lancement avec la SPEC active, et `track clear` en fin de session.
3. `buildEntry` (`lib/eco-hook.js:27`) résout l'artefact actif : `AIAD_CURRENT_SPEC`/`AIAD_CURRENT_INTENT` en priorité, sinon le fichier d'état, sinon aucun.
4. L'entrée écrite dans `hook-runs.jsonl` reçoit deux champs `specId` et `intentId` **uniquement s'ils sont résolus** (sinon champs absents).
5. Un agrégateur `collecterEmpreinteParArtefact(racine)` lit `hook-runs.jsonl` et regroupe les tokens par `specId` puis par `intentId`.

### Output

- `hook-runs.jsonl` enrichi (champs `specId`/`intentId` optionnels) — schéma rétro-compatible.
- `collecterEmpreinteParArtefact` renvoie `{ parSpec: { [specId]: { tokens, sessions } }, parIntent: { [intentId]: { tokens, sessions } }, nonAttribues: { tokens, sessions } }`.

### Cas limites

- Aucun artefact actif (ni env, ni fichier d'état) → entrée écrite sans `specId`/`intentId`, comptée dans `nonAttribues`.
- Entrées héritées d'INTENT-030 (sans `specId`) → restent valides, comptées dans `nonAttribues`.
- Fichier d'état corrompu / JSON invalide → ignoré silencieusement, attribution traitée comme absente (fail-open, cohérent avec `eco-hook.js:79`).
- Session touchant plusieurs SPECs → l'artefact actif au moment du Stop est retenu (best-effort assumé, C3).

## 3. Critères d'Acceptation (EARS)

### CA-001 — Tag de l'artefact actif depuis l'environnement

> Pattern : Event-driven

`WHEN the Stop hook builds an entry AND AIAD_CURRENT_SPEC is set, the eco-hook SHALL persist that value as the specId field of the hook-runs.jsonl entry.`

- [x] Implémenté
- [x] Testé : `test/eco-hook-attribution.test.js::env-spec`

### CA-002 — Fallback sur le fichier d'état

> Pattern : Event-driven

`WHEN the Stop hook builds an entry AND no AIAD_CURRENT_SPEC environment variable is set AND .aiad/metrics/active-artifact.json contains a specId, the eco-hook SHALL persist that specId in the entry.`

- [x] Implémenté
- [x] Testé : `test/eco-hook-attribution.test.js::file-fallback`

### CA-003 — Rétro-compatibilité (attribution absente)

> Pattern : Unwanted behaviour

`IF no active artifact is resolved from either source, THEN the eco-hook SHALL write the entry without specId and without intentId fields.`

- [x] Implémenté
- [x] Testé : `test/eco-hook-attribution.test.js::no-attribution`

### CA-004 — Lecture tolérante des entrées héritées (comptage)

> Pattern : Unwanted behaviour

`IF a hook-runs.jsonl entry has no specId field, THEN collecterEmpreinteParArtefact SHALL count its tokens under the nonAttribues bucket.`

- [x] Implémenté
- [x] Testé : `test/empreinte-artefact.test.js::legacy-entries`

### CA-005 — Lecture tolérante des entrées héritées (pas d'exception)

> Pattern : Unwanted behaviour

`IF a hook-runs.jsonl entry has no specId field, THEN collecterEmpreinteParArtefact SHALL return without throwing.`

- [x] Implémenté
- [x] Testé : `test/empreinte-artefact.test.js::legacy-no-throw`

### CA-006 — Agrégation par SPEC

> Pattern : Ubiquitous

`The empreinte aggregator SHALL return the summed totalTokens grouped by specId across all attributed entries of hook-runs.jsonl.`

- [x] Implémenté
- [x] Testé : `test/empreinte-artefact.test.js::group-by-spec`

### CA-007 — Écriture du fichier d'état par la commande track

> Pattern : Event-driven

`WHEN aiad-sdd track set <SPEC-ID> is invoked, the CLI SHALL write .aiad/metrics/active-artifact.json containing the specId and an ISO 8601 since timestamp.`

- [x] Implémenté
- [x] Testé : `test/track-cli.test.js::set-writes-state`

### CA-008 — Nettoyage du fichier d'état (suppression)

> Pattern : Event-driven

`WHEN aiad-sdd track clear is invoked AND .aiad/metrics/active-artifact.json exists, the CLI SHALL remove that file.`

- [x] Implémenté
- [x] Testé : `test/track-cli.test.js::clear-removes`

### CA-009 — Nettoyage du fichier d'état (idempotence)

> Pattern : Unwanted behaviour

`IF aiad-sdd track clear is invoked while .aiad/metrics/active-artifact.json is already absent, THEN the CLI SHALL exit 0.`

- [x] Implémenté
- [x] Testé : `test/track-cli.test.js::clear-idempotent`

### CA-010 — Persistance locale uniquement (RGPD)

> Pattern : Ubiquitous

`The attribution mechanism SHALL persist data only to the local .aiad/metrics directory.`

- [x] Implémenté
- [x] Testé : `test/empreinte-artefact.test.js::local-only`

### CA-011 — Pas d'envoi réseau (opt-in préservé)

> Pattern : Unwanted behaviour

`IF the attribution mechanism persists an entry, THEN the attribution mechanism SHALL emit no network request.`

- [x] Implémenté
- [x] Testé : `test/empreinte-artefact.test.js::no-network`

## 4. Interface / API

```js
// lib/eco-hook.js (enrichi)
buildEntry({ payload, env }) → {
  ts, event, sessionId, model, ecoMetrics,
  specId?,   // présent uniquement si résolu
  intentId?, // présent uniquement si résolu
}

// lib/empreinte-artefact.js (nouveau)
collecterEmpreinteParArtefact(racine) → {
  parSpec:     { [specId: string]:   { tokens: number, sessions: number } },
  parIntent:   { [intentId: string]: { tokens: number, sessions: number } },
  nonAttribues:{ tokens: number, sessions: number },
}

// bin/aiad-sdd.js (nouveau sous-commande)
aiad-sdd track set <SPEC-ID> [--intent <INTENT-ID>]   // exit 0
aiad-sdd track clear                                   // exit 0 (idempotent)
```

État persisté : `.aiad/metrics/active-artifact.json`
```json
{ "specId": "SPEC-021-1", "intentId": "INTENT-021", "since": "2026-06-25T14:30:00.000Z" }
```

## 5. Dépendances

- `lib/eco-hook.js:27` (buildEntry — point d'enrichissement)
- `lib/eco-dashboard.js:39` (`collecterEcoMetrics` — pattern de lecture JSONL réutilisé)
- `.claude/sdd/exec.md:79` (directive — invocation `track set`/`track clear`)
- INTENT-030 / SPEC-030-2 (schéma `hook-runs.jsonl` — étendu sans rupture)

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~400 tokens
- Cette SPEC : ~900 tokens
- Fichiers source pertinents : `lib/eco-hook.js`, `lib/eco-dashboard.js`, `bin/aiad-sdd.js` (zone CLI), `test/eco-hook.test.js`
- **Total estimé** : ~6 500 tokens

## 7. Definition of Output Done (DoOD)

- [x] Code + lint passing
- [x] Tests unitaires sur cas limites (legacy, corrompu, multi-SPEC)
- [x] **EARS lint : 0 violation** (skill `ears-validator`)
- [x] SPEC mise à jour si écart (Drift Lock)
- [x] Annotations machine-vérifiables posées (`@spec SPEC-021-1`, `@intent INTENT-021`, `@verified-by`, `@governance AIAD-RGPD`)
- [x] Code review passée
- [x] Gouvernance vérifiée (RGPD : local-only/opt-in ; RGESN : pas de surcoût de calcul notable)

## Historique des modifications

- **2026-06-25** — Implémentation complète (3 phases) : enrichissement `buildEntry` (CA-001/002/003), `lib/empreinte-artefact.js` (CA-004/005/006/010/011), CLI `track set/clear` (CA-007/008/009). 17/17 tests passent. Suite complète : 4154/4154 sans régression.
