---
id: INTENT-013
title: Zéro drift sur soi-même — site et docs alignés sur la version livrée
status: draft
author: Steeve Evers
date: 2026-06-11
specs:
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
  - [~] SPEC-013-1a — Déploiement du site aiad.ovh en v1.18 *(exec 2026-06-11 :
        contenu aligné 33/17 + 0 lien cassé. Bloqué pour `done` : déploiement
        `site/`→`gh-pages` (sortant, humain) + audit RGAA AA hors session.)*
  - [⊘] SPEC-013-1b — Unification à 7 valeurs *(**ARCHIVÉE** : contradiction « 6 vs 7 »
        inexistante — toutes les sources disent déjà 7. Aucune action requise.)*
- [~] SPEC-013-2 — Unification des docs racine + archivage de `SDDMode.md`
      *(exec 2026-06-11 : SDDMode.md → `docs/archive/`, GUIDE/CLAUDE version-agnostiques,
      provenance historique préservée. 100 % in-repo, prêt pour validate→done.)*
- [x] SPEC-013-3 — Sync auto des versions (zones marquées) + check CI
      *(**DONE** 2026-06-11 — cycle complet Research→Gate 5/5→exec phasé 3/3→
      validate→Drift Lock. `lib/version-sync.js` + workflow + 59 zones, CI 7/7.)*
- [ ] SPEC-013-4 — Déploiement `site/` → `gh-pages` automatisé *(planifiée —
      issue de l'exec 013-1a : le déploiement est aujourd'hui manuel/sortant.
      À cadrer via `/sdd research` puis `/sdd spec`.)*
