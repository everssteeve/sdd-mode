---
id: SPEC-003-1
title: Phase Research GO/NO-GO + prérequis Discovery enforced (§3.5 SPEC-A + SPEC-B)
parent_intent: INTENT-003
status: done
format: prose
sqs: 4.4
author: Steeve Evers
date: 2026-06-08
---

# SPEC-003-1 — Phase Research GO/NO-GO + prérequis Discovery

**Intent parent** : INTENT-003
**SQS** : 4.4 / 5
**Statut** : in-progress

## Objectif

Ajouter une phase Research entre l'Intent et la SPEC qui valide la **viabilité de l'intention** ancrée dans le code (Discovery obligatoire), produit un verdict gradué tranché par l'humain, et conditionne le passage en SPEC/exécution.

## Implémentation

- **Cœur déterministe** : `lib/research.js` — parse l'artefact, calcule un verdict gradué `GO | CONDITIONAL GO | DEFER | NO-GO` mappé sur le contrat canonique (`lib/verdict.js`), helper de prérequis `discoveryPrete()`.
- **CLI** : `aiad-sdd research <id>` (gate) + `aiad-sdd discovery-check [INTENT-NNN]` (prérequis) dans `bin/aiad-sdd.js`, exit 0/1/2.
- **Schémas** : `.aiad/schema/verdicts/research.schema.json` + `discovery.schema.json`.
- **Commande** : `templates/.claude/sdd/research.md` (dual-mode, Discovery délégué à un agent `Explore`), enregistrée dans le routeur `templates/.claude/commands/sdd.md`.
- **Artefacts** : `templates/.aiad/research-template.md` + `.aiad/research/_index.md` ; dossier créé par `lib/init.js`.
- **Enforcement** : hook `UserPromptSubmit` `.aiad/hooks/discovery-gate.js` (self-contained, shell-out CLI) ; prérequis écrit dans `templates/.claude/sdd/{spec,exec}.md` ; enregistré dans `templates/.claude/settings.json`.
- **Cycle documenté** : `lib/emit-rules.js` (×4) + `CLAUDE.md` + `templates/CLAUDE.md` → `Intent → Research (GO/NO-GO) → SPEC → Gate → … → Drift Lock`.

## Critères d'acceptation

1. `aiad-sdd research <id> --output-format verdict` émet une enveloppe avec `verdict ∈ {PASS, CONDITIONAL, FAIL, JNSP}` et la décision graduée (`GO/CONDITIONAL GO/DEFER/NO-GO`) + confidence, exit 0/0/1/2.
2. Discovery non ancré dans le code (`chemin:ligne` / `evidence:`) → `JNSP` (fail-closed, anti specs-to-code).
3. `TODO-JNSP` ouvert ou verdict humain absent → `JNSP` (Human Authorship : l'agent ne fabrique jamais le GO/NO-GO).
4. `GO` déclaré avec inconnues non levées → durci en `CONDITIONAL GO` ; un `CONDITIONAL GO` exige des conditions non vides.
5. `aiad-sdd discovery-check <INTENT-NNN>` renvoie `PASS` (0) si une Research liée GO/CONDITIONAL GO avec Discovery ancré existe, `FAIL` (1) sur DEFER/NO-GO, `JNSP` (2) sinon.
6. Le hook `UserPromptSubmit` injecte un rappel `additionalContext` sur `/sdd spec|exec` ; mode strict opt-in `AIAD_DISCOVERY_STRICT=1` → `decision: block` ; bypass `AIAD_HOOK_SILENT=1`.
7. `init` crée le dossier `.aiad/research/`, copie le template, le hook, la commande et l'enregistrement `settings.json`.
8. Le cycle documenté inclut la phase Research dans tous les runtimes générés.
9. Aucune régression : la suite complète passe (`npm test`).

## Vérification

- `test/research.test.js` (20 ✓) + `test/discovery-gate.test.js` (10 ✓).
- Suite complète `npm test` (3662 pass / 0 fail / 1 skip).
- `node scripts/lint.js`, `lint-esm`, `lint-size --strict` verts ; `docs --check` synchronisé.

## Hors périmètre

- Résolution multi-Research par Intent (plusieurs Research concurrentes pour un même Intent) — la première liée prête fait foi.
- Obligation dure universelle — la Research reste proportionnée (court-circuit tracé admis).
