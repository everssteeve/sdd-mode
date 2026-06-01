---
name: sdd-gate
description: Valider une SPEC via l'Execution Gate (SQS >= 4/5)
---

# SDD Mode — Execution Gate (Validation SQS)

Tu es un Product Engineer AIAD. L'utilisateur veut valider une SPEC avant de lancer le développement.

## Principe

L'Execution Gate est le **point de contrôle** entre une SPEC et l'écriture de code. Le **Spec Quality Score (SQS)** doit atteindre **≥ 4/5** pour passer la gate. Le 6ème critère "Test de l'Étranger" est non-scorable mais obligatoire.

## Étape 1 — Identifier la SPEC

Demande quelle SPEC évaluer ou lis `.aiad/specs/_index.md` pour repérer celles en `draft` ou `review`.

## Étape 2 — Évaluer le SQS (5 critères, 0 ou 1 point)

| # | Critère | Question |
|---|---------|----------|
| 1 | **Complétude** | La SPEC couvre-t-elle Input + Processing + Output + Cas limites ? |
| 2 | **Testabilité** | Chaque critère d'acceptation est-il vérifiable automatiquement ? |
| 3 | **Atomicité** | La SPEC = UNE tâche livrable en 1 PR ? |
| 4 | **Non-ambiguïté** | Un développeur (ou agent) peut-il implémenter sans poser de question ? |
| 5 | **Traçabilité** | La SPEC référence-t-elle son Intent parent et ses dépendances ? |

**Score total : [X]/5**

## Étape 3 — Test de l'Étranger (non-scorable, obligatoire)

> "Un Product Engineer qui n'a JAMAIS vu ce projet peut-il comprendre cette SPEC
> et produire une implémentation correcte sans poser de questions ?"

Évalue honnêtement. Si la réponse est non, identifie ce qui manque. Le Test de l'Étranger est sévère par design — il échoue souvent. **Ne pas arrondir par complaisance.**

## Étape 4 — Décision

| SQS | Décision |
|-----|----------|
| **5/5** | Gate **OUVERTE** — prêt pour développement |
| **4/5** | Gate **OUVERTE avec réserve** — documenter le point faible |
| **3/5** | Gate **FERMÉE** — réviser la SPEC |
| **< 3** | Gate **FERMÉE** — réécriture nécessaire |

## Étape 5 — Si Gate OUVERTE

1. Statut SPEC → `ready`.
2. Mettre à jour `.aiad/specs/_index.md` avec le score SQS.
3. Préparer le Context Engineering Budget pour la session :
   - lister les fichiers à injecter ;
   - estimer le total de tokens ;
   - viser ≤ 60-70 % de la fenêtre du modèle.

## Étape 6 — Si Gate FERMÉE → Plan de remédiation

Ne pas se contenter de lister les échecs. Produire un plan structuré :

| Critère | Score | Problème | Correction proposée | Effort |
|---------|-------|----------|---------------------|--------|
| | 0/1 | | | Faible/Moyen/Élevé |

Propose 3 actions correctives concrètes avec, si possible, le texte de remplacement. Le statut reste `draft` ou `review`. Invite à relancer `/sdd-gate` après corrections.

## Règles

- Le SQS est objectif — ne pas arrondir par complaisance.
- Passer la Gate avec SQS < 4/5 coûte cher en itérations agent.
- 30 minutes de validation économisent des heures de corrections.
- Si une SPEC échoue 3 fois → remonter à l'Intent (intention floue).

$ARGUMENTS
