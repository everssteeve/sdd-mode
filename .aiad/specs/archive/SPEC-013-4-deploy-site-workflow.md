---
id: SPEC-013-4
title: Workflow de déploiement site/ → gh-pages (gate version + RGAA)
parent_intent: INTENT-013
research: RESEARCH-014
status: split
format: prose
sqs: 4.0 (OUVERTE avec réserve → découpée)
author: Steeve Evers
date: 2026-06-11
governance: AIAD-RGAA, AIAD-RGESN
---

# SPEC-013-4 — Workflow de déploiement `site/` → `gh-pages`

**Intent parent** : INTENT-013 — Zéro drift sur soi-même
**Research** : RESEARCH-014 — **CONDITIONAL GO** (85 %), conditions C-R2/R3/R4
**SQS** : 4/5 (Complétude 1 · Testabilité 1 · Atomicité 1 · Non-ambiguïté 0 ·
Traçabilité 1) — Gate **OUVERTE avec réserve** (2026-06-11), Test de l'Étranger PASS avec réserve
**Statut** : split
**Gouvernance** : AIAD-RGAA, AIAD-RGESN

> ✅ **Découpée le 2026-06-11** (décision gardien, suite à la réserve Gate
> Non-ambiguïté) en deux sous-SPECs par dépendance :
>
> | Sous-SPEC | Titre | SQS | Statut | Ordre |
> |-----------|-------|-----|--------|-------|
> | [SPEC-013-4a](./SPEC-013-4a-deploy-workflow.md) | Deploy site/→gh-pages + gate version | 5.0 | review (Gate OUVERTE) | 1/2 |
> | [SPEC-013-4b](./SPEC-013-4b-gate-rgaa.md) | Gate RGAA AA avant publication | À évaluer | draft (réserve RGAA) | 2/2 |
>
> 013-4a isole la partie **légère et déjà outillée** (deploy + gate version),
> 013-4b isole la partie **incertaine/lourde** (RGAA + dépendance Chromium) qui
> portait la réserve. Cette parente ne s'exécute plus directement.

> Conditions héritées de RESEARCH-014 (contraignantes) :
> **C-R2** — ne pas entrer en conflit avec `docs-deploy.yml` (qui publie `docs/`
> en méthode Actions-artifact) : ce workflow ne touche **que la branche
> `gh-pages`**, surface distincte.
> **C-R3** — garde-fou de publication : **ne publier que si `version-sync --check`
> ET un audit RGAA AA passent** (jamais une page désynchronisée ou non conforme).
> **C-R4** — permissions minimales (`contents: write` ciblé, pas de token large).

## 1. Contexte

aiad.ovh est servi par la branche **`gh-pages`** (mirroir de `site/`, confirmé
source Pages par le gardien — RESEARCH-014 R1). Aujourd'hui le sync est **manuel**
(commits directs sur `gh-pages`), ce qui rouvre le risque de drift entre `site/`
et le site live — exactement ce que INTENT-013 veut fermer. Cette SPEC automatise
la publication, sous garde-fous.

## 2. Comportement attendu

### Input
- Un `push` sur `main` modifiant `site/**`.
- La branche cible `gh-pages` (source Pages).

### Processing
1. **Gate version** : `aiad-sdd version-sync --check` (exit 0 requis).
2. **Gate accessibilité** : audit **RGAA AA** des pages de `site/` (axe-core ou
   `pa11y-ci`) — 0 violation bloquante requise.
3. **Publication** : si (et seulement si) les deux gates passent, publier le
   contenu de `site/` sur la branche `gh-pages` (ex. `peaceiris/actions-gh-pages`
   `publish_dir: ./site`, `publish_branch: gh-pages`).
4. **Court-circuit** : sur `pull_request`, exécuter les gates **sans publier**
   (vérification only).

### Output
- Branche `gh-pages` mise à jour = `site/` (commit de déploiement).
- En cas d'échec d'un gate : **aucune publication**, workflow rouge.

### Cas limites (≥ 3)
1. **`version-sync --check` rouge** → publication **bloquée** (gate échoue avant push).
2. **Violation RGAA AA** → publication **bloquée** (dogfooding du veto RGAA).
3. **Push `main` sans changement `site/`** → workflow **non déclenché** (filtre `paths`).
4. **Conflit `docs-deploy.yml`** : les deux tournent sur `push main`, mais ciblent
   des surfaces disjointes (`docs/` via Actions-artifact vs `gh-pages` via branche) —
   pas de collision (C-R2). À documenter explicitement.
5. **Échec réseau/push partiel** → l'action de déploiement est idempotente
   (re-run rejoue la publication complète, pas d'état partiel).

## 3. Critères d'acceptation

- [ ] Un workflow `.github/workflows/site-deploy.yml` se déclenche sur
      `push: main` avec `paths: ['site/**']` et publie `site/` → `gh-pages`.
- [ ] La publication est **conditionnée** à `version-sync --check` **exit 0** —
      un écart de version **bloque** le déploiement (pas de push `gh-pages`).
- [ ] Un **audit RGAA AA** s'exécute avant publication ; **≥ 1 violation
      bloquante** empêche le déploiement.
- [ ] Sur `pull_request`, les deux gates s'exécutent **sans** publier.
- [ ] Le job déclare des **permissions minimales** (`contents: write` uniquement).
- [ ] Le workflow **ne modifie ni `docs/` ni le pipeline `docs-deploy.yml`**
      (surfaces disjointes — C-R2).

## 4. Interface / API

```yaml
# .github/workflows/site-deploy.yml (schéma)
on:
  push: { branches: [main], paths: ['site/**'] }
  pull_request: { paths: ['site/**'] }
permissions:
  contents: write
jobs:
  deploy:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: node bin/aiad-sdd.js version-sync --check      # gate C-R3 (version)
      - run: npx pa11y-ci site/**/*.html   # ou axe-core    # gate C-R3 (RGAA AA)
      - if: github.event_name == 'push'
        uses: peaceiris/actions-gh-pages@v4
        with: { publish_dir: ./site, publish_branch: gh-pages }
```

## 5. Dépendances

- Branche `gh-pages` (source Pages — RESEARCH-014).
- `lib/version-sync.js` (gate version, SPEC-013-3, `done`).
- `.aiad/gouvernance/AIAD-RGAA.md` (référentiel du gate accessibilité).
- **Hors périmètre** : `docs-deploy.yml` (publie `docs/`, non modifié).

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~0,5K · cette SPEC : ~1,4K
- `docs-deploy.yml` + `aiad-version-check.yml` (modèles) : ~1K
- **Total estimé** : ~3K tokens ✅ (< 50K)

## 7. Definition of Output Done (DoOD)

- [ ] `site-deploy.yml` ajouté, annoté `@spec SPEC-013-4-...` (commentaire YAML).
- [ ] Gates version + RGAA vérifiés rouge→vert (écart simulé).
- [ ] 1er run **déclenché par l'humain** (action sortante — publication publique).
- [ ] Gouvernance RGAA (gate AA) + RGESN (copie statique, 0 dépendance lourde ajoutée).
- [ ] SPEC mise à jour si écart (Drift Lock) ; INTENT-013 → `done` une fois 013-1a publié.
