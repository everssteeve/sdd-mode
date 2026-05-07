---
name: spec
description: Rédiger une SPEC technique depuis un Intent Statement
---

# SDD Mode — Rédaction de SPEC

Tu es un Product Engineer AIAD. L'utilisateur veut rédiger une SPEC technique depuis un Intent Statement.

## Contexte SDD Mode

La SPEC est un **invariant vivant** — elle reste la source de vérité entre l'intention humaine et le code agent, avant, pendant et après l'implémentation. Une SPEC = une tâche atomique.

## Mode d'exécution

Cette commande supporte deux modes :

- **`--guided`** → mode débutant : questions posées une par une, concepts expliqués, exemples proposés.
- **`--fast`** → mode expert : input attendu en bloc, explications sautées, livrable direct.
- *(aucun flag)* → auto-détection : **guided** si `.aiad/` est absent ou quasi vide, **fast** sinon.

Inspecte `$ARGUMENTS` pour détecter le flag ; à défaut, inspecte `.aiad/` avant de trancher.

## Option REASONS Canvas (v1.6)

Si l'utilisateur le souhaite, propose d'utiliser le **REASONS Canvas** (SPDD — Kevlin Henney) comme approche de structuration de la SPEC avant de passer au format standard AIAD. Les deux sont compatibles : le REASONS Canvas enrichit la justification de l'intention sans remplacer le format de SPEC AIAD. Propose cette option en mode guidé si l'Intent Statement semble complexe ou ambigu.

## 🚀 Fast path (expert)

**Input attendu** : ID de l'Intent parent (INTENT-NNN) + découpage de tâches si l'humain le propose déjà.
**Output produit** : une ou plusieurs SPECs dans `.aiad/specs/` + mise à jour `_index.md` et Intent parent.
**Actions** :
1. Vérifie l'Intent parent, propose un découpage atomique si nécessaire (1 SPEC = 1 PR).
2. Rédige chaque SPEC au format complet (Contexte / Input / Processing / Output / Cas limites / Critères d'Acceptation / Interface / Dépendances / Budget contexte / DoOD).
3. Mets à jour les index et liaisons.

Si tout est clair, saute directement à **Règles**. Sinon, suis le **Mode guidé** ci-dessous.

## 📖 Mode guidé (pas à pas)

### Étape 1 — Identifier l'Intent parent

Vérifie qu'un Intent Statement existe dans `.aiad/intents/`. Si non, propose de lancer `/sdd intent` d'abord.

### Étape 2 — Décomposer en tâches atomiques

Depuis l'Intent Statement, identifie les tâches atomiques (1 SPEC = 1 PR potentielle).
Propose la décomposition à l'utilisateur pour validation.

### Étape 3 — Rédiger la SPEC

Pour chaque tâche, crée un fichier dans `.aiad/specs/` au format :

```markdown
# SPEC-[NNN]-[nom-court]

**Intent parent** : INTENT-[NNN]
**Auteur** : [PE]
**Date** : [YYYY-MM-DD]
**Statut** : draft
**SQS** : [À évaluer via /sdd gate]

---

## 1. Contexte

[Résumé de l'Intent parent — 2-3 phrases max]

## 2. Comportement Attendu

### Input
[Données d'entrée, formats, sources]

### Processing
[Logique métier étape par étape — pseudo-code accepté]

### Output
[Données de sortie, formats, destinations]

### Cas limites
[Edge cases explicites — au moins 3]

## 3. Critères d'Acceptation

- [ ] [Critère 1 — testable, observable]
- [ ] [Critère 2]
- [ ] [Critère 3]

## 4. Interface / API

```
[Signature de fonction, endpoint, schéma — selon le contexte]
```

## 5. Dépendances

- [Dépendance 1 — module, service, SPEC parente]

## 6. Estimation Context Engineering Budget

**Contexte à injecter pour cette tâche :**
- AGENT-GUIDE (condensé) : ~[X] tokens
- Cette SPEC : ~[X] tokens
- Fichiers source pertinents : [liste]
- **Total estimé** : ~[X] tokens

## 7. Definition of Output Done (DoOD)

- [ ] Code implémenté et lint passing
- [ ] Tests unitaires couvrant les cas limites
- [ ] SPEC mise à jour si écart (Drift Lock)
- [ ] Code review passée
- [ ] Gouvernance vérifiée (AI-ACT / RGPD / RGAA / RGESN si applicable)
```

### Étape 4 — Mettre à jour les index

- Ajoute l'entrée dans `.aiad/specs/_index.md`
- Lie la SPEC dans l'Intent Statement parent

### Règles

- Une SPEC ne doit JAMAIS contenir d'ambiguïté sur le comportement attendu
- Les critères d'acceptation doivent être testables automatiquement
- Si la SPEC fait plus de 200 lignes, elle est probablement trop grande — décompose
- Le Context Engineering Budget est une responsabilité du PE, pas de l'agent

$ARGUMENTS
