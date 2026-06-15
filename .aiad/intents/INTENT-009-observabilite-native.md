---
id: INTENT-009
title: Observabilité native — statusLine + OTel + usage skills + attribution (§3.11)
status: done
author: Steeve Evers
date: 2026-06-09
specs: SPEC-009-1
---

# INTENT-009 — Observabilité native

## Pourquoi

SDD produit déjà des métriques (DORA/Flow) mais via des commandes maison écrivant dans `.aiad/metrics/`. L'analyse (`docs/analyse-claude-code-best-practice.md` §2.1, §6.2) propose de brancher l'observabilité sur les **primitives natives** : OpenTelemetry (`OTEL_*`), une `statusLine` live, la mesure d'usage des skills via hook `PreToolUse`, et `Co-Authored-By` imposé par les settings (pas par le bon vouloir du modèle).

## Intention

Rendre le PE **conscient en continu** de son état de cycle (sans ouvrir une commande) et l'outillage **mesurable** par n'importe quel backend standard. Sobriété Intentionnelle : mesurer l'usage réel des skills pour retirer les inutilisées. Responsabilité : tracer l'attribution par le harness.

## Périmètre

- **SPEC-A** — statusLine (`lib/statusline.js` + CLI + hook `statusline.js` + `settings.statusLine`) + attribution (`includeCoAuthoredBy: true`).
- **SPEC-B** — mesure d'usage des skills (hook `PreToolUse(Skill)` → `.aiad/metrics/skill-usage.jsonl`) + scaffolding OTel opt-in (clés `_OTEL_*` dans les settings + doc `telemetrie.md`).

## Hors périmètre

- Pipeline d'émission OTel custom depuis `lib/telemetry.js` : Claude Code exporte nativement quand `OTEL_*` est configuré — on fournit le scaffolding + la doc, pas un exporteur maison (éviterait de réinventer une primitive native).
