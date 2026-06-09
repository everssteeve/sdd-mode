---
name: split
description: Découper une SPEC trop volumineuse en sous-SPECs atomiques
---

# SDD Mode — Découpage de SPEC

Tu es un Product Engineer AIAD. L'utilisateur veut découper une SPEC trop volumineuse ou non-atomique en sous-SPECs qui passent l'Execution Gate.

Une SPEC doit être **atomique** (1 SPEC = 1 PR = 1 tâche livrable). Quand l'Execution Gate échoue sur l'atomicité, ou > 200 lignes, ou > 2 relances agent, ou budget > 50K → découper.

**Recommandation modèle** : Sonnet 4.6 — découpage atomique, jugement de cohérence sémantique.

## Skills invoquées

- 🔧 [`sqs-scoring`](../skills/sqs-scoring/SKILL.md) — chaque sous-SPEC doit pouvoir passer la Gate indépendamment.

## Modes

- `--guided` : pas à pas
- `--fast` : livrable direct
- *(par défaut)* : auto-détection

## 🚀 Fast path

**Input** : SPEC-NNN à découper + raison (atomicité / taille / relances / budget).
**Output** : sous-SPECs (NNNa, NNNb…) + parent en statut `split` + ordre d'exécution.

1. Propose un pattern de découpage (A: couche / B: cas d'usage / C: dépendance / D: domaine).
2. Crée les sous-SPECs avec traçabilité vers parent et Intent.
3. Applique la skill `sqs-scoring` sur chaque sous-SPEC pour valider qu'elles peuvent passer la Gate indépendamment.
4. MAJ index + livre l'ordre d'exécution.

> ⚠ Si > 5 sous-SPECs : l'Intent est trop ambitieux → remonte à `/sdd intent`.

## 📖 Mode guidé

### Étape 0 — Recommandation modèle

Affiche : *"Sonnet 4.6 est suffisant pour découper une SPEC — pas besoin d'Opus 4.8 pour ce type de tâche."*

### Étape 1 — Diagnostiquer pourquoi découper

| Signal | Indice |
|--------|--------|
| SQS Atomicité = 0 | La Gate a rejeté |
| SPEC > 200 lignes | Trop de comportements |
| > 2 relances agent | Tâche trop complexe |
| Budget > 50K | Contexte excessif |
| Multiples fichiers indépendants | Domaines distincts |

### Étape 2 — Identifier l'axe de découpage

**Pattern A — Par couche technique**
```
SPEC-042 → 042a Backend (API/logique) · 042b Frontend (UI) · 042c Intégration
```

**Pattern B — Par cas d'usage**
```
SPEC-042 → 042a Happy path · 042b Edge cases · 042c Error handling
```

**Pattern C — Par dépendance**
```
SPEC-042 → 042a Setup/infra · 042b Logique principale (dép. a) · 042c Wiring (dép. a+b)
```

**Pattern D — Par domaine métier**
```
SPEC-042 → 042a Domaine A · 042b Domaine B · 042c Lien entre domaines
```

### Étape 3 — Valider le découpage

- [ ] Chaque sous-SPEC est livrable indépendamment (1 PR)
- [ ] Critères d'acceptation testables
- [ ] Ordre d'exécution clair
- [ ] Somme des sous-SPECs = 100 % de la parente
- [ ] Aucune sous-SPEC > 200 lignes

### Étape 4 — Générer les sous-SPECs

Format standard `/sdd spec` + métadonnées :

```markdown
**SPEC parent** : SPEC-NNN (découpée)
**Intent parent** : INTENT-NNN
**Ordre d'exécution** : X sur Y
**Dépendances intra-split** : SPEC-NNNa, SPEC-NNNb (le cas échéant)
```

### Étape 5 — Pré-Gate sur chaque sous-SPEC

Applique la skill `sqs-scoring` sur chaque sous-SPEC. Si une seule est en Gate FERMÉE → revoir le découpage.

### Étape 6 — Index + traçabilité

1. SPEC parente → statut `split` + liens vers sous-SPECs
2. `.aiad/specs/_index.md` → ajouter sous-SPECs, marquer parente `split`
3. Intent parent → MAJ section "SPECs liées"
4. Chaque sous-SPEC → prête pour `/sdd gate` individuel

### Étape 7 — Ordre d'exécution

```
1. SPEC-042a (pas de dép.) → /sdd gate → /sdd exec
2. SPEC-042b (dép. a)      → /sdd gate → /sdd exec
3. SPEC-042c (dép. a+b)    → /sdd gate → /sdd exec
```

## Règles

- Le découpage n'est PAS un échec — c'est un signe de maturité du PE.
- Chaque sous-SPEC doit pouvoir passer la Gate indépendamment.
- Pas de sous-SPEC "fourre-tout".
- > 5 sous-SPECs → remonter à `/sdd intent`.

$ARGUMENTS
