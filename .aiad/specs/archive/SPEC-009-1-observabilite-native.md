---
id: SPEC-009-1
title: Observabilité native — statusLine + OTel + usage skills + attribution (§3.11)
parent_intent: INTENT-009
status: archived
format: prose
sqs: 4.1
author: Steeve Evers
date: "2026-06-09"
archivedAt: "2026-06-24T07:31:15.548Z"
archivedBy: evers.steeve@gmail.com
archivedReason: archive done
---
# SPEC-009-1 — Observabilité native

**Intent parent** : INTENT-009
**SQS** : 4.1 / 5
**Statut** : in-progress

## Objectif

Brancher l'observabilité SDD sur les primitives natives : statusLine live, attribution garantie, mesure d'usage des skills, scaffolding OTel opt-in.

## Implémentation

- **SPEC-A** `lib/statusline.js` : `etatSdd` (SPEC active la plus avancée + SQS depuis `specs/_index.md`), `prochaineEtapeCycle` (graphe §3.9), `construireStatusline` (pur : SPEC │ Gate ✅/⚠ │ étape │ ctx %⚠≥70 │ effort │ modèle │ coût), `parserStdin`. CLI `aiad-sdd statusline` (lit stdin JSON Claude Code). Hook `.aiad/hooks/statusline.js` (shell-out, jamais bloquant) déclaré dans `settings.statusLine.command`. Attribution : `settings.includeCoAuthoredBy: true`.
- **SPEC-B** : hook `.aiad/hooks/skill-usage.js` (`PreToolUse(Skill)` → `.aiad/metrics/skill-usage.jsonl`, best-effort, bypass `AIAD_HOOK_SILENT=1`) déclaré dans les settings. Scaffolding OTel : clés `_OTEL_*` opt-in dans `settings.env` + section dédiée dans `docs/telemetrie.md`.

## Critères d'acceptation

1. the system SHALL afficher dans la statusLine la SPEC active, l'état de la dernière Gate (SQS), le % de contexte et l'effort.
2. WHEN une skill est invoquée, the system SHALL journaliser son usage (`.aiad/metrics/skill-usage.jsonl`), sans jamais bloquer.
3. the system SHALL apposer `Co-Authored-By` via `includeCoAuthoredBy` indépendamment du modèle.
4. WHERE OTel est configuré (clés `OTEL_*`), the system SHALL exporter ses métriques (primitive native, sous consentement) ; les clés sont livrées désactivées.
5. Aucune régression : la suite complète passe (`npm test`).

## Vérification

- `test/statusline.test.js` (12 ✓). `settings.json` parse valide (clés statusLine / includeCoAuthoredBy / hook Skill présentes).
- Suite complète `npm test` ; lint · esm · size verts.

## Hors périmètre

- Exporteur OTel maison depuis `lib/telemetry.js` (Claude Code exporte nativement — scaffolding + doc suffisent).
- Intégration du rendu statusLine dans `lib/status.js` (la commande `statusline` est la source).
