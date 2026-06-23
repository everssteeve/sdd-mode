---
id: RESEARCH-026
title: Trace EARS gap — earsSpecsSansTests dans compterGapsBloquants
intent: INTENT-019
author: Steeve Evers
date: 2026-06-23
verdict: GO
confidence: 95
status: decided
---

# RESEARCH-026 — Trace EARS gap

## Discovery

Ancré dans le code le 2026-06-23 via agent `Explore`.

- `lib/sdd-trace.js:251-297` — `lireSpecs()` : retourne `{ id, file, title, parentIntent, status, traceability, traceabilityReason }` — champ `format` absent, à ajouter (extraction via frontmatter `data.format` OU regex `/\*\*Format\*\*\s*:\s*EARS|^Format\s*:\s*EARS/m` sur le corps Markdown — même pattern que `test-skeleton-generator.js:9`)
- `lib/sdd-trace.js:470-498` — Maps existantes : `codeParSpec`, `testsParSpec`, `testsParPathCode` — double chemin de détection test lié (via `@spec` ET via `@verified-by` en code) déjà opérationnel
- `lib/sdd-trace.js:544-568` — Objet `gaps` construit ici : 7 gaps existants (`specsValideesNonImplementees`, `specsOrphelinsSurCode`, `intentsOrphelinsSurCode`, …) — `earsSpecsSansTests` s'insère au même niveau, filtre trivial (3 `.filter()` enchaînés)
- `lib/sdd-trace.js:655-670` — `rendreMarkdown()` : section "Gaps détectés" — ajout section `### EARS sans tests` après "Non-implémentés"
- `lib/sdd-trace.js:876-891` — Option `--suggest` : bloc existant pour SPECs orphelines — à compléter avec lignes `npx aiad-sdd suggest-tests <SPEC-id>` pour le nouveau gap
- `lib/sdd-trace.js:1065-1075` — `compterGapsBloquants()` : somme 3 gaps actuellement — `+ m.gaps.earsSpecsSansTests.length` s'ajoute en 1 ligne
- `bin/aiad-sdd.js:1142-1151` — CLI `trace` : `failOnGap` et `suggest` déjà câblés et passés à `trace()` — aucune modification CLI requise
- `test/trace.test.js:1-225` — Fixture `fixture()` : tmpdir + `.aiad/intents/` + `.aiad/specs/` + `src/` + `tests/` — pattern réutilisable directement pour `test/trace-ears-gap.test.js`

## Faisabilité

**Réalisable dans l'architecture actuelle.** L'ensemble de la logique s'insère dans `lib/sdd-trace.js` sans toucher au CLI ni aux autres modules.

Coût estimé : 4 points de modification dans un seul fichier + 1 fichier de tests à créer (6 CAs). La SPEC-019-2 est déjà rédigée et ses dépendances (SPEC-019-1 `suggest-tests`) sont livrées en `done`.

Alternatives : aucune — l'architecture n'a qu'un seul collecteur de traçabilité (`sdd-trace.js`).

## Risques & Inconnues

| # | Risque | Sévérité | Décision requise |
|---|--------|----------|-----------------|
| R1 | `lireSpecs()` ajoute un champ `format` — les consommateurs actuels ignorent les champs inconnus (structuration non-stricte) → **risque faible** | Faible | Non, extension safe |
| R2 | `trace.json` est soumis à un JSON schema versionné (`enveloperAvecMeta()`) — l'ajout de `earsSpecsSansTests` dans `gaps` doit être cohérent avec le schema publié | Moyen | À vérifier avant merge |
| R3 | SPEC-019-1 est `done` mais ses tests (`test/suggest-tests.test.js`) annotent `@spec SPEC-019-1-skeleton-generator` — ils seront couverts par le nouveau gap check, donc SPEC-019-1 ne doit PAS apparaître dans `earsSpecsSansTests` une fois cette SPEC implémentée (test de non-régression nécessaire) | Moyen | Non, géré par CA-003 |

Aucune inconnue exigeant une décision humaine préalable à la rédaction de la SPEC.

## Verdict

> **À trancher par l'humain :**
>
> Vu le Discovery et les risques ci-dessus, quel est ton verdict ?
> - **GO** : implémentation directe, pas d'inconnue bloquante.
> - **CONDITIONAL GO** : spécifier, mais préciser les conditions à lever (ex. vérification du JSON schema avant merge).
> - **DEFER** : reporter.
> - **NO-GO** : abandonner.
>
> Confiance (0-100 %) ?

## Verdict : GO (confidence: 95 %)
