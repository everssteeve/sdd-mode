# SPEC-015-1-telemetrie-usage — Agrégat d'usage per-command (local, opt-in)

**Intent parent** : INTENT-015
**Research** : RESEARCH-016 (CONDITIONAL GO 85 % — conditions C1, C2, C3)
**Auteur** : Steeve Evers
**Date** : 2026-06-16
**Statut** : done
**Format** : EARS
**SQS** : 5/5 — Gate OUVERTE (2026-06-16, EARS strict 0 violation, Étranger PASS)
**Implémentation** : `lib/telemetry.js` (readEvents/aggregateUsage/showUsage) + `bin/aiad-sdd.js` (dispatch `telemetry usage`) · tests `test/telemetry-usage.test.js` (8/8) · trace : 0 gap bloquant

---

## 1. Contexte

INTENT-015 veut décider du noyau/longue-traîne du CLI **sur données d'usage**, pas à l'intuition. La télémétrie opt-in RGPD existe déjà (`lib/telemetry.js`) et logge chaque exécution dans `~/.aiad-sdd/events.jsonl` (`event: command_run`, champ `command`). Ce qui manque : **lire et agréger** ce log local en un classement per-command. Cette SPEC ajoute la lecture/agrégation — **aucune nouvelle collecte**, donc condition C1 servie (la donnée informe le noyau provisoire).

## 2. Comportement Attendu

### Input

- Source unique : `~/.aiad-sdd/events.jsonl` (constante `LOCAL_LOG` de `lib/telemetry.js:34`), une ligne JSON par événement.
- Filtre : seuls les enregistrements `event === "command_run"` portant un champ `command` non vide sont agrégés.
- Invocation : `aiad-sdd telemetry usage [--json]` (nouvelle sous-commande à côté de `opt-in`/`opt-out`/`status`, dispatch `bin/aiad-sdd.js:959`).
- Aucune entrée réseau, aucun argument de chemin : la source est figée et locale.

### Processing

1. Vérifier l'état d'opt-in via `readState()` (`lib/telemetry.js:42`).
2. Si opté-in et fichier présent : lire `events.jsonl` ligne par ligne, ignorer silencieusement toute ligne JSON invalide (fail-safe, cohérent avec `track`).
3. Compter les occurrences par `command`, calculer pour chacune : nombre absolu, part en pourcentage du total, rang.
4. Classer par nombre décroissant.
5. Marquer chaque commande `core` ou `longue-traîne` selon un seuil de part cumulée paramétrable (défaut : commandes sous le **dernier quintile cumulé**, soit la queue représentant ≤ 20 % cumulés, classées `longue-traîne`).
6. Rendu : tableau texte lisible, ou objet JSON si `--json`.

### Output

