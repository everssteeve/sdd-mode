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
  - [ ] SPEC-013-1a — Déploiement du site aiad.ovh en v1.18 *(SQS 4.4 — Gate ouverte)*
  - [ ] SPEC-013-1b — Unification à 7 valeurs sur les 4 sources *(SQS 4.2 — Gate ouverte)*
- [x] SPEC-013-2 — Unification des docs racine + archivage de `SDDMode.md` *(draft — court-circuit Research tracé)*
- [ ] SPEC-013-3 — Synchronisation automatique des en-têtes de version
      (extension `emit-rules` + check CI `version ≠ package.json` → échec)
      *(RESEARCH-013 en cours — verdict GO/NO-GO en attente)*
