---
layout: default
title: Intégration CI — GitLab, Bitbucket, Drone, GitHub
lang: fr-FR
---

# Intégration CI

> AIAD SDD couvre **4 forges** avec des templates prêts à l'emploi : GitHub, GitLab, Bitbucket, Drone. Cible : équipes EU, dont les organisations publiques où GitLab est dominant.

## Vue d'ensemble

| Forge | Template | Format |
|-------|----------|--------|
| **GitHub** | [`aiad-sdd-action`](https://github.com/everssteeve/sdd-mode/tree/main/.github/actions/aiad-sdd) | Composite Action native |
| **GitLab** | [`templates/forges/.gitlab-ci.aiad.yml`](https://github.com/everssteeve/sdd-mode/tree/main/templates/forges/.gitlab-ci.aiad.yml) | `include:` dans `.gitlab-ci.yml` |
| **Bitbucket** | [`templates/forges/bitbucket-pipelines.aiad.yml`](https://github.com/everssteeve/sdd-mode/tree/main/templates/forges/bitbucket-pipelines.aiad.yml) | À copier / merger dans `bitbucket-pipelines.yml` |
| **Drone** | [`templates/forges/.drone.aiad.yml`](https://github.com/everssteeve/sdd-mode/tree/main/templates/forges/.drone.aiad.yml) | `.drone.yml` complet (à mergeable manuellement) |

Tous les templates exécutent les mêmes 5 vérifications, dans le même ordre :

1. `aiad-sdd update --check` — commandes / gouvernance synchronisées
2. `aiad-sdd emit-rules --check` — parité multi-runtime (AGENTS.md / Cursor / Codex / Gemini)
3. `aiad-sdd docs --check` — DOCUMENTATION.md à jour
4. `aiad-sdd trace --fail-on-gap` — matrice Intent → SPEC → Code → Tests sans gap bloquant
5. `aiad-sdd dashboard --quiet` (sur main uniquement) — dashboard généré pour artefacts

## GitHub

```yaml
# .github/workflows/aiad.yml
name: aiad
on: [pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: everssteeve/sdd-mode/.github/actions/aiad-sdd@v1.14.0
```

## GitLab

```yaml
# .gitlab-ci.yml — à la racine du projet
include:
  - remote: 'https://raw.githubusercontent.com/everssteeve/sdd-mode/v1.14.0/templates/forges/.gitlab-ci.aiad.yml'

# OU local après copie :
# include:
#   - local: '.gitlab-ci.aiad.yml'
```

Le template intègre le SARIF dans le **Security Dashboard GitLab** automatiquement.

## Bitbucket Pipelines

Bitbucket ne supporte pas `include:` cross-repo. Copie le template dans ton `bitbucket-pipelines.yml`. Les jobs `aiad:*` sont parallélisés en MR.

## Drone CI

Soit `.drone.yml` complet (template prêt à l'emploi), soit merger les 5 `steps` dans ton pipeline existant.

## Pourquoi 4 forges

- **Marché EU public** : GitLab dominant (Conseil de l'UE, plusieurs ministères FR, État français [code.gouv.fr](https://code.gouv.fr/), instances *autonomes* de souveraineté numérique).
- **Atlassian** : Bitbucket toujours utilisé chez les ESN historiques EU.
- **Self-hosted léger** : Drone est populaire dans les coopératives tech et associations.
- **GitHub** : référence par défaut.

## Maintenance

Les 4 templates utilisent strictement la même séquence de commandes — toute évolution du CLI (nouveau `--check`, nouveau format) est répercutable mécaniquement. Pas de logique CI dans le framework côté serveur, tout est dans le client `npx aiad-sdd`.
