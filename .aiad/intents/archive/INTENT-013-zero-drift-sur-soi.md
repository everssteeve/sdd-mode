---
id: INTENT-013
title: Zéro drift sur soi-même — site et docs alignés sur la version livrée
status: archived
author: Steeve Evers
date: "2026-06-11"
specs: null
archivedAt: "2026-06-24T07:17:03.682Z"
archivedBy: evers.steeve@gmail.com
archivedReason: archive done
---
# INTENT-013 — Zéro drift sur soi-même

## Pourquoi maintenant

L'audit du 2026-06-11 a révélé que le framework drifte sur lui-même : le site
live aiad.ovh documente le SDD Mode en v1.7, le README en v1.12, `SDDMode.md`
en v1.6, alors que le package est en v1.17 (CHANGELOG v1.18). Notre principe
fondateur n°2 est « Drift = Échec de Processus ». Un framework anti-drift qui
drifte sur sa propre vitrine perd sa crédibilité et offre une attaque gratuite
à la concurrence (Spec Kit, Kiro, OpenSpec). Je veux fermer cet écart avant
toute nouvelle fonctionnalité.

## Pour qui

Les évaluateurs/prospects qui jugent le framework sur sa cohérence, les
contributeurs qui doivent savoir quelle version fait foi, et nous-mêmes
(dogfooding de la valeur n°2 « Drift = Échec de Processus »).

## Objectif

- **0 écart de version** entre `package.json`, le site déployé et les en-têtes
  des docs racine (`README.md`, `GUIDE.md`, `SDDMode.md`, `CLAUDE.md`).
- **Site aiad.ovh déployé en v1.18** : intègre le cycle Research, EARS, le
  protocole JNSP, les routers et les 31 commandes.
- **Incohérence « 6 vs 7 valeurs »** (Constitution Art. II vs page Vision &
  Philosophie) tranchée et propagée partout.

## Contraintes

- Ne pas casser les liens/ancres existants du site.
- Le site doit rester cohérent avec la Constitution (sphère des Valeurs —
  toute clarification de valeur exige l'accord du gardien).
- Effort court (~1 semaine), pas de refonte du contenu : alignement seulement.

## Critère de drift

Si une release future publie une version sans synchroniser le site et les
en-têtes des docs → drift. **Un check CI doit échouer dès que la version
annoncée quelque part (docs/site) diffère de `package.json`.**

---

## SPECs liées

- [~] SPEC-013-1 — Déploiement site v1.18 + résolution « 6 vs 7 valeurs »
      *(Gate FERMÉE SQS 1.0 → **découpée** le 2026-06-11)*
  - [x] SPEC-013-1a — Déploiement du site aiad.ovh en v1.18 *(**objectif ATTEINT**
        2026-06-12 — site v1.18 publié via `site-deploy.yml` (gh-pages `df34283`).
        Frontmatter tenu `in-progress` : SPEC sans code, le trace ne sait pas la
        marquer `done` — [[FACT-004]]. Audit RGAA AA délégué à 013-4b.)*
  - [⊘] SPEC-013-1b — Unification à 7 valeurs *(**ARCHIVÉE** : contradiction « 6 vs 7 »
        inexistante — toutes les sources disent déjà 7. Aucune action requise.)*
- [x] SPEC-013-2 — Unification des docs racine + archivage de `SDDMode.md`
      *(**DONE** 2026-06-11 — cycle complet exec→validate→Drift Lock. SDDMode.md
      archivé, GUIDE/CLAUDE version-agnostiques, provenance historique préservée.)*
- [x] SPEC-013-3 — Sync auto des versions (zones marquées) + check CI
      *(**DONE** 2026-06-11 — cycle complet Research→Gate 5/5→exec phasé 3/3→
      validate→Drift Lock. `lib/version-sync.js` + workflow + 59 zones, CI 7/7.)*
- [~] SPEC-013-4 — Workflow de déploiement `site/` → `gh-pages`
      *(Gate OUVERTE 4/5 avec réserve RGAA → **découpée** le 2026-06-11)*
  - [x] SPEC-013-4a — Deploy site/→gh-pages + gate version *(**DONE** 2026-06-11 —
        cycle complet exec→validate→Drift Lock. `site-deploy.yml` + gate version ;
        1er run de publication au merge `main` = geste humain.)*
  - [ ] SPEC-013-4b — Gate RGAA AA avant publication *(draft — réserve : outil/config + dépendance Chromium)*

## Clôture — INTENT-013 done (2026-06-12)

Les trois objectifs sont atteints : **0 écart de version** (013-3, check CI),
**site aiad.ovh déployé en v1.18** (013-1a + 013-4a, publié sur `gh-pages`
`df34283`), **incohérence valeurs tranchée** (013-1b — fantôme, déjà à 7 partout).
En bonus : CI assainie des conflits Pages (docs-deploy + dashboard supprimés, FACT-003).

**Résidu non bloquant** : SPEC-013-4b (gate RGAA AA) reste `draft` — c'est un
**renforcement d'accessibilité au-delà du périmètre original** de l'intention
(qui portait sur le drift de version/contenu, pas l'audit AA). Conservé comme
suivi ouvert ; pourra être repris via un Intent dédié si jugé prioritaire.
