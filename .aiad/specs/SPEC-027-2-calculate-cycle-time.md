---
id: SPEC-027-2
titre: Fonction `calculateCycleTimeDaysFromSpec()` + flag CLI `--auto`
intent: INTENT-027
auteur: Steeve Evers
date: "2026-06-29"
statut: done
format: EARS
sqs: "5/5"
validated_at: "2026-06-29T07:07:00.267Z"
---
# SPEC-027-2 — Fonction `calculateCycleTimeDaysFromSpec()` + flag CLI `--auto`

---

## 1. Contexte

INTENT-027 requiert que `cycle_time_days` soit calculé automatiquement en CI sans intervention manuelle. SPEC-027-1 stampe `validated_at` dans les SPECs. Cette SPEC implémente la fonction qui lit `validated_at` à travers tous les fichiers SPEC (actifs + archivés) et calcule `cycle_time_days = deploy_date − max(validated_at)`, puis l'expose via le flag `--auto` de `aiad-sdd dora --record`.

## 2. Comportement Attendu

### Input

- Flag CLI : `aiad-sdd dora --record --auto [--status=<s>] [--release=<v>] [--commit=<sha>] [--date=<YYYY-MM-DD>]`
- Fichiers SPEC dans `.aiad/specs/` et `.aiad/specs/archive/` avec champ `validated_at` (posé par SPEC-027-1)

### Processing

**Fonction `calculateCycleTimeDaysFromSpec(racineProjet, deployDate)`** (dans `lib/dora-record.js`) :

1. Scanne récursivement `.aiad/specs/` et `.aiad/specs/archive/` — tous les fichiers `.md`
2. Parse le frontmatter de chaque fichier (`parseFrontmatter`)
3. Collecte tous les champs `validated_at` présents et valides (parseable par `new Date()`)
4. Retourne `null` si aucun `validated_at` trouvé
5. Sinon : `max(validated_at)` → `mostRecentValidated`
6. `cycle_time_days = round((deployDate − mostRecentValidated) / 86_400_000, 1 decimal)`
7. Si résultat < 0 (deploy antérieur à la validation) → retourne `0`

**Intégration CLI** (`aiad-sdd dora --record --auto`) :

- Calcule `deployDate = new Date()` (ou `--date` si fourni, parsé en UTC minuit)
- Appelle `calculateCycleTimeDaysFromSpec(cwd(), deployDate)`
- Passe le résultat comme `cycleTimeDays` à `recordDeployment()`
- Si résultat est `null` : exit 1 avec message `Aucun validated_at trouvé dans les SPECs — SPEC-027-1 requis`

### Output

- Fichier déploiement créé dans `.aiad/metrics/deployments/` avec `- cycle_time_days: N.N`
- Sortie console : `  ✓ Déploiement enregistré — cycle_time_days: N.N (depuis validated_at: <ISO>)`
- Exit 0 (succès) / Exit 1 (aucun `validated_at` disponible ou erreur disque)

### Cas limites

- **Aucun `validated_at` dans aucune SPEC** : exit 1, message explicite (SPEC-027-1 non exécutée)
- **Un seul fichier SPEC avec `validated_at`** : calcul normal avec ce seul fichier
- **`validated_at` postérieur à `deployDate`** : `cycle_time_days = 0` (pas de valeur négative)
- **`--auto` et `--cycle` simultanés** : `--cycle` l'emporte (valeur manuelle prioritaire), warning affiché
- **Fichiers SPEC illisibles (permissions)** : skippés silencieusement, log en stderr
- **`.aiad/specs/` absent** : exit 1, message `Répertoire .aiad/specs/ introuvable`

## 3. Critères d'Acceptation (EARS)

### CA-001 — Calcul nominal

> Pattern : Event-driven

`WHEN \`aiad-sdd dora --record --auto\` is invoked and at least one SPEC file contains a valid \`validated_at\` field, the CLI SHALL write \`round((deployDate − max(validated_at)) / 86400000, 1)\` as \`cycle_time_days\` in the deployment file.`

- [x] Implémenté
- [x] Testé : `test/dora-auto.test.js::calcul nominal`

### CA-002 — Résultat négatif remplacé par zéro

> Pattern : Unwanted behaviour

`IF the computed \`cycle_time_days\` is negative (deploy date earlier than \`validated_at\`), THEN the CLI SHALL write \`cycle_time_days: 0\` to the deployment file.`

- [x] Implémenté
- [x] Testé : `test/dora-auto.test.js::résultat négatif`

### CA-003 — Aucun validated_at disponible

> Pattern : Unwanted behaviour

