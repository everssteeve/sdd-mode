---
id: SPEC-013-1a
title: Déploiement du site aiad.ovh en v1.18
parent_intent: INTENT-013
parent_spec: SPEC-013-1
status: review
format: prose
sqs: 4.4
author: Steeve Evers
date: 2026-06-11
governance: AIAD-RGAA, AIAD-RGESN
---

# SPEC-013-1a — Déploiement du site aiad.ovh en v1.18

**SPEC parent** : SPEC-013-1 (découpée)
**Intent parent** : INTENT-013
**Ordre d'exécution** : 1 sur 2 (indépendante de 013-1b — fichiers disjoints)
**Dépendances intra-split** : aucune
**SQS** : 4.4 / 5 — Gate **OUVERTE** (2026-06-11)
**Gouvernance** : AIAD-RGAA (le site est une interface), AIAD-RGESN (poids des pages)

## 1. Contexte

Le site live aiad.ovh documente le SDD Mode en **v1.7** (cycle 9 étapes sans
phase Research, 27 commandes, alias plats en forme principale), alors que le
site **v1.18 existe déjà dans `site/`** mais n'est pas déployé. Écart de vitrine
direct vs `package.json` (v1.17 / CHANGELOG v1.18) — cœur de INTENT-013.

> Cette SPEC ne touche **que la publication** du contenu `site/` déjà rédigé.
> L'unification du nombre de valeurs est traitée séparément par SPEC-013-1b.

## 2. Court-circuit Research (§3.5)

**Décision** : Research court-circuitée — Steeve Evers (PE / gardien), 2026-06-11.
**Justification** : déploiement d'un site statique déjà existant, aucune inconnue
de faisabilité, pas de surface de code applicatif. Hérité de SPEC-013-1.
**Proportionnalité** : garde-fou levé sciemment (hook `discovery-gate.js` non
bloquant). Trace conservée ici.

## 3. Implémentation

- **Publication** : déclencher le déploiement de `site/` v1.18 sur aiad.ovh via
  `.github/workflows/docs-deploy.yml` (vérifier que le workflow cible bien le
  contenu courant de `site/` et la bonne branche/environnement).
- **Accessibilité (RGAA)** : auditer la conformité AA des pages publiées
  (axe-core ou équivalent) — dogfooding de l'agent AIAD-RGAA que le framework
  impose au code des utilisateurs.
- **Sobriété (RGESN)** : vérifier qu'aucune ressource lourde non essentielle
  n'est ajoutée par le déploiement (pas de régression de poids de page).

## 4. Critères d'acceptation

- [ ] aiad.ovh sert la **v1.18** : footer/version à jour, cycle SDD à **7 étapes**
      incluant la phase Research, mentions EARS, protocole JNSP, routers
      `/sdd`·`/aiad`, **31 commandes**.
- [ ] Les **alias plats dépréciés** (`/sdd-intent`, `/aiad-status`…) n'apparaissent
      plus comme forme **principale** sur le site (formes router en première
      intention ; mention de dépréciation tolérée).
- [ ] Les pages publiées passent un audit **RGAA AA automatisé** (axe-core ou
      équivalent) — **0 violation bloquante**.
- [ ] **Aucun lien/ancre interne cassé** après déploiement (tous les renvois du
      site résolvent — contrainte INTENT-013 « ne pas casser les ancres »).

## 5. Cas limites (≥ 3)

1. **Cache CDN / DNS** : après déploiement, aiad.ovh peut servir une version
   cachée → vérifier l'invalidation du cache / purge CDN avant de valider le
   critère 1.
2. **Ancres entrantes externes** : des liens externes pointent vers des ancres
   v1.7 (ex. `#27-commandes`) → recenser et, si renommées, prévoir des
   redirections ou conserver les ancres.
3. **Échec partiel du workflow** : `docs-deploy.yml` peut publier un sous-ensemble
   (build OK, upload KO) → le critère 1 n'est validé qu'après vérification HTTP
   en production, pas sur la sortie du job.
4. **Régression RGAA introduite par v1.18** : la v1.18 peut avoir de nouveaux
   composants non audités → l'audit AA est bloquant, pas indicatif.

## 6. Dépendances

- `.github/workflows/docs-deploy.yml` (pipeline de publication du site).
- Contenu `site/` v1.18 (déjà présent — pré-requis satisfait).

## 7. Definition of Output Done (DoOD)

- [ ] Site déployé et **vérifié en production** (HTTP 200 + version affichée).
- [ ] Audit RGAA AA passé (0 violation bloquante).
- [ ] Vérification des liens/ancres (pas de 404 ni d'ancre morte).
- [ ] SPEC mise à jour si écart constaté (Drift Lock).
