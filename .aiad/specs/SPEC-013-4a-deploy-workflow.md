---
id: SPEC-013-4a
title: Workflow de déploiement site/ → gh-pages + gate version
parent_intent: INTENT-013
parent_spec: SPEC-013-4
research: RESEARCH-014
status: review
format: prose
sqs: 5.0
author: Steeve Evers
date: 2026-06-11
governance: AIAD-RGESN
---

# SPEC-013-4a — Déploiement `site/` → `gh-pages` + gate version

**SPEC parent** : SPEC-013-4 (découpée)
**Intent parent** : INTENT-013 · **Research** : RESEARCH-014 (CONDITIONAL GO)
**Ordre d'exécution** : 1 sur 2 (013-4b dépend de celle-ci)
**SQS** : 5/5 — Gate **OUVERTE** (2026-06-11), Test de l'Étranger PASS
**Gouvernance** : AIAD-RGESN (copie statique, 0 dépendance lourde ajoutée)
**Statut** : done (Drift Lock OK 2026-06-11 — workflow + SPEC synchronisés, 0 gap
bloquant, `@spec` tracé. 1er run de publication = merge `main` (geste humain) ;
merge vers `main` = étape de release externe.)

## 1. Contexte

aiad.ovh est servi par la branche **`gh-pages`** (source Pages confirmée —
RESEARCH-014 R1), aujourd'hui synchronisée **manuellement** depuis `site/`.
Cette SPEC automatise la publication **avec un seul garde-fou léger et déjà
outillé** : la cohérence de version. Le gate accessibilité (RGAA, plus lourd) est
traité séparément par **SPEC-013-4b**.

## 2. Comportement attendu

### Input
- Un `push` sur `main` modifiant `site/**`.

### Processing
1. **Gate version** : `node bin/aiad-sdd.js version-sync --check` (exit 0 requis).
2. **Publication** : si le gate passe, publier `site/` → branche `gh-pages`
   (`peaceiris/actions-gh-pages`, `publish_dir: ./site`, `publish_branch: gh-pages`).
3. Sur `pull_request` : exécuter le gate **sans publier**.

### Output
- Branche `gh-pages` = `site/` (commit de déploiement). Échec gate → aucune publication.

### Cas limites (≥ 3)
1. **`version-sync --check` rouge** → publication bloquée (gate avant push).
2. **Push `main` sans changement `site/`** → non déclenché (filtre `paths`).
3. **Conflit `docs-deploy.yml`** (publie `docs/` via Actions-artifact) : surfaces
   disjointes, ce workflow ne touche que `gh-pages` (C-R2) — pas de collision.
4. **Échec/push partiel** → action de publication idempotente (re-run rejoue tout).

## 3. Critères d'acceptation

- [ ] `.github/workflows/site-deploy.yml` se déclenche sur `push: main`
      `paths: ['site/**']` et publie `site/` → `gh-pages`.
- [ ] La publication est **conditionnée** à `version-sync --check` **exit 0** (un
      écart de version bloque le push `gh-pages`).
- [ ] Sur `pull_request`, le gate version s'exécute **sans** publier.
- [ ] Le job déclare **`permissions: contents: write`** uniquement (C-R4).
- [ ] Le workflow **ne touche ni `docs/` ni `docs-deploy.yml`** (C-R2).

## 4. Interface / API

```yaml
# .github/workflows/site-deploy.yml (schéma — phase 4a)
on:
  push: { branches: [main], paths: ['site/**'] }
  pull_request: { paths: ['site/**'] }
permissions: { contents: write }
jobs:
  deploy:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: node bin/aiad-sdd.js version-sync --check
      - if: github.event_name == 'push'
        uses: peaceiris/actions-gh-pages@v4
        with: { publish_dir: ./site, publish_branch: gh-pages }
```

> Le hook RGAA s'insère ici en 013-4b (step avant la publication).

## 5. Dépendances

- Branche `gh-pages` (source Pages). · `lib/version-sync.js` (SPEC-013-3, `done`).
- **Hors périmètre** : `docs-deploy.yml` (non modifié).

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE condensé ~0,5K · SPEC ~1K · modèles workflow ~1K → **~2,5K** ✅ (< 50K)

## 7. Definition of Output Done (DoOD)

- [ ] `site-deploy.yml` ajouté, annoté `@spec SPEC-013-4a-...` (commentaire YAML).
- [ ] Gate version vérifié rouge→vert (écart simulé).
- [ ] 1er run **déclenché par l'humain** (action sortante — publication publique).
- [ ] Gouvernance RGESN (copie statique, 0 dépendance lourde).
- [ ] SPEC mise à jour si écart (Drift Lock).