`IF no SPEC file contains a parseable \`validated_at\` field, THEN the CLI SHALL exit 1 with an error message referencing SPEC-027-1, without creating a deployment file.`

- [x] Implémenté
- [x] Testé : `test/dora-auto.test.js::aucun validated_at`

### CA-004a — Priorité --cycle sur --auto : valeur utilisée

> Pattern : Event-driven

`WHEN both \`--auto\` and \`--cycle=N\` are provided, the CLI SHALL use the value of \`--cycle\` as \`cycle_time_days\`.`

- [x] Implémenté
- [x] Testé : `test/dora-auto.test.js::priorité --cycle`

### CA-004b — Priorité --cycle sur --auto : warning affiché

> Pattern : Event-driven

`WHEN both \`--auto\` and \`--cycle=N\` are provided, the CLI SHALL print a warning indicating that \`--cycle\` overrides \`--auto\`.`

- [x] Implémenté
- [x] Testé : `test/dora-auto.test.js::priorité --cycle warning`

### CA-005 — Arrondi à une décimale

> Pattern : Ubiquitous

`The CLI SHALL round \`cycle_time_days\` to exactly one decimal place (e.g. 4.5, not 4.512345).`

- [x] Implémenté
- [x] Testé : `test/dora-auto.test.js::arrondi décimale`

### CA-006 — Date déploiement paramétrable

> Pattern : Event-driven

`WHEN \`--date=YYYY-MM-DD\` is provided alongside \`--auto\`, the CLI SHALL use that date (parsed as UTC midnight) as \`deployDate\` instead of the current timestamp.`

- [x] Implémenté
- [x] Testé : `test/dora-auto.test.js::date paramétrable`

## 4. Interface / API

```
CLI :
  aiad-sdd dora --record --auto [options]

  Options :
    --auto              Calcule cycle_time_days depuis max(validated_at) des SPECs
    --status=<s>        Statut du déploiement (success|failure|hotfix) [défaut: success]
    --release=<v>       Nom/version du déploiement (ex. "v1.19.0", "site-deploy")
    --commit=<sha>      SHA du commit deployé
    --date=YYYY-MM-DD   Date de déploiement (UTC) [défaut: aujourd'hui]
    --cycle=N           Valeur manuelle (écrase --auto si les deux sont présents)

  Exit codes :
    0   Succès
    1   Aucun validated_at disponible ou erreur disque

  Exemple :
    $ aiad-sdd dora --record --auto --status=success --release=v1.19.0 --commit=abc123
      ✓ Déploiement enregistré — cycle_time_days: 3.5 (depuis validated_at: 2026-06-26T10:00:00.000Z)

Fonction exportée :
  /**
   * @spec SPEC-027-2-calculate-cycle-time
   * @intent INTENT-027
   */
  export function calculateCycleTimeDaysFromSpec(racineProjet, deployDate)
  // Returns: number | null
  // null si aucun validated_at trouvé
```

## 5. Dépendances

- **SPEC-027-1** — `validated_at` doit être présent dans les SPECs (prérequis fonctionnel)
- `lib/dora-record.js` — `recordDeployment()` (ligne 27), `listerTagsGit()` (pattern réutilisable)
- `lib/frontmatter.js` — `parseFrontmatter()` (ligne 119)
- `bin/aiad-sdd.js` — dispatch case `dora`, parsing `--auto` flag (ligne 3597)
- `node:fs` + `node:path` uniquement — zéro dépendance npm runtime

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~300 tokens
- SPEC-027-1 (interface stamp) : ~200 tokens
- Cette SPEC : ~600 tokens
- `lib/dora-record.js` (≈ 200 lignes) : ~500 tokens
- `lib/frontmatter.js` (163 lignes) : ~400 tokens
- **Total estimé** : ~2 000 tokens

## 7. Definition of Output Done (DoOD)

- [x] Code + lint passing (`npm run lint`)
- [x] Tests unitaires : CA-001 à CA-006 couverts dans `test/dora-auto.test.js`
- [x] **EARS lint : 0 violation** (skill `ears-validator`)
- [x] SPEC mise à jour si écart (Drift Lock)
- [x] Annotations posées : `@intent INTENT-027`, `@spec SPEC-027-2-calculate-cycle-time`, `@verified-by test/dora-auto.test.js`
- [x] Zéro dépendance runtime ajoutée (`npm run lint:deps` passing)
- [-] `aiad-sdd dora --help` reflète le nouveau flag `--auto` (help dynamique non implémenté — hors-scope SPEC)
- [x] Gouvernance : RGESN (lecture locale uniquement, zéro appel réseau)
