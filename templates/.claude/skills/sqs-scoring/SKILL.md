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
| `?/5` (≥ 1 critère non scorable) | **INCONNUE** (fail-closed) | Décision humaine requise — voir « État JNSP » |

## Verdict d'exécution `CONDITIONAL` (§3.6 — pendant `/sdd exec`)

L'Execution Gate (ci-dessus) est binaire **avant** l'exécution : OUVERTE / FERMÉE / INCONNUE. **Pendant** l'exécution phasée, chaque tranche verticale est validée par un **mini-gate** qui, lui, expose un 3ᵉ verdict gradué :

| Verdict mini-gate | Sens | Exit |
|-------------------|------|------|
| `PASS` | Tranche livrée : tests présents, aucune dette | 0 |
| `CONDITIONAL` | Tranche acceptable avec **dette explicitée** (conditions non vides à lever avant la gate finale) | 0 |
| `FAIL` | Tranche bloquée, sans test (code horizontal) ou tests non livrés/rouges | 1 |
| `JNSP` | Tranche indécidable | 2 |

`UNKNOWN = VETO` reste : un critère non scorable force `JNSP`, **jamais** `CONDITIONAL`. Commande : `npx aiad-sdd mini-gate <SPEC-id> --phase N`. Le verdict est déterministe (`lib/mini-gate.js`), pas un jugement libre.

## État JNSP — critère non scorable

Un critère est `JNSP` (pas 0, pas 1, pas `?`) quand son scoring est
**indécidable** par l'agent dans le contexte courant :

| Critère | Déclencheur JNSP |
|---------|------------------|
| Complétude | Une section §1–§5 référence un fichier impossible à lire (permissions, dépendance absente). |
| Testabilité | SPEC référence une pile de test (Jest, Pytest, …) absente du repo — impossible de juger si critères sont vérifiables. |
| Atomicité | Intent parent illisible ou inexistant — pas de référence pour juger « 1 tâche atomique ». |
| Non-ambiguïté | Vocabulaire métier non défini dans AGENT-GUIDE et non explicité dans la SPEC. |
| Traçabilité | Annotations `@spec` du code en place pointent vers des SPECs absentes. |

**Règle** : si ≥ 1 critère est `JNSP`, le SQS sort en `?/5` et la Gate
en `INCONNUE` (jamais OUVERTE par défaut). Ne pas remplacer `JNSP` par
`0` pour faire avancer le merge — le score 0 = critère échoué pour cause
identifiée, `JNSP` = critère non scorable pour cause externe.

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
