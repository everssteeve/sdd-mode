---
id: SPEC-006-1
title: Canary suite + alignement des références modèles (§3.10 SPEC-A + SPEC-B)
parent_intent: INTENT-006
status: done
format: prose
sqs: 4.2
author: Steeve Evers
date: 2026-06-09
---

# SPEC-006-1 — Canary suite + alignement des références modèles

**Intent parent** : INTENT-006
**SQS** : 4.2 / 5
**Statut** : in-progress

## Objectif

Distinguer une régression réelle d'un bruit de serving via un set figé de cas rejoués contre une baseline, et aligner les références modèles documentaires sur Opus 4.8.

## Implémentation

- **Logique pure** `lib/canary.js` : `parserCasCanary` / `chargerCasCanary` (frontmatter `id`/`kind`/`command`/`expected`/`tolerance`), `evaluerDeterministe` (100 % reproductible ET = baseline, sinon bug code), `evaluerGeneratif` (dispersion vs bande ±tolérance), `executerCanary` (runner injectable → agrégat verdict), `lireSnapshotCanary` (bloc `canary:` de `config.yml`).
- **Schéma** `.aiad/schema/verdicts/canary.schema.json` ; verdict canonique (`lib/verdict.js`), exit 0/1/2.
- **CLI** `aiad-sdd canary [--runs N] [--output-format verdict]` : runner réel deterministic = spawn `aiad-sdd <command>` K fois (lecture du verdict JSON, fallback exit code) ; generative = échantillons figés `.aiad/metrics/canary/samples/<id>.json` (absents → JNSP, non mesuré).
- **Cas figés** `.aiad/canary/cases/` (+ template + `init`) : CANARY-001 (fail-closed Discovery → JNSP), CANARY-010 (dispersion SQS, réf. 4, ±14 %).
- **Snapshot épinglé** dans `.aiad/config.yml` (`model: claude-opus-4-8`, `effort: max`, `claude_code_version: v2.1.168`, `tolerance_pct: 14`).
- **CI** `templates/.github/workflows/canary.yml` (cron nocturne, exit 1/2 bloquant, CONDITIONAL non bloquant).
- **Lien `/aiad retro`** : garde-fou anti-bruit (ne conclure régression que sur FAIL ou DRIFT hors bande).
- **SPEC-B** : `Opus 4.7` → `Opus 4.8` dans la documentation (CLAUDE.md, SDDMode.md, GUIDE.md, corps de commandes `templates/.claude/`).

## Critères d'acceptation

1. the system SHALL rejouer la canary suite et produire un rapport daté + snapshot modèle.
2. WHEN un cas deterministic n'est pas 100 % reproductible (ou ≠ baseline), the system SHALL émettre `FAIL` (bug code), exit 1.
3. IF un volet génératif dévie au-delà de la bande `tolerance_pct`, the system SHALL marquer `CONDITIONAL` (DRIFT à investiguer) avec conditions non vides.
4. WHEN aucun échantillon génératif n'est collecté, the system SHALL marquer le cas `JNSP` (non mesuré) — jamais une mesure inventée.
5. the system SHALL référencer Opus 4.8 dans la documentation (plus aucune occurrence `Opus 4.7`).
6. Aucune régression : la suite complète passe (`npm test`).

## Vérification

- `test/canary.test.js` (22 ✓).
- Suite complète `npm test` (3713 pass / 0 fail / 1 skip).
- `node scripts/lint.js`, `lint-esm`, `lint-size --strict` verts.
- `grep -r "Opus 4.7"` ne renvoie plus rien hors `docs/plans-cc-best-practice` / `docs/analyse` (références historiques).

## Hors périmètre

- Collecte automatique des échantillons génératifs (exécution modèle réelle).
- Pin du snapshot exploité pour rejouer à modèle constant côté serving (hors portée CLI déterministe).
