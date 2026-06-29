---
id: SPEC-027-1
titre: Stamp `validated_at` dans le frontmatter SPEC lors du passage `done`
intent: INTENT-027
auteur: Steeve Evers
date: "2026-06-29"
statut: done
format: EARS
sqs: "5/5"
validated_at: "2026-06-29T06:57:39.461Z"
---
# SPEC-027-1 — Stamp `validated_at` dans le frontmatter SPEC lors du passage `done`

---

## 1. Contexte

INTENT-027 vise à automatiser la collecte de métriques DORA/Flow en CI. La stratégie C-strict choisie calcule `cycle_time_days = deploy_date − validated_at`, où `validated_at` est le timestamp ISO 8601 du moment où une SPEC a été marquée `done` par `/sdd validate`. Ce champ est aujourd'hui absent de tous les frontmatters SPEC — cette SPEC crée la commande CLI qui le stampe.

## 2. Comportement Attendu

### Input

- ID d'une SPEC existante (ex. `SPEC-027-1`) ou chemin absolu vers son fichier `.md`
- Commande CLI : `aiad-sdd spec stamp-validated <SPEC-ID>`

### Processing

1. Localise le fichier SPEC dans `.aiad/specs/` ou `.aiad/specs/archive/` (recherche par préfixe `<SPEC-ID>`)
2. Parse le frontmatter via `parseFrontmatter()` (`lib/frontmatter.js:119`)
3. Écrit le champ `validated_at` avec le timestamp courant au format ISO 8601 (ex. `"2026-06-29T14:30:00.000Z"`)
4. Si `validated_at` existe déjà, le met à jour (idempotent — le dernier appel gagne)
5. Recompose le fichier avec `stringifyFrontmatter()` (`lib/frontmatter.js:144`) + body inchangé
6. Écrit le fichier sur disque

### Output

- Fichier SPEC mis à jour avec `validated_at: "<ISO>"` dans le frontmatter
- Sortie console : `  ✓ SPEC-027-1 — validated_at: 2026-06-29T14:30:00.000Z`
- Exit 0 (succès) / Exit 1 (SPEC introuvable ou frontmatter illisible)

### Cas limites

- **SPEC introuvable** : exit 1, message `SPEC "<ID>" introuvable dans .aiad/specs/ ni dans .aiad/specs/archive/`
- **Frontmatter absent** : exit 1, message `Frontmatter absent ou illisible dans <chemin>`
- **`validated_at` déjà présent** : écrasé par le nouveau timestamp, pas d'erreur
- **Appel sans argument** : exit 1, affiche l'usage `aiad-sdd spec stamp-validated <SPEC-ID>`
- **Fichier en lecture seule** : exit 1, relaie l'erreur système

## 3. Critères d'Acceptation (EARS)

### CA-001 — Stamp réussi

> Pattern : Event-driven

`WHEN the command \`aiad-sdd spec stamp-validated <SPEC-ID>\` is invoked with a valid SPEC ID, the CLI SHALL write a \`validated_at\` field containing the current UTC ISO 8601 timestamp to the SPEC frontmatter.`

- [x] Implémenté
- [x] Testé : `test/spec-stamp.test.js::stamp réussi`

### CA-002 — Idempotence

> Pattern : Event-driven

`WHEN \`stamp-validated\` is invoked on a SPEC that already has a \`validated_at\` field, the CLI SHALL overwrite the existing timestamp with the new value.`

- [x] Implémenté
- [x] Testé : `test/spec-stamp.test.js::idempotence`

### CA-003 — SPEC introuvable

> Pattern : Unwanted behaviour

`IF no file matching the given SPEC ID exists in \`.aiad/specs/\` or \`.aiad/specs/archive/\`, THEN the CLI SHALL exit 1 with an error message containing the SPEC ID, without modifying any file.`

- [x] Implémenté
- [x] Testé : `test/spec-stamp.test.js::spec introuvable`

### CA-004 — Frontmatter absent

> Pattern : Unwanted behaviour

`IF the located SPEC file contains no YAML frontmatter block, THEN the CLI SHALL exit 1 with an error message indicating a missing frontmatter, without modifying the file.`

- [x] Implémenté
- [x] Testé : `test/spec-stamp.test.js::frontmatter absent`

### CA-005 — Format ISO 8601 UTC

> Pattern : Ubiquitous

`The CLI SHALL write \`validated_at\` as a quoted ISO 8601 string in UTC (format \`"YYYY-MM-DDTHH:mm:ss.sssZ"\`), parseable by \`new Date()\` in Node.js.`

- [x] Implémenté
- [x] Testé : `test/spec-stamp.test.js::format ISO`

### CA-006 — Body SPEC préservé

> Pattern : Ubiquitous

`The CLI SHALL preserve the entire Markdown body of the SPEC file (all content after the closing \`---\` of the frontmatter) without modification.`

- [x] Implémenté
- [x] Testé : `test/spec-stamp.test.js::body préservé`

## 4. Interface / API

```
CLI :
  aiad-sdd spec stamp-validated <SPEC-ID>

  Arguments :
    SPEC-ID   Identifiant de la SPEC (ex. "SPEC-027-1") — préfixe du nom de fichier

  Exit codes :
    0   Succès — validated_at écrit
    1   Erreur — SPEC introuvable, frontmatter illisible ou erreur disque

  Exemple :
    $ aiad-sdd spec stamp-validated SPEC-027-1
      ✓ SPEC-027-1 — validated_at: 2026-06-29T14:30:00.000Z

Frontmatter résultant (extrait) :
  ---
  id: SPEC-027-1
  status: done
  validated_at: "2026-06-29T14:30:00.000Z"
  ---
```

## 5. Dépendances

- `lib/frontmatter.js` — `parseFrontmatter()` (ligne 119) + `stringifyFrontmatter()` (ligne 144)
- `bin/aiad-sdd.js` — dispatch case `spec` → sous-commande `stamp-validated`
- Aucune dépendance npm runtime (contrainte structurante INTENT-027)

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~300 tokens
- Cette SPEC : ~500 tokens
- `lib/frontmatter.js` (163 lignes) : ~400 tokens
- `bin/aiad-sdd.js` dispatch (section `spec`) : ~200 tokens
- **Total estimé** : ~1 400 tokens

## 7. Definition of Output Done (DoOD)

- [x] Code + lint passing (`npm run lint`)
- [x] Tests unitaires : CA-001 à CA-006 couverts dans `test/spec-stamp.test.js`
- [x] **EARS lint : 0 violation** (skill `ears-validator`)
- [x] SPEC mise à jour si écart (Drift Lock)
- [x] Annotations posées : `@intent INTENT-027`, `@spec SPEC-027-1-stamp-validated-at`, `@verified-by test/spec-stamp.test.js`
- [x] Zéro dépendance runtime ajoutée (`npm run lint:deps` passing)
- [x] Gouvernance : RGESN (zéro appel réseau, traitement local uniquement)
