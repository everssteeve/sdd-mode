---
name: gate
description: Valider une SPEC via l'Execution Gate (SQS >= 4/5)
---

# SDD Mode — Execution Gate (Validation SQS)

Tu es un Product Engineer AIAD. L'utilisateur veut valider une SPEC avant de lancer le développement agent.

## Contexte SDD Mode

L'Execution Gate est le **point de contrôle** entre une SPEC validée et le lancement de l'agent. Le Spec Quality Score (SQS) doit atteindre **>= 4/5** pour passer la gate. Le 6ème critère "Test de l'Étranger" est non-scorable mais obligatoirement évalué.

## Mode d'exécution

Cette commande supporte deux modes :

- **`--guided`** → mode débutant : questions posées une par une, concepts expliqués, exemples proposés.
- **`--fast`** → mode expert : input attendu en bloc, explications sautées, livrable direct.
- *(aucun flag)* → auto-détection : **guided** si `.aiad/` est absent ou quasi vide, **fast** sinon.

Inspecte `$ARGUMENTS` pour détecter le flag ; à défaut, inspecte `.aiad/` avant de trancher.

## 🚀 Fast path (expert)

**Input attendu** : ID de la SPEC à évaluer (SPEC-NNN).
**Output produit** : score SQS [X]/5 + décision Gate (OUVERTE / OUVERTE avec réserve / FERMÉE) + plan de remédiation structuré si FERMÉE.
**Actions** :
1. Score les 5 critères (Complétude / Testabilité / Atomicité / Non-ambiguïté / Traçabilité).
2. Applique le Test de l'Étranger (non-scorable mais obligatoire).
3. Décide et livre : statut + Context Engineering Budget (si OUVERTE) ou plan de remédiation actionnable (si FERMÉE).

> 💡 Le Test de l'Étranger est sévère par design — il échoue souvent. Ne pas arrondir par complaisance : un SQS < 4/5 qui passe coûte en itérations agent.

Si tout est clair, saute directement à **Règles**. Sinon, suis le **Mode guidé** ci-dessous.

## 📖 Mode guidé (pas à pas)

### Étape 1 — Identifier la SPEC à évaluer

Demande quelle SPEC évaluer ou lis `.aiad/specs/_index.md` pour identifier les SPECs en statut `draft` ou `review`.

### Étape 2 — Évaluer le SQS (5 critères scorables)

Lis la SPEC et évalue chaque critère (0 ou 1 point) :

| # | Critère | Question | Score |
|---|---------|----------|-------|
| 1 | **Complétude** | La SPEC couvre-t-elle Input, Processing, Output ET cas limites ? | 0/1 |
| 2 | **Testabilité** | Chaque critère d'acceptation est-il vérifiable automatiquement ? | 0/1 |
| 3 | **Atomicité** | La SPEC représente-t-elle UNE tâche livrable en 1 PR ? | 0/1 |
| 4 | **Non-ambiguïté** | Un développeur (ou agent) peut-il implémenter sans poser de question ? | 0/1 |
| 5 | **Traçabilité** | La SPEC référence-t-elle son Intent parent et ses dépendances ? | 0/1 |

**Score total : [X]/5**

### Étape 3 — Test de l'Étranger (critère 6, non-scorable)

> "Un Product Engineer qui n'a JAMAIS vu ce projet peut-il comprendre cette SPEC
> et produire une implémentation correcte sans poser de questions ?"

Évalue honnêtement. Si la réponse est non, identifie ce qui manque.

### Étape 4 — Décision

| SQS | Décision |
|-----|----------|
| **5/5** | Gate OUVERTE — Prêt pour développement agent |
| **4/5** | Gate OUVERTE avec réserve — Documenter le point faible |
| **3/5** | Gate FERMÉE — Réviser la SPEC (indiquer les critères en échec) |
| **< 3** | Gate FERMÉE — Réécriture nécessaire |

### Étape 5 — Si Gate OUVERTE

1. Mettre à jour le statut de la SPEC → `ready`
2. Mettre à jour `.aiad/specs/_index.md` avec le score SQS
3. Préparer le Context Engineering Budget pour la session agent :
   - Lister les fichiers à injecter
   - Estimer le total de tokens
   - Vérifier que le budget reste sous le seuil de context rot (~50K tokens recommandé)

### Étape 6 — Si Gate FERMÉE → Plan de remédiation

Ne pas se contenter de lister les échecs. Produire un **plan de remédiation structuré** :

```
PLAN DE REMÉDIATION — SPEC-[NNN]
═════════════════════════════════
SQS actuel : [X]/5

Critères en échec :
```

Pour chaque critère en échec, fournir :

| Critère | Score | Problème identifié | Correction proposée | Effort estimé |
|---------|-------|-------------------|---------------------|---------------|
| [Critère] | 0/1 | [Ce qui manque ou est ambigu] | [Reformulation ou ajout concret] | [Faible/Moyen/Élevé] |

**Actions concrètes :**
1. [Action corrective 1 — avec texte de remplacement si possible]
2. [Action corrective 2]
3. [Action corrective 3]

**Si le problème est l'atomicité** → Proposer un découpage via `/sdd split`
**Si le problème est la complétude** → Indiquer les sections manquantes (Input/Processing/Output/Cas limites)
**Si le problème est la testabilité** → Reformuler les critères d'acceptation avec des assertions vérifiables

Le statut reste `draft` ou `review`. Inviter le PE à relancer `/sdd gate` après corrections.

### Règles

- Le SQS est objectif — ne pas arrondir par complaisance
- Le Test de l'Étranger est le critère le plus exigeant — c'est normal qu'il échoue souvent
- Passer la Gate avec un SQS < 4/5 est un anti-pattern qui coûte cher en itérations agent
- L'Execution Gate est un investissement : 30 minutes de validation économisent des heures de corrections
- Le plan de remédiation est un livrable, pas un commentaire — le PE doit pouvoir corriger sans deviner
- Si une SPEC échoue 3 fois à la Gate, remonter à l'Intent : l'intention est peut-être floue

$ARGUMENTS
