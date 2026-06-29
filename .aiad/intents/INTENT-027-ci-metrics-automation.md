# INTENT-027 — Automatisation CI de la collecte de métriques DORA/Flow

**Auteur** : Steeve Evers
**Date** : 2026-06-23
**Statut** : active

---

## POURQUOI MAINTENANT

Les commandes `/aiad dora` et `/aiad flow` ont révélé que les données de déploiement doivent être reconstituées manuellement depuis `git log` — friction concrète observée en session aujourd'hui. Le champ `cycle_time_days` est absent de tous les fichiers existants, rendant les calculs de Cycle Time et de Flow Efficiency non déterministes.

## POUR QUI

Product Engineer solo (Steeve) qui pilote le projet en dogfooding et doit pouvoir lancer `/aiad dora` + `/aiad flow` sur des données fiables sans intervention manuelle.

## OBJECTIF

Après chaque déploiement en production, un fichier `metrics/deployments/` est créé automatiquement avec `cycle_time_days` renseigné — 0 reconstitution manuelle nécessaire.

Métrique cible : 100 % des déploiements tracés automatiquement (vs 0 % aujourd'hui).

## CONTRAINTES

- Zéro dépendance npm runtime ou dev (contrainte structurante non négociable)
- CI GitHub Actions (infrastructure déjà en place)
- Compatible avec les 7 fichiers de déploiement existants (rétrocompatibilité du format)

## CRITÈRE DE DRIFT

Un push sur `main` sans création automatique du fichier déploiement correspondant = drift. Le hook CI lui-même échoue si le fichier n'est pas créé — la vérification est auto-portée.

---

## SPECs liées

- [ ] [SPEC-027-1 — Stamp `validated_at` dans le frontmatter SPEC lors du passage `done`](./../specs/SPEC-027-1-stamp-validated-at.md)
- [ ] [SPEC-027-2 — Fonction `calculateCycleTimeDaysFromSpec()` + flag CLI `--auto`](./../specs/SPEC-027-2-calculate-cycle-time.md)
- [ ] [SPEC-027-3 — Steps CI post-deploy (`site-deploy.yml` + `release.yml`)](./../specs/SPEC-027-3-ci-workflow-steps.md)
