---
name: sqs-scoring
description: Use when evaluating a SPEC's quality (Spec Quality Score). Scores the 5 SQS criteria + Test de l'Étranger and decides whether the Execution Gate opens (SQS ≥ 4/5). Triggered by /sdd gate, /sdd split, /sdd exec prerequisite check.
---

# Skill — SQS Scoring (Spec Quality Score)

> L'Execution Gate sépare une SPEC validée d'une session agent.
> Cette skill applique le scoring SQS de manière homogène et reproductible — sans complaisance.

## Quand l'utiliser

- Avant de lancer un agent (`/sdd gate`)
- Sur chaque sous-SPEC après découpage (`/sdd split`)
- En vérification rapide avant `/sdd exec`
- En pré-merge pour valider la SPEC ↔ code

## Critères scorables (0 ou 1 — total /5)

| # | Critère | Question |
|---|---------|----------|
| 1 | **Complétude** | La SPEC couvre-t-elle Input, Processing, Output ET cas limites (≥ 3) ? |
| 2 | **Testabilité** | Chaque critère d'acceptation est-il vérifiable automatiquement ? |
| 3 | **Atomicité** | La SPEC = 1 PR livrable (≤ 200 lignes, scope unique) ? |
| 4 | **Non-ambiguïté** | Un dev / agent peut-il implémenter sans poser de question ? |
| 5 | **Traçabilité** | Intent parent + dépendances explicitement référencés ? |

### Modulation EARS du critère 2 (Testabilité)

Si la SPEC déclare `Format : EARS` (cf. skill `ears-validator` mode strict), le score critère 2 est dérivé du linter :

| Résultat linter EARS strict | Critère 2 |
|---|---|
| 0 violation R1–R7 sur tous les critères §3 | **1/1** (bonus +1 garanti — critères EARS conformes = testables par construction) |
| ≥ 1 violation | **0/1** forcé (peu importe l'apparence, EARS non conforme = testabilité non garantie) |

En format `prose` (mode indicatif), le critère 2 reste évalué selon la rubrique standard.

## Test de l'Étranger (non scorable, OBLIGATOIRE)

> "Un Product Engineer qui n'a JAMAIS vu ce projet peut-il comprendre cette SPEC
> et produire une implémentation correcte sans poser de questions ?"

PASS / FAIL — sévère par design, échoue souvent.

## Décision

| SQS | Décision Gate | Action |
|-----|--------------|--------|
| 5/5 + Étranger PASS | **OUVERTE** | Prêt pour `/sdd exec` |
| 4/5 + Étranger PASS | **OUVERTE avec réserve** | Documenter point faible |
| 3/5 OU Étranger FAIL | **FERMÉE** | Plan de remédiation |
| ≤ 2/5 | **FERMÉE** | Réécriture complète |

## Output

```
SQS — SPEC-NNN
══════════════
1. Complétude     : 0/1 — <justification>
2. Testabilité    : 0/1 — <justification>
3. Atomicité      : 0/1 — <justification>
4. Non-ambiguïté  : 0/1 — <justification>
5. Traçabilité    : 0/1 — <justification>
─────────────────
Total             : X/5

Test de l'Étranger : PASS / FAIL — <justification>

Décision : Gate OUVERTE / OUVERTE avec réserve / FERMÉE
```

### Si FERMÉE → plan de remédiation (livrable, pas commentaire)

| Critère | Score | Problème identifié | Correction proposée | Effort |
|---------|-------|--------------------|---------------------|--------|
| [...]   | 0/1   | [...]              | [reformulation]     | F/M/É |

**Actions concrètes** :
1. [action avec texte de remplacement si possible]
2. ...

**Routes de secours** :
- Atomicité = 0 → proposer `/sdd split`
- Complétude = 0 → indiquer sections manquantes (Input/Processing/Output/Cas limites)
- Testabilité = 0 → reformuler critères en assertions vérifiables (cf. skill `ears-validator`)
- 3 échecs successifs → remonter à `/sdd intent` (l'intention est floue)

## Règles

- Le SQS est **objectif** — ne pas arrondir par complaisance.
- Le Test de l'Étranger échoue souvent par design : c'est normal.
- Une Gate forcée avec SQS < 4/5 coûte cher en itérations agent.
- 30 min de validation économisent des heures de corrections.
