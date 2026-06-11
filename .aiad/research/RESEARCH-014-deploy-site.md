---
id: RESEARCH-014
title: Automatisation du déploiement site/ → gh-pages (anti-drift de publication)
intent: INTENT-013
target_spec: SPEC-013-4
author: Steeve Evers
date: 2026-06-11
verdict: CONDITIONAL GO
confidence: 85
---

# RESEARCH-014 — Déploiement `site/` → `gh-pages` automatisé

**Intent parent** : INTENT-013 — Zéro drift sur soi-même
**SPEC visée** : SPEC-013-4
**Question** : peut-on automatiser la publication de `site/` vers aiad.ovh (au lieu
du sync manuel sur `gh-pages`), pour supprimer le risque de drift entre `site/` et
le site live — vu le code réel ?

> Contexte : SPEC-013-1a a livré l'alignement de contenu mais a laissé la
> publication comme **action manuelle/sortante**. Cette Research cadre son
> automatisation, « après avoir déployé » manuellement une première fois.

## Discovery

Ancrages `chemin:ligne` (investigation 2026-06-11, ce repo).

**Mécanisme de publication actuel**

- aiad.ovh est servi par la **branche `origin/gh-pages`** (contenu racine :
  `assets/ en/ fr/ index.html` — mirroir de `site/`). Dernier déploiement :
  commit `gh-pages@61ef97f` (2026-06-10), **sync manuel** (commits directs).
- **Aucun workflow ne pousse `site/` → `gh-pages`** : seul `aiad-version-check.yml:15`
  réagit à `site/**` (vérif de version, pas de déploiement).
- `docs-deploy.yml` publie une **surface différente** : `source: ./docs`
  (`docs-deploy.yml:45`) via `actions/upload-pages-artifact@v3`
  (`:49`) + `actions/deploy-pages@v4` (`:60`), sur `push: main` (`:10`).

**Conflit de configuration (cœur de l'inconnue)**

- `docs/_config.yml:2` documente « Source = Deploy from a branch → /docs ».
- Or `docs-deploy.yml` utilise la **méthode GitHub Actions (artifact)**.
- GitHub Pages n'autorise **qu'une seule source** par site. Donc soit la branche
  `gh-pages` sert aiad.ovh (et `docs-deploy.yml` cible un autre domaine / est
  inopérant), soit l'Actions-artifact `docs/` sert (et `gh-pages` est legacy).
  Ce réglage est dans **Settings → Pages** (non lisible depuis le repo).

**Mécanismes réutilisables**

- `lib/version-sync.js:41` (`DEFAULT_ROOTS=['site']`) + `aiad-version-check.yml`
  → pré-check de cohérence de version, gate naturel **avant** publication.
- Pattern de déploiement de branche éprouvé : `peaceiris/actions-gh-pages`
  ou un `git worktree`/rsync + commit sur `gh-pages`.
- `site/` = 64 fichiers statiques (pas de build), donc publication = copie directe.

## Faisabilité

**Réalisable** : workflow `site-deploy.yml` sur `push: main` (paths `site/**`) qui
(1) lance `version-sync --check` + un audit RGAA, puis (2) publie `site/` → branche
`gh-pages`. Coût ~0,5 j, 1 workflow, `permissions: contents: write`. **MAIS** la
viabilité dépend entièrement de la topologie GitHub Pages réelle (cf. R1).

## Risques & inconnues

- **R1 (LEVÉ)** — la **source GitHub Pages** d'aiad.ovh = branche **`gh-pages`**,
  confirmé par le gardien (Settings → Pages, 2026-06-11). Automatiser le push
  `gh-pages` est donc le bon mécanisme. (Inconnue résolue par autorité humaine.)
- **R2** — double déploiement : `docs-deploy.yml` (docs/) + un nouveau
  `site-deploy` (gh-pages) sur le même Pages → conflit possible. Clarifier la
  topologie (un seul domaine ? `docs.aiad.ovh` vs `aiad.ovh` ?).
- **R3** — action **sortante automatisée** : publier le site public à chaque
  merge `main`. Garde-fou obligatoire : gate `version-sync --check` + RGAA AA
  **avant** publication (ne jamais publier une page non conforme).
- **R4** — permissions/token : le workflow exige `contents: write` (push gh-pages).

## Verdict : CONDITIONAL GO (confidence: 85 %)

**Déclaré GO** par **Steeve Evers** (gardien), 2026-06-11 — **R1 levé par autorité
humaine** : le gardien confirme, de sa connaissance directe (Settings → Pages),
que la **branche `gh-pages` est la source GitHub Pages d'aiad.ovh** (fait non
lisible depuis le repo, indécidable pour l'agent seul).

**Durci en CONDITIONAL GO** par le scorer déterministe (`lib/research.js:245`) :
un GO franc ne peut pas masquer les risques encore listés (R2/R3/R4). Ils
deviennent les **conditions à lever pendant `/sdd spec`** — c'est le garde-fou
anti-« GO franc masquant une inconnue », et c'est voulu. `/sdd spec` reste
autorisé (CONDITIONAL = exit 0).

## Conditions (à lever dans SPEC-013-4)

- **C-R2** : clarifier la topologie de domaines / Pages (un seul site ? éviter le
  conflit avec `docs-deploy.yml` qui publie `docs/`).
- **C-R3** : garde-fou de publication — ne publier que si `version-sync --check`
  **et** un audit RGAA AA passent (jamais une page non conforme/désynchronisée).
- **C-R4** : permissions minimales (`contents: write` ciblé / token dédié).
