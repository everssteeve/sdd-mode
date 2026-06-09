---
id: INTENT-010
title: Cross-model review additive-only (§3.12)
status: active
author: Steeve Evers
date: 2026-06-09
specs: SPEC-010-1
---

# INTENT-010 — Cross-model review additive-only

## Pourquoi

L'analyse (`docs/analyse-claude-code-best-practice.md` §2.3, §2.4) montre la puissance des **uncorrelated context windows** : un modèle crée un bug, un **autre** le trouve (~80 % des bugs attrapés par une équipe d'agents à l'ouverture de PR). Le pattern cross-model (Claude auteur, Codex/Gemini reviewer) impose une règle d'or : le reviewer **insère des findings sans réécrire** (« additive only »).

## Intention

Offrir un second regard non corrélé sur le code SDD, tout en préservant la **paternité de l'auteur** (Human Authorship entre IA) : le reviewer ne fait qu'ajouter des observations citées en contexte frais. Le verdict final reste déterministe (§3.4) ; les findings hauts non résolus forcent au plus `CONDITIONAL` — jamais un FAIL inventé.

## Périmètre

- **SPEC unique** — `lib/cross-model.js` (prompt contexte-frais, parsing tolérant, dédup, merge, influence verdict, rendu artefact), schéma `review.schema.json`, dossier `.aiad/reviews/`, CLI `aiad-sdd cross-model <prompt|merge>`, flag `/sdd validate --cross-model`.

## Hors périmètre

- Invocation du runtime tiers depuis le CLI (déléguée à l'orchestrateur / CLI Codex-Gemini externe) : le module fournit le prompt + la plomberie déterministe, et **dégrade proprement** si le runtime est absent.
- Allowlist read-only enforced du reviewer : documentée (même principe que §3.1) ; l'enforcement dépend de la configuration du runtime tiers.
