# EXEC-SPEC-020-2 — Plan d'exécution phasé

> Exécution phasée (§3.6) — découpe la SPEC en **tranches verticales testables**.
> Interdiction de coder horizontalement : chaque tranche livre un incrément
> **et ses tests**. À la fin de chaque tranche : `npx aiad-sdd mini-gate SPEC-020-2 --phase N`.
>
> Marqueurs de statut : `[ ]` à faire · `[~]` en cours · `[x]` validé · `[!]` bloqué · `[-]` hors-scope.

**SPEC** : SPEC-020-2 — Redevabilité bidirectionnelle — FACT enrichi + signal constraint-violated
**Intent** : INTENT-020
**Mode phasé** : activé (proportionnalité : 3 tranches éditoriales)

---

## Phase 1 — Template FACT enrichi (`fact.md`)  [x]

- Objectif : Ajouter la section `## spec-patch-proposal` dans le template FACT de `/sdd fact`, avec note d'avertissement exacte + champs (section cible, changement proposé, classification delta, raison). Ajouter le type `conformite-spec` dans les types possibles.
- Fichiers : `.claude/sdd/fact.md`
- Tests : lecture du fichier — présence de `## spec-patch-proposal`, note `Proposition de l'agent — non appliquée`, champs `Classification delta` et `Raison`
- Done : CA-001 + CA-002 couverts
- Conditions :

## Phase 2 — Drift-detection : nouveau type + signal FACT ouvert  [x]

- Objectif : Ajouter dans la skill `drift-detection` le type `constraint-violated-without-fact` (niveau `WARN` par défaut) + le signal `[WARN] FACT-NNN : spec-patch-proposal ouvert sur SPEC-NNN-N — à statuer avant merge`.
- Fichiers : `.claude/skills/drift-detection/SKILL.md`
- Tests : lecture du fichier — présence de `constraint-violated-without-fact`, niveau `WARN`, signal verbatim `[WARN] FACT-NNN : spec-patch-proposal ouvert`
- Done : CA-003 + CA-004 couverts
- Conditions :

## Phase 3 — AGENT-GUIDE + clôture  [x]

- Objectif : Mentionner la redevabilité bidirectionnelle dans la section `## DRIFT LOCK` de l'AGENT-GUIDE (cross-ref SPEC-020-2). Passer la SPEC-020-2 en `done` dans `_index.md`.
- Fichiers : `.aiad/AGENT-GUIDE.md`, `.aiad/specs/_index.md`, `.aiad/specs/SPEC-020-2-redevabilite-bidirectionnelle.md`
- Tests : lecture AGENT-GUIDE — présence `SPEC-020-2` dans § DRIFT LOCK. Lecture `_index.md` — SPEC-020-2 → `done`.
- Done : DoOD §7 complet + `npx aiad-sdd trace --fail-on-gap` exit 0 (ou exemption tracée)
- Conditions :
