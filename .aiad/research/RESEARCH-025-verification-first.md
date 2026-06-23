---
id: RESEARCH-025
title: Verification-first — dériver des squelettes de tests depuis des SPECs EARS
intent: INTENT-019
author: Steeve Evers
date: 2026-06-23
verdict: GO
confidence: 80
status: decided
---

# RESEARCH-025 — Verification-first

## Discovery

- `lib/dashboard/acceptance-criteria.js:15` — regex `EARS_PAT` : `/(WHEN|IF|WHILE|WHERE).+SHALL/i` — parser EARS opérationnel, retourne `{sectionAC, ears, checkboxes}` (lignes 13-42)
- `lib/dashboard/collect.js:1` — `extraireCriteresAcceptation(body)` sort `[{id, titre, pattern, texte}]` — corpus structuré exploitable par un générateur
- `lib/sdd-trace.js:66` — regex `@verified-by` : `/@verified-by\s+([^\s\n*#]+)/g` — parsing déjà opérationnel
- `lib/sdd-trace.js:462` — `construireMatrice(racineProjet)` : map `testsParPathCode` (ligne 477) associe code → tests via `@verified-by`
- `lib/sdd-trace.js:1065` — `compterGapsBloquants()` : critères actuels sans gap `earsSpecsSansTests` — extension directe possible
- `lib/spec-suggester.js:65` — `genererSquelette()` génère des SPECs EARS, pas des tests — extension `--with-tests` identifiée
- `lib/spec-suggester.js:125` — `suggererSpecs()` point d'entrée CLI — surface d'extension naturelle
- `test/dashboard-digest.test.js:1` — convention `@spec` + `@verified-by` en en-tête + nommage `CA-NNN — <titre>` (ligne 40+) — référence pour les squelettes générés
- `test/trace.test.js:1` — couverture partielle `sdd-trace.js` — à étendre pour le nouveau gap
- `test/spec-suggester.test.js:1` — couverture `spec-suggester.js` — à étendre pour `--with-tests`

**Module absent** : `lib/test-skeleton-generator.js` — à créer (module central, ~100-150 lignes). Logique cible : SPEC EARS → `extraireCriteres()` → `[CA-001..N]` → `test/SPEC-NNN-N.test.js` (framework `node:test`).

**Corpus SPECs EARS disponible** : SPEC-015-1/2-1/2-2/3, SPEC-016-2/4, SPEC-017-1/2/3/4, SPEC-018-1..5 — toutes `done`, tests liés présents pour la plupart.

---

## Faisabilité

**Verdict préliminaire : faisable, infrastructure bien en place.**

L'intention s'appuie sur une fondation solide :
- Le parser EARS (`acceptance-criteria.js:13-42`) extrait déjà les patterns WHEN/IF/WHERE/SHALL
- La matrice de traçabilité (`sdd-trace.js:462`) gère déjà `@verified-by`
- `compterGapsBloquants()` est conçu pour être étendu (`sdd-trace.js:1065`)
- Le corpus de SPECs EARS existant (≥ 10 SPECs) permet de tester le générateur immédiatement
- La convention `CA-NNN — <titre>` est établie dans les tests existants

**Ce qui reste à créer :**
1. `lib/test-skeleton-generator.js` (module central, ~100-150 lignes)
2. Extension de `compterGapsBloquants()` pour le gap `earsSpecsSansTests`
3. Flag `--suggest-tests` dans le CLI (faible surface)

**Effort estimé : modéré** (2 SPECs bien bornées, pas d'architecture nouvelle).

---

## Risques & Inconnues

| # | Risque | Sévérité | Mitigation |
|---|--------|----------|------------|
| R1 | Faux sentiment de couverture — un squelette vide génère un `@verified-by` et **masque** un gap réel | Moyen | Le squelette doit rester `TODO` jusqu'à implémentation humaine ; `trace` ne le compte pas comme couverture tant qu'il ne contient aucune assertion |
| R2 | Périmètre des 2 SPECs : SPEC-019-1 (générateur) et SPEC-019-2 (liaison + trace) sont interdépendantes — risque de se retrouver avec une SPEC-019-1 done mais inutilisable sans 019-2 | Moyen | Livrer 019-1 avec intégration basique `@verified-by` inline, 019-2 étend la matrice |
| R3 | Framework test : node:test seul ou aussi Jest/Vitest ? | Faible | Tranché GO : `node:test` par défaut, flag `--framework` en phase 2 |

## Verdict : GO (80 %)

Décision : Steeve Evers — 2026-06-23

R3 tranché : générateur produit des squelettes `node:test` par défaut (aligné corpus), flag `--framework` en phase 2.

## Conditions

*Aucune condition bloquante — GO franc.*
