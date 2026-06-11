---
id: SPEC-013-1
title: Déploiement site v1.18 + résolution « 6 vs 7 valeurs »
parent_intent: INTENT-013
status: draft
format: prose
sqs: À évaluer via /sdd gate
author: Steeve Evers
date: 2026-06-11
governance: AIAD-RGAA, AIAD-RGESN
---

# SPEC-013-1 — Déploiement site v1.18 + résolution « 6 vs 7 valeurs »

**Intent parent** : INTENT-013
**SQS** : 1.0 / 5 — Gate **FERMÉE** (2026-06-11) — à découper via `/sdd split`
**Statut** : draft
**Gouvernance** : AIAD-RGAA (le site est une interface), AIAD-RGESN (poids des pages)

> ⛔ **Gate FERMÉE** (Atomicité 0, Testabilité 0, Complétude 0, Non-ambiguïté 0).
> Route : `/sdd split` → **013-1a** « Déployer site v1.18 » + **013-1b** « Unifier
> 7 valeurs sur Constitution/Vision/CLAUDE/site ». Reformuler les critères en
> assertions vérifiables, ajouter ≥ 3 cas limites. Re-gate chaque sous-SPEC.

## 1. Contexte

Le site live aiad.ovh documente le SDD Mode en v1.7 (cycle 9 étapes sans Research,
27 commandes, alias plats), alors que le site v1.18 existe déjà dans `site/` mais
n'est pas déployé. Par ailleurs, deux sources internes se contredisent sur le
nombre de valeurs : Constitution Art. II = **6 valeurs** (Human Authorship replié
dans la valeur n°1) vs page Vision & Philosophie = **7 valeurs** (Human Authorship
en n°7, forme reprise par `CLAUDE.md` et le site v1.18).

## 2. Court-circuit Research (§3.5)

**Décision** : Research court-circuitée — décidée par Steeve Evers (PE / gardien), 2026-06-11.
**Justification** : intention de basse incertitude technique. La cible est du
**contenu éditorial** (versions, valeurs) et un déploiement d'un site statique déjà
existant — pas d'algorithme à concevoir, donc pas de risque « specs-to-code ». Le
Discovery codebase n'apporterait pas d'information décisive.
**Proportionnalité** : garde-fou levé sciemment, conformément au §3.5 et au hook
`discovery-gate.js` (non-bloquant par défaut). Trace conservée ici.

## 3. Implémentation

- **Publication** : déclencher le déploiement de `site/` v1.18 sur aiad.ovh via
  `.github/workflows/docs-deploy.yml`.
- **Résolution valeurs** : appliquer la décision du gardien (cf. §7) au nombre de
  valeurs et la propager à **toutes** les sources : Constitution Art. II, page
  Vision & Philosophie, `CLAUDE.md`/`AGENT-GUIDE.md`, et `site/`.
- **Accessibilité (RGAA)** : vérifier la conformité AA des pages publiées —
  dogfooding de l'agent AIAD-RGAA que le framework impose au code des utilisateurs.

## 4. Critères d'acceptation

- [ ] aiad.ovh sert la **v1.18** : footer à jour, cycle SDD à 7 étapes incluant la
      phase Research, EARS, JNSP, routers `/sdd`·`/aiad`, 31 commandes.
- [ ] Le **nombre de valeurs est unifié à 7** (décision gardien §7) dans la
      Constitution Art. II, la page Vision & Philosophie, `CLAUDE.md` et `site/` —
      Human Authorship explicité comme 7e valeur.
- [ ] Les alias plats dépréciés (`/sdd-intent`…) n'apparaissent plus comme forme
      principale sur le site (formes router en première intention).
- [ ] Les pages publiées passent un audit RGAA AA automatisé (axe-core ou
      équivalent) — 0 violation bloquante.

## 5. Dépendances

- `.github/workflows/docs-deploy.yml` (pipeline de publication du site).
- **Décision gardien** sur « 6 vs 7 valeurs » (§7) — prérequis bloquant du critère 2.

## 6. Definition of Output Done (DoOD)

- [ ] Site déployé et vérifié en production (aiad.ovh).
- [ ] Cohérence des valeurs vérifiée sur les 4 sources.
- [ ] Audit RGAA AA passé.
- [ ] SPEC mise à jour si écart (Drift Lock).

## 7. Décision gardien — « 6 vs 7 valeurs » → TRANCHÉE

> **Décision** : **7 valeurs partout** (option A) — tranchée par Steeve Evers
> (gardien), 2026-06-11. Human Authorship est explicité comme **7e valeur**
> autonome ; la Constitution Art. II est alignée sur l'usage de fait (page Vision
> & Philosophie, `CLAUDE.md`, site v1.18).
>
> Conséquence : le critère 2 est désormais spécifiable sans ambiguïté (N = 7).
> Toute clarification ultérieure de ce point reste soumise à l'accord du gardien
> (Constitution Art. VI).
