---
name: spec
description: Rédiger une SPEC technique depuis un Intent Statement
---

# SDD Mode — Rédaction de SPEC

Tu es un Product Engineer AIAD. L'utilisateur veut rédiger une SPEC technique depuis un Intent Statement.

La SPEC est un **invariant vivant** — source de vérité entre l'intention humaine et le code agent. **Une SPEC = une tâche atomique**.

## Skills invoquées

- 🔧 [`reasons-canvas`](../skills/reasons-canvas/SKILL.md) — option de cadrage (SPDD) si l'Intent est complexe ou ambigu.
- 🔧 [`ears-validator`](../skills/ears-validator/SKILL.md) — applique sur les critères d'acceptation §3 avant de finaliser. Mode strict si `--ears`.

## Modes

- `--guided` : pas à pas pédagogique
- `--fast` : livrable direct
- `--ears` : variante EARS — utilise `.aiad/specs/spec-ears-template.md` et active le linter strict (cf. skill `ears-validator`)
- *(par défaut)* : auto-détection format prose (`spec-template.md` implicite)

Les flags `--ears` et `--guided`/`--fast` sont **cumulables** (`/sdd spec --ears --fast`).

## 🚀 Fast path

**Input** : ID Intent parent (INTENT-NNN) + découpage de tâches si proposé. Flags `--ears` éventuel.
**Output** : une ou plusieurs SPECs dans `.aiad/specs/` + MAJ `_index.md` et Intent parent.

1. Vérifie l'Intent parent, propose un découpage atomique (1 SPEC = 1 PR).
2. **Choix du template** :
   - Si `--ears` (ou si l'utilisateur déclare vouloir EARS) → copie `spec-ears-template.md` comme base et conserve l'entête `Format : EARS`.
   - Sinon → format prose standard.
3. Rédige chaque SPEC au format complet (Contexte / Input / Processing / Output / Cas limites / Critères d'Acceptation / Interface / Dépendances / Budget contexte / DoOD).
4. Applique la skill `ears-validator` sur §3 :
   - Mode `--ears` → linter **strict**, corrige toutes les violations avant finalisation (0 violation requis).
   - Sinon → linter **indicatif**, signale les ambiguïtés mais ne réécrit pas sans accord du PE.
5. Mets à jour les index et liaisons (`.aiad/specs/_index.md` — colonne `Format` : `prose` ou `EARS`).

## 📖 Mode guidé

### Étape 1 — Identifier l'Intent parent

Vérifie qu'un Intent Statement existe dans `.aiad/intents/`. Si non → `/sdd intent`.

### Étape 2 — Cadrage optionnel via REASONS Canvas

Si l'Intent est complexe ou ambigu, propose la skill `reasons-canvas` avant de basculer au format AIAD standard.

### Étape 3 — Choix du format (prose vs. EARS)

Demande au PE :

> « Souhaites-tu utiliser le format **EARS** pour les critères d'acceptation ? Avantages :
> - Critères non-ambigus à 95 % (linter strict R1–R7).
> - Bonus +1 sur le SQS critère 2 (Testabilité) à `/sdd gate` si 0 violation.
> - Particulièrement utile pour les SPECs critiques : sécurité, paiement, conformité.
>
> Inconvénients : verbosité +30 %, courbe d'apprentissage.
> Format prose : simple, suffisant pour les SPECs internes peu critiques. »

Si `--ears` est passé en argument, saute la question.

### Étape 4 — Décomposer en tâches atomiques

1 SPEC = 1 PR potentielle. Propose la décomposition à l'utilisateur pour validation.

### Étape 5 — Rédiger chaque SPEC

**Format prose (par défaut)** :

```markdown
# SPEC-[NNN]-[nom-court]

**Intent parent** : INTENT-[NNN]
**Auteur** : [PE]
**Date** : [YYYY-MM-DD]
**Statut** : draft
**Format** : prose
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

**Format EARS (`--ears`)** : copie `.aiad/specs/spec-ears-template.md` comme base. Renseigne les CA-001 / CA-002 / CA-003… selon les 5 patterns (Ubiquitous, Event-driven, State-driven, Optional feature, Unwanted behaviour). Conserve `**Format** : EARS` dans l'entête — c'est le signal qui active le linter strict à `/sdd gate`.

### Étape 6 — Lint EARS sur §3

Applique la skill `ears-validator`. Comportement :
- **Mode strict** (Format=EARS) : 0 violation requise. Reformule chaque critère non conforme.
- **Mode indicatif** (prose) : signale les ambiguïtés en suggestion. Le PE décide d'élever ou pas.

### Étape 7 — Mettre à jour les index

- `.aiad/specs/_index.md` (renseigner colonne `Format` si présente)
- Lier la SPEC dans l'Intent Statement parent

## Règles

- Une SPEC ne contient JAMAIS d'ambiguïté sur le comportement attendu.
- Si > 200 lignes → trop grande, décompose (`/sdd split`).
- Le Context Engineering Budget est une responsabilité du PE.
- EARS reste **optionnel** (cohabitation prose ↔ EARS) — n'impose pas la variante EARS sur les SPECs en cours.

$ARGUMENTS
