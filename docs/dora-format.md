---
layout: default
title: Format DORA — alimentation des KPI déploiement
lang: fr-FR
---

# Format DORA

> Cette page documente le format des fichiers qui alimentent les KPI DORA (Deployment Frequency, Lead Time, Change Failure Rate, MTTR) affichés dans le dashboard AIAD (`metrics.html`).

## TL;DR

Pour activer les KPI DORA dans ton dashboard, append un fichier par déploiement dans `.aiad/metrics/deployments/`.

**Option 1 — Commande dédiée (recommandée) :**

```bash
aiad-sdd dora --record --status=success --cycle=4.5 --lead=8 --release=v1.2.0 --commit=$(git rev-parse --short HEAD)
```

**Option 2 — Import depuis tags Git :**

```bash
aiad-sdd dora --import-git --since=2026-01-01
```

**Option 3 — Écriture manuelle** (à éviter sauf debug) : voir le format ci-dessous.

## Emplacement et nommage

Chaque déploiement est un fichier Markdown séparé dans `.aiad/metrics/deployments/` :

```
.aiad/metrics/deployments/
├── 2026-05-12-deploy-01.md
├── 2026-05-12-deploy-02.md   # 2ᵉ déploiement du jour
├── 2026-05-13-deploy-01.md
└── …
```

- Convention de nom : `YYYY-MM-DD-deploy-NN.md`
- `NN` (01, 02, …) permet plusieurs déploiements le même jour (numérotation séquentielle).
- La commande `aiad-sdd dora --record` gère cette numérotation automatiquement.

## Format du fichier

Le contenu est un Markdown simple avec des lignes `clé: valeur` :

```markdown
# Déploiement 2026-05-13 (success)

- status: success
- cycle_time_days: 4.5
- lead_time_days: 8
- version: v1.2.0
- commit: abc1234
```

### Clés reconnues

| Clé | Type | Obligatoire | Exemple | Description |
|-----|------|-------------|---------|-------------|
| `status` | enum | ✓ | `success` / `hotfix` / `failed` | Statut du déploiement. `hotfix` compte dans le Change Failure Rate. |
| `cycle_time_days` | number | recommandé | `4.5` | Temps entre la 1ʳᵉ ligne de code et la mise en prod. |
| `lead_time_days` | number | recommandé | `8` | Temps entre la création du ticket / Intent et la mise en prod. |
| `version` | string | optionnel | `v1.2.0` | Tag de release. |
| `commit` | string | optionnel | `abc1234` | SHA court du commit déployé. |

Les clés inconnues sont ignorées (compatible avec frontmatter / champs custom internes).

## Indicateurs calculés depuis ces fichiers

Le dashboard agrège automatiquement (`lib/dashboard/collect.js#lireMetrics`) :

- **Deployment Frequency** = nombre total de fichiers dans `.aiad/metrics/deployments/` sur la période visible.
- **Cycle Time moyen** = moyenne des `cycle_time_days` non vides.
- **Lead Time moyen** = moyenne des `lead_time_days` non vides.
- **Change Failure Rate** = (nombre de `status: hotfix` ou `failed`) / total × 100.

Une sparkline `cycle_time_days` est tracée pour les 5+ déploiements récents.

## Intégration CI

### GitHub Actions

```yaml
- name: Record deploy in AIAD DORA metrics
  if: success() && github.ref == 'refs/heads/main'
  run: |
    npx aiad-sdd dora --record \
      --status=success \
      --cycle=${{ env.CYCLE_TIME_DAYS }} \
      --release=${{ github.ref_name }} \
      --commit=${{ github.sha }}
    git add .aiad/metrics/deployments/
    git commit -m "chore(dora): record deploy ${{ github.sha }}" || true
    git push
```

### GitLab CI

```yaml
record-dora:
  stage: post-deploy
  script:
    - npx aiad-sdd dora --record --status=success --release=$CI_COMMIT_TAG --commit=$CI_COMMIT_SHORT_SHA
    - git push origin HEAD:main
```

## Cap stratégique

Le format ci-dessus est **volontairement minimaliste** :

- Pas de JSON-Schema imposé (Markdown lisible humainement).
- Pas de service externe à appeler (zero dépendance réseau).
- Souverain par construction — toutes les données restent dans `.aiad/metrics/`.

Pour aller plus loin (sparklines temporelles, comparaison équipe-vs-équipe), voir le backlog AIAD ou écris à `aiad@aiad.ovh`.
