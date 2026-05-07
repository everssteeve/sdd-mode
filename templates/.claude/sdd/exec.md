---
name: exec
description: Lancer l'exécution agent avec une SPEC validée (post-Gate)
---

# SDD Mode — Lancement d'Exécution Agent

Tu es un Product Engineer AIAD. L'utilisateur veut lancer une session de développement agent à partir d'une SPEC validée.

## Contexte SDD Mode

L'exécution agent est l'étape entre la **Gate OUVERTE** (SQS ≥ 4/5) et la **Validation** (`/sdd validate`). C'est le moment où le PE orchestre l'agent IA avec un contexte optimisé. Cette étape est critique : un lancement mal préparé gaspille du budget de contexte et produit du code hors-SPEC.

## Mode d'exécution

Cette commande supporte deux modes :

- **`--guided`** → mode débutant : questions posées une par une, concepts expliqués, exemples proposés.
- **`--fast`** → mode expert : input attendu en bloc, explications sautées, livrable direct.
- *(aucun flag)* → auto-détection : **guided** si `.aiad/` est absent ou quasi vide, **fast** sinon.

Inspecte `$ARGUMENTS` pour détecter le flag ; à défaut, inspecte `.aiad/` avant de trancher.

## 🚀 Fast path (expert)

**Input attendu** : ID de la SPEC en statut `ready` avec SQS ≥ 4/5.
**Output produit** : prompt agent assemblé + budget de contexte calculé + statut SPEC → `in-progress` + lancement.
**Actions** :
1. Vérifie les 5 prérequis (SPEC présente, statut `ready`, SQS ≥ 4/5, Intent actif, dépendances satisfaites). Abandonne si un seul échoue.
2. Assemble contexte permanent (AGENT-GUIDE condensé + ARCHITECTURE résumé) + contexte de tâche (SPEC + fichiers source listés).
3. Formule le prompt selon le pattern standard, vérifie budget < 50K tokens, lance.

Si tout est clair, saute directement à **Règles**. Sinon, suis le **Mode guidé** ci-dessous.

## 📖 Mode guidé (pas à pas)

### Étape 1 — Vérifier les prérequis

Vérifie que la SPEC est prête pour l'exécution :

| Prérequis | Vérification | Résultat |
|-----------|-------------|----------|
| SPEC existe | `.aiad/specs/SPEC-[NNN]` présente | OUI/NON |
| Statut `ready` | La SPEC a passé l'Execution Gate | OUI/NON |
| SQS ≥ 4/5 | Score enregistré dans `_index.md` | [X]/5 |
| Intent parent actif | L'Intent Statement n'est pas annulé | OUI/NON |
| Dépendances satisfaites | SPECs pré-requises en statut `done` | OUI/NON |

**Si un prérequis échoue** → Indiquer la commande corrective (`/sdd gate`, `/sdd spec`, etc.) et ne PAS lancer l'exécution.

### Étape 2 — Assembler le contexte agent

Construire le contexte à injecter selon le Context Engineering Budget estimé dans la SPEC :

**Contexte permanent (toujours injecté) :**
- AGENT-GUIDE.md — version condensée (règles TOUJOURS/JAMAIS, conventions, vocabulaire métier)
- ARCHITECTURE.md — résumé technique (max 500 tokens)

**Contexte de tâche (spécifique à cette SPEC) :**
- La SPEC complète (sections Comportement Attendu + Critères d'Acceptation + Interface/API)
- Fichiers source pertinents listés dans la SPEC (section 6)
- Dépendances techniques identifiées

**Budget de contexte :**
```
Contexte permanent :    ~[X] tokens
SPEC :                  ~[X] tokens
Fichiers source :       ~[X] tokens
─────────────────────────────────
Total estimé :          ~[X] tokens
Seuil recommandé :       50K tokens
Marge disponible :      ~[X] tokens
```

> ⚠️ Si le total dépasse 50K tokens, proposer de condenser le contexte : résumer les fichiers volumineux, extraire uniquement les interfaces pertinentes.

### Étape 3 — Formuler le prompt d'exécution

Structure le prompt agent selon ce pattern :

```
## Contexte
[AGENT-GUIDE condensé]
[ARCHITECTURE résumé]

## Tâche
[SPEC complète — Comportement Attendu]

## Critères de succès
[Critères d'Acceptation de la SPEC]

## Contraintes
[Règles TOUJOURS/JAMAIS applicables]
[Gouvernance applicable (AI-ACT, RGPD, RGAA, RGESN)]

## Fichiers à modifier/créer
[Liste des fichiers source pertinents]
```

### Étape 4 — Lancer et monitorer

1. **Mettre à jour le statut** de la SPEC → `in-progress`
2. **Mettre à jour** `.aiad/specs/_index.md`
3. **Lancer l'agent** avec le contexte assemblé
4. **Observer** : l'agent suit-il la SPEC ? Y a-t-il des signes de drift ?

### Étape 5 — Post-exécution

À la fin de l'exécution agent :

| Résultat | Action suivante |
|----------|----------------|
| **Code produit, tests passent** | Lancer `/sdd validate` |
| **Code partiel ou erreurs** | Évaluer si le problème vient de la SPEC ou de l'agent. Relancer avec contexte ajusté ou corriger la SPEC |
| **Agent a dérivé de la SPEC** | Documenter le drift, vérifier le Critère de Drift de l'Intent. Relancer avec contraintes renforcées |
| **Session interrompue** | Sauvegarder l'état. Utiliser `/sdd resume` pour reprendre |

### Règles

- Ne JAMAIS lancer un agent sans SPEC validée (SQS ≥ 4/5)
- Le Context Engineering Budget est une responsabilité du PE — ne pas "tout injecter et espérer"
- Un agent qui dérive n'est pas en faute si la SPEC était imprécise — c'est un Human Learning
- Garder une trace du contexte effectivement injecté pour le `/sdd context` post-mortem
- Si l'exécution nécessite plus de 2 relances, la SPEC est probablement trop ambitieuse → envisager `/sdd split`

$ARGUMENTS
