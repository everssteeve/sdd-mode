---
id: SPEC-010-1
title: Cross-model review additive-only (§3.12)
parent_intent: INTENT-010
status: in-progress
format: prose
sqs: 4.1
author: Steeve Evers
date: 2026-06-09
---

# SPEC-010-1 — Cross-model review additive-only

**Intent parent** : INTENT-010
**SQS** : 4.1 / 5
**Statut** : in-progress

## Objectif

Faire reviewer le diff par un modèle tiers en contexte frais, agréger ses Findings additifs (dédup), sans jamais réécrire ni inventer un verdict FAIL.

## Implémentation

- `lib/cross-model.js` : `construirePromptReviewer` (contexte frais : diff + SPEC, jamais le raisonnement de l'auteur ; additive-only ; JSON imposé), `parserSortieReviewer` (tolérant au bavardage/```), `dedupFindings` (clé fichier:ligne:description ; garde sévérité max + reviewers), `mergerRapports`, `influenceVerdict` (PASS + finding haut → CONDITIONAL ; **jamais de FAIL inventé** ; base FAIL/JNSP conservée), `rendreReview`, `chargerRapports`.
- Schéma `.aiad/schema/verdicts/review.schema.json`. Dossier `.aiad/reviews/` (+ template `_index.md`, `init`).
- CLI `aiad-sdd cross-model <prompt|merge> <SPEC-id>` (flags `--reviewer`, `--diff`, `--base`, `--output-format verdict`). Flag `/sdd validate --cross-model <reviewer>` documenté (Étape 6b) avec dégradation propre.

## Critères d'acceptation

1. WHEN `--cross-model` est lancé, the system SHALL produire un prompt contexte-frais pour un modèle tiers (diff + SPEC, sans le raisonnement de l'auteur).
2. the system SHALL restreindre le reviewer à des Findings additifs ; il SHALL NOT modifier le code ou la SPEC (contrat documenté).
3. the system SHALL dédupliquer les Findings avant agrégation (fichier:ligne:description).
4. the system SHALL conserver un verdict déterministe ; les Findings hauts non résolus SHALL au plus forcer CONDITIONAL (jamais un FAIL inventé).
5. WHERE le runtime tiers est indisponible, the system SHALL dégrader proprement (skip + note), jamais bloquer.
6. Aucune régression : la suite complète passe (`npm test`).

## Vérification

- `test/cross-model.test.js` (12 ✓) ; sortie reviewer conforme à `review.schema.json`.
- Suite complète `npm test` ; lint · esm · size verts.

## Hors périmètre

- Appel effectif du runtime Codex/Gemini (orchestrateur externe).
- Enforcement de l'allowlist read-only du reviewer (dépend du runtime tiers).
