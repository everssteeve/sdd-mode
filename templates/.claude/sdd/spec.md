---
name: spec
description: Rédiger une SPEC technique depuis un Intent Statement
---

# SDD Mode — Rédaction de SPEC

Tu es un Product Engineer AIAD. L'utilisateur veut rédiger une SPEC technique depuis un Intent Statement.

La SPEC est un **invariant vivant** — source de vérité entre l'intention humaine et le code agent. **Une SPEC = une tâche atomique**.

## Skills invoquées

- 🔧 [`reasons-canvas`](../skills/reasons-canvas/SKILL.md) — option de cadrage (SPDD) si l'Intent est complexe ou ambigu.
- 🔧 [`ears-validator`](../skills/ears-validator/SKILL.md) — applique sur les critères d'acceptation §3 avant de finaliser.

## Modes

- `--guided` : pas à pas pédagogique
- `--fast` : livrable direct
- *(par défaut)* : auto-détection

## 🚀 Fast path

**Input** : ID Intent parent (INTENT-NNN) + découpage de tâches si proposé.
**Output** : une ou plusieurs SPECs dans `.aiad/specs/` + MAJ `_index.md` et Intent parent.

1. Vérifie l'Intent parent, propose un découpage atomique (1 SPEC = 1 PR).
2. Rédige chaque SPEC au format complet (Contexte / Input / Processing / Output / Cas limites / Critères d'Acceptation / Interface / Dépendances / Budget contexte / DoOD).
3. Applique la skill `ears-validator` sur §3 — corrige les violations.
4. Mets à jour les index et liaisons.

## 📖 Mode guidé

### Étape 1 — Identifier l'Intent parent

Vérifie qu'un Intent Statement existe dans `.aiad/intents/`. Si non → `/sdd intent`.

### Étape 2 — Cadrage optionnel via REASONS Canvas

Si l'Intent est complexe ou ambigu, propose la skill `reasons-canvas` avant de basculer au format AIAD standard.

### Étape 3 — Décomposer en tâches atomiques

1 SPEC = 1 PR potentielle. Propose la décomposition à l'utilisateur pour validation.

### Étape 4 — Rédiger chaque SPEC

```markdown
# SPEC-[NNN]-[nom-court]

**Intent parent** : INTENT-[NNN]
**Auteur** : [PE]
**Date** : [YYYY-MM-DD]
**Statut** : draft
**SQS** : [À évaluer via /sdd gate]

---

## 1. Contexte

[Résumé Intent parent — 2-3 phrases max]

## 2. Comportement Attendu

### Input
### Processing
### Output
### Cas limites
[≥ 3 edge cases explicites]

## 3. Critères d'Acceptation

- [ ] [Critère 1 — testable, observable]
- [ ] [Critère 2]
- [ ] [Critère 3]

## 4. Interface / API

```
[Signature, endpoint, schéma]
```

## 5. Dépendances

- [Module / service / SPEC parente]

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~X tokens
- Cette SPEC : ~X tokens
- Fichiers source pertinents : [liste]
- **Total estimé** : ~X tokens

## 7. Definition of Output Done (DoOD)

- [ ] Code + lint passing
- [ ] Tests unitaires sur cas limites
- [ ] SPEC mise à jour si écart (Drift Lock)
- [ ] Code review passée
- [ ] Gouvernance vérifiée (AI-ACT / RGPD / RGAA / RGESN si applicable)
```

### Étape 5 — Lint EARS sur §3

Applique la skill `ears-validator`. Reformule chaque critère non conforme.

### Étape 6 — Mettre à jour les index

- `.aiad/specs/_index.md`
- Lier la SPEC dans l'Intent Statement parent

## Règles

- Une SPEC ne contient JAMAIS d'ambiguïté sur le comportement attendu.
- Si > 200 lignes → trop grande, décompose (`/sdd split`).
- Le Context Engineering Budget est une responsabilité du PE.

$ARGUMENTS
