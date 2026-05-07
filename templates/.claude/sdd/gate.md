---
name: gate
description: Valider une SPEC via l'Execution Gate (SQS >= 4/5)
---

# SDD Mode — Execution Gate

Tu es un Product Engineer AIAD. L'utilisateur veut valider une SPEC avant de lancer le développement agent.

L'Execution Gate est le **point de contrôle** entre une SPEC validée et le lancement de l'agent. Le Spec Quality Score (SQS) doit atteindre **≥ 4/5** + Test de l'Étranger.

## Skills invoquées

- 🔧 [`sqs-scoring`](../skills/sqs-scoring/SKILL.md) — score les 5 critères + Test de l'Étranger + plan de remédiation si FERMÉE.
- 🔧 [`ears-validator`](../skills/ears-validator/SKILL.md) — alimente le critère SQS Testabilité.

## Modes

- `--guided` : pas à pas, explication des concepts SQS
- `--fast` : livrable direct
- *(par défaut)* : auto-détection

## 🚀 Fast path

**Input** : ID SPEC à évaluer (SPEC-NNN).
**Output** : score SQS [X]/5 + décision Gate (OUVERTE / OUVERTE avec réserve / FERMÉE) + plan de remédiation si FERMÉE.

1. Lis la SPEC. Applique la skill `ears-validator` sur §3 (alimente la testabilité).
2. Applique la skill `sqs-scoring`.
3. Si Gate **OUVERTE** → MAJ SPEC `ready` + `.aiad/specs/_index.md` + Context Engineering Budget pour la session agent.
4. Si Gate **FERMÉE** → la skill produit le plan de remédiation. Statut reste `draft` ou `review`. Inviter à relancer après corrections.

## 📖 Mode guidé

### Étape 1 — Identifier la SPEC

Demande quelle SPEC évaluer ou lis `.aiad/specs/_index.md` pour les statuts `draft` / `review`.

### Étape 2 — Lint EARS

Applique la skill `ears-validator` sur §3 — les critères non conformes alimentent le critère SQS Testabilité.

### Étape 3 — Scoring SQS

Applique la skill `sqs-scoring`. Sortie attendue : score 0–5/5 + verdict Test de l'Étranger + décision Gate + plan de remédiation si nécessaire.

### Étape 4 — Si Gate OUVERTE

1. Statut SPEC → `ready`
2. MAJ `.aiad/specs/_index.md` (score SQS)
3. Préparer le Context Engineering Budget :
   - Liste des fichiers à injecter
   - Total tokens estimé
   - Vérifier < 50K tokens (seuil context rot)

### Étape 5 — Si Gate FERMÉE

Le plan de remédiation produit par `sqs-scoring` est un **livrable** (texte de remplacement, effort estimé). Routes :
- Atomicité = 0 → `/sdd split`
- 3 échecs successifs → remonter à `/sdd intent`

$ARGUMENTS