- Texte (défaut) : tableau `rang | commande | count | part % | classe` trié décroissant + ligne de total (nombre d'événements, fenêtre temporelle première→dernière date observée).
- JSON (`--json`) : `{ total, since, until, commands: [{ rank, command, count, share, class }] }` sur stdout, rien d'autre sur stdout.
- Code de sortie : `0` en cas de rendu réussi (y compris jeu de données vide), `1` sur erreur d'I/O irrécupérable distincte de l'absence de fichier.

### Cas limites

1. **Opt-out / jamais opté-in** : pas de log à lire → message indiquant que la télémétrie est désactivée + comment l'activer ; aucun tableau ; exit 0.
2. **Fichier absent alors qu'opté-in** : aucun événement encore collecté → rendu « 0 événement » explicite ; exit 0.
3. **Lignes corrompues** dans `events.jsonl` (JSON partiel, troncature) : ignorées une par une sans interrompre l'agrégat ; exit 0.
4. **Champ `command` manquant** sur un `command_run` : enregistrement exclu du décompte (pas de catégorie « unknown » fabriquée).
5. **Égalité de count** entre commandes : ordre stable et déterministe (tri secondaire alphabétique sur `command`).

## 3. Critères d'Acceptation (EARS)

### CA-001 — Agrégat per-command sur le log local

> Pattern : Event-driven

`WHEN the operator runs "aiad-sdd telemetry usage" while telemetry is opted-in and the events log contains at least one command_run record, the Telemetry Usage command SHALL display one row per distinct command with its absolute count, its percentage share of the total, and its rank, sorted by descending count.`

- [ ] Implémenté
- [ ] Testé : `test/telemetry-usage.test.js::aggregates per command`

### CA-002 — Aucune collecte ni accès réseau

> Pattern : Ubiquitous

`The Telemetry Usage command SHALL read the local file ~/.aiad-sdd/events.jsonl as its only data source, opening no network connection and writing no telemetry record.`

- [ ] Implémenté
- [ ] Testé : `test/telemetry-usage.test.js::no network no write`

### CA-003 — Sortie JSON sur demande

> Pattern : Event-driven

`WHEN the operator passes the --json flag, the Telemetry Usage command SHALL emit on stdout exactly one JSON object { total, since, until, commands: [{ rank, command, count, share, class }] } and no other text.`

- [ ] Implémenté
- [ ] Testé : `test/telemetry-usage.test.js::json shape`

### CA-004 — Classification core / longue-traîne

> Pattern : Event-driven

`WHEN the aggregate is computed, the Telemetry Usage command SHALL tag each command "longue-traîne" WHEN it belongs to the descending-sorted tail whose cumulative share is less than or equal to 20 percent, and "core" otherwise.`

- [ ] Implémenté
- [ ] Testé : `test/telemetry-usage.test.js::long-tail classification`

### CA-005 — Absence de données signalée

> Pattern : Unwanted behaviour

`IF telemetry is opted-out or the events log is absent or empty, THEN the Telemetry Usage command SHALL display a message stating that no usage data is available.`

- [ ] Implémenté
- [ ] Testé : `test/telemetry-usage.test.js::empty dataset message`

### CA-006 — Lignes corrompues ignorées sans interruption

> Pattern : Unwanted behaviour

`IF a line in ~/.aiad-sdd/events.jsonl is not valid JSON or lacks a non-empty command field, THEN the Telemetry Usage command SHALL exclude that line from the aggregate without interrupting the processing of the remaining lines.`

- [ ] Implémenté
- [ ] Testé : `test/telemetry-usage.test.js::skips corrupt lines`

### CA-007 — Ordre déterministe sur égalité

> Pattern : Event-driven

`WHEN two commands have the same count, the Telemetry Usage command SHALL order them alphabetically by command name.`

- [ ] Implémenté
- [ ] Testé : `test/telemetry-usage.test.js::deterministic tie-break`

### CA-008 — Sortie en succès

> Pattern : Event-driven

`WHEN the Telemetry Usage command finishes rendering either a usage report or an empty-dataset message, the Telemetry Usage command SHALL exit with status code 0.`

- [ ] Implémenté
- [ ] Testé : `test/telemetry-usage.test.js::exits 0 on success`

## 4. Interface / API

```
CLI :  aiad-sdd telemetry usage [--json]

lib/telemetry.js (ajouts, ESM) :
  export function readEvents(): Array<{ command: string, timestamp: string }>
    // lit LOCAL_LOG, filtre event==='command_run' & command non vide,
    // ignore lignes invalides. [] si opt-out / fichier absent.

  export function aggregateUsage(events): {
    total: number,
    since: string|null,
    until: string|null,
    commands: Array<{ rank: number, command: string, count: number,
                      share: number, class: 'core'|'longue-traîne' }>
  }

  export async function showUsage(options?: { json?: boolean }): Promise<...>
    // orchestration + rendu texte/JSON, exit codes 0/1.

bin/aiad-sdd.js : ajout branche `else if (sub === 'usage')` dans case 'telemetry' (~ligne 962),
                  + mention dans le bloc AIDE (ligne 389) et COMMANDES_VALIDES inchangé (sous-commande).
```

## 5. Dépendances

- `lib/telemetry.js` (état opt-in, constantes `LOCAL_LOG`/`STATE_FILE`, `readState`) — réutilisé, pas dupliqué.
- `lib/term.js` (`C`, `log`, `logHeader`) pour le rendu cohérent.
- Aucune dépendance externe (contrainte zéro-dep du projet).
- Pas de dépendance vers SPEC-015-2/3 : cette SPEC est en Wave 1, elle débloque la décision de tiering.

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~400 tokens
- Cette SPEC : ~900 tokens
- Fichiers source pertinents : `lib/telemetry.js` (~165 l.), `bin/aiad-sdd.js:959-967` (dispatch), `lib/term.js` (helpers), 1 nouveau `test/telemetry-usage.test.js`
- **Total estimé** : ~6k tokens (bien sous le seuil 60-70 %)

## 7. Definition of Output Done (DoOD)

- [x] Code + lint passing (lints node/deps/size/esm/claims verts)
- [x] Tests unitaires sur les cas limites (`test/telemetry-usage.test.js` — 8/8, dont CA-008)
- [x] **EARS lint : 0 violation** (skill `ears-validator`, 8 critères)
- [x] SPEC mise à jour si écart (Drift Lock — trace 0 gap bloquant)
- [x] Annotations machine-vérifiables posées (`@intent INTENT-015`, `@spec SPEC-015-1-telemetrie-usage`, `@verified-by`, `@governance AIAD-RGPD`)
- [x] Code review passée (PR #8)
- [x] Gouvernance vérifiée : **RGPD** (lecture locale de données déjà consenties, aucune nouvelle collecte, aucun envoi réseau, pas de PII) ; **RGESN** (sobriété : zéro dépendance, lecture séquentielle). AI-ACT / RGAA non déclenchés (pas d'IA, pas d'UI).
