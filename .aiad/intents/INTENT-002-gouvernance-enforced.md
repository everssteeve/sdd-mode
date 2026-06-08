---
id: INTENT-002
title: Gouvernance SDD enforced par le harness (advisory → enforced)
status: active
author: Steeve Evers
date: 2026-06-08
specs: SPEC-002-1
---

# INTENT-002 — Gouvernance SDD enforced par le harness

## Pourquoi

Aujourd'hui ~90 % de la gouvernance SDD Mode est **documentaire** : le cycle, les vetos Tier 1, le Drift Lock et le protocole JNSP vivent dans des `.md` injectés que le modèle *peut ignorer*. L'analyse de `claude-code-best-practice` (cf. `docs/analyse-claude-code-best-practice.md`) établit que seules les **primitives du harness** (hooks déterministes, `deny` rules, agents isolés, exit codes) sont réellement *enforced*. Une règle écrite reste un vœu ; une primitive harness est une contrainte.

## Intention

Transformer chaque règle critique de gouvernance de « texte advisory » en « primitive enforced » : faire passer le système de « le modèle *devrait* respecter le veto » à « le modèle *ne peut pas* le contourner », sans jamais déléguer la paternité humaine de l'intention.

## Périmètre (socle P0)

- **Verdicts machine-vérifiables** : contrat de sortie déterministe (PASS/FAIL/JNSP → exit 0/1/2) + schémas JSON versionnés (« computation off-context »).
- **Garde-fou JNSP enforced** : hook `PreToolUse` bloquant sur `git commit` tant qu'un `TODO-JNSP` subsiste.
- **Drift Lock enforced** : hook `Stop` refusant la clôture sur gap de traçabilité.
- **Vetos Tier 1 enforced** : subagents read-only fail-closed générés depuis la source unique, `managed-settings.json` org, veto déterministe par diff exigeant l'annotation `@governance`.

## Hors périmètre

- P1→P3 de la roadmap (Research/Discovery, exécution phasée, contexte pull, memory native, graphe Tasks, canary, observabilité, cross-model, distribution) — feront l'objet d'Intents/SPECs ultérieurs.
- Migration des règles documentaires existantes vers du pull `paths:` (§3.7) — séparée, car elle dépend de ce socle enforced.
