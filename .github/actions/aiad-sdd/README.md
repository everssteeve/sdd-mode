# `aiad-sdd-action`

> Action GitHub officielle pour vérifier la cohérence Spec Driven Development d'un projet AIAD : parité commandes / gouvernance, multi-runtime, doc auto-synchrone, traçabilité machine-vérifiable.

## Usage minimal

```yaml
- uses: everssteeve/sdd-mode/.github/actions/aiad-sdd@v1.14.0
```

Cette ligne enchaîne en une seule étape :
- `aiad-sdd update --check` (commandes / gouvernance synchronisées avec le package)
- `aiad-sdd emit-rules --check` (AGENTS.md / Cursor / Codex / Gemini synchronisés avec `.aiad/AGENT-GUIDE.md`)
- `aiad-sdd docs --check` (DOCUMENTATION.md à jour avec les sources de vérité)
- `aiad-sdd trace --fail-on-gap` (matrice Intent → SPEC → Code → Tests sans gap bloquant)

## Inputs

| Input | Défaut | Description |
|-------|--------|-------------|
| `command` | `checks` | Mode : `checks`, `trace`, `docs`, `doctor`, `doctor-json`, `all` |
| `version` | `latest` | Version de `aiad-sdd` à utiliser (npm tag) |
| `working-directory` | `.` | Dossier où exécuter |
| `fail-on-warn` | `false` | Treat warnings as errors |
| `upload-sarif` | `false` | Upload `trace.sarif` vers GitHub Code Scanning |

## Exemples

### CI parité (défaut)

```yaml
name: aiad-sdd
on: [pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: everssteeve/sdd-mode/.github/actions/aiad-sdd@v1.14.0
```

### Avec upload SARIF dans GitHub Code Scanning

```yaml
name: aiad-sdd-trace
on: [pull_request]
jobs:
  trace:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: everssteeve/sdd-mode/.github/actions/aiad-sdd@v1.14.0
        with:
          command: trace
          upload-sarif: 'true'
```

### Diagnostic JSON pour reporting interne

```yaml
- uses: everssteeve/sdd-mode/.github/actions/aiad-sdd@v1.14.0
  with:
    command: doctor-json
- uses: actions/upload-artifact@v4
  with:
    name: aiad-doctor
    path: aiad-doctor.json
```

### Version épinglée

```yaml
- uses: everssteeve/sdd-mode/.github/actions/aiad-sdd@v1.14.0
  with:
    version: '1.14.0'  # plutôt que 'latest'
```

## Outputs

- `sarif-path` — chemin du `trace.sarif` généré quand applicable.

## Configuration côté repo

L'action requiert que le projet ait été initialisé via `aiad-sdd init`. Vérifie avec :

```bash
npx aiad-sdd doctor
```

Pour configurer GitHub Code Scanning à recevoir le SARIF, le job doit avoir :

```yaml
permissions:
  security-events: write
```

## Maintenance

Cette action vit dans le repo `aiad-sdd` lui-même : `.github/actions/aiad-sdd/`. Pour proposer une amélioration : [issue GitHub](https://github.com/everssteeve/sdd-mode/issues).
