---
layout: default
title: Format Flow & Qualité — alimentation des KPI Flow
lang: fr-FR
---

# Format Flow & Qualité

> Cette page documente les fichiers qui alimentent les KPI **Flow** (WIP, SQS moyen, Gate au 1ᵉʳ passage, Drifts) affichés dans le dashboard AIAD (`metrics.html`, section "Flow & Qualité").

## TL;DR

Les indicateurs Flow sont nourris par 3 rituels AIAD différents — il suffit d'exécuter les commandes habituelles, **aucun format à apprendre** :

| Rituel | Commande | Indicateur alimenté |
|--------|----------|---------------------|
| Standup quotidien | `/aiad standup` | WIP moyen |
| Gate (post-SPEC) | `/sdd gate` | SQS moyen, % Gate au 1ᵉʳ passage |
| Drift-check (post-PR) | `/sdd drift-check` | Drifts détectés / résolus |

Chaque commande écrit un fichier Markdown dans la sous-catégorie correspondante de `.aiad/metrics/`.

## Emplacements

```
.aiad/metrics/
├── standup/
│   └── 2026-05-13-team-A.md      # 1 fichier par standup
├── specs/
│   └── 2026-05-12-SPEC-007.md    # 1 fichier par passage de Gate
└── drift/
    └── 2026-05-13-drift-check.md # 1 fichier par drift-check
```

## Format des fichiers

### Standup (`.aiad/metrics/standup/*.md`)

```markdown
# Standup 2026-05-13 — team-A

- wip: 4
- blockers: 1
- ready: 2
- in_progress: 3
- done_today: 1
```

| Clé | Type | Description |
|-----|------|-------------|
| `wip` | number | Work-In-Progress total (SPECs in-progress + validation). Alimente "WIP moyen". |
| `blockers` | number | Blockers humains du jour (optionnel). |
| `ready` / `in_progress` / `done_today` | number | Compteurs par statut (optionnels). |

### SPEC (`.aiad/metrics/specs/*.md`)

Écrit par `/sdd gate` à chaque passage :

```markdown
# Gate SPEC-007-3 — 2026-05-12

- sqs_score: 4.5
- attempts: 1
- gate_verdict: PASS
- spec_id: SPEC-007-3-domain-tls
```

| Clé | Type | Description |
|-----|------|-------------|
| `sqs_score` | number 0..5 | Score SQS. Alimente "SQS moyen". |
| `attempts` | number | Nombre de tentatives pour passer la Gate. `1` = passage au 1ᵉʳ coup. |
| `gate_verdict` | string | PASS / NEEDS_REMEDIATION / FAIL. |
| `spec_id` | string | Référence à la SPEC. |

### Drift (`.aiad/metrics/drift/*.md`)

Écrit par `/sdd drift-check` :

```markdown
# Drift-check 2026-05-13

- drifts_count: 2
- drifts_corriges: 1
- branch: main
```

| Clé | Type | Description |
|-----|------|-------------|
| `drifts_count` | number | Nombre total de drifts détectés. |
| `drifts_corriges` | number | Sous-ensemble corrigés dans la PR. |
| `branch` | string | Branche analysée (optionnel). |

## Indicateurs calculés

Le dashboard agrège (`lib/dashboard/collect.js#lireMetrics`) :

- **WIP moyen** = moyenne des `wip` sur tous les fichiers `standup/`.
- **SQS moyen** = moyenne des `sqs_score` sur tous les fichiers `specs/`.
- **Gate au 1ᵉʳ passage** = (nombre de fichiers `specs/` avec `attempts === 1`) / total × 100.
- **Drifts détectés / résolus** = somme des `drifts_count` / `drifts_corriges` sur tous les fichiers `drift/`.

Sparklines temporelles disponibles pour WIP, SQS et Drifts (chronologie par `mtime` de fichier).

## Si tu n'utilises pas les rituels AIAD

Le dashboard affichera une bannière "Données Flow & Qualité absentes" tant qu'aucun fichier n'existe dans ces 3 dossiers. Pour démarrer rapidement :

```bash
mkdir -p .aiad/metrics/standup
cat > .aiad/metrics/standup/$(date +%Y-%m-%d)-bootstrap.md <<EOF
- wip: 3
- blockers: 0
EOF
```

Une régénération de dashboard suffit pour faire disparaître la bannière.

## Cap stratégique

Comme pour [DORA](dora-format.html), les rituels AIAD :

- Restent **simples à exécuter manuellement** (Markdown + clé/valeur).
- **Aucun service externe** — souveraineté EU/FR par construction.
- Reproductibles en CI via `aiad-sdd ...` quand un rituel est automatisable.

Pour automatiser le standup quotidien depuis Slack/Jira, voir le backlog (item futur).
