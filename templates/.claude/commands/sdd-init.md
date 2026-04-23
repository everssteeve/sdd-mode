---
name: sdd-init
description: Cadrage initial d'un projet SDD Mode (PRD + ARCHITECTURE + AGENT-GUIDE)
---

# SDD Mode — Cadrage Initial

Tu es un Product Engineer AIAD. L'utilisateur veut initialiser le cadrage d'un nouveau projet (ou d'une nouvelle fonctionnalité majeure) en mode SDD.

## Contexte SDD Mode

Le cadrage initial produit les 3 artefacts fondamentaux :
1. **PRD.md** — Vision produit (maintenu par le PM)
2. **ARCHITECTURE.md** — Décisions techniques (maintenu par le Tech Lead)
3. **AGENT-GUIDE.md** — Contexte permanent agent (maintenu par l'AE)

## Mode d'exécution

Cette commande supporte deux modes :

- **`--guided`** → mode débutant : questions posées une par une, concepts expliqués, exemples proposés.
- **`--fast`** → mode expert : input attendu en bloc, explications sautées, livrable direct.
- *(aucun flag)* → auto-détection : **guided** si `.aiad/` est absent ou quasi vide, **fast** sinon.

Inspecte `$ARGUMENTS` pour détecter le flag ; à défaut, inspecte `.aiad/` avant de trancher.

## 🚀 Fast path (expert)

**Input attendu** : nom projet, stack, horizon, 1-2 phrases sur le problème à résoudre.
**Output produit** : `PRD.md` + `ARCHITECTURE.md` + `AGENT-GUIDE.md` pré-remplis.
**Actions** :
1. Demande les 3-5 éléments de cadrage en un seul bloc.
2. Produis les 3 artefacts directement avec les sections remplies.
3. Livre en diff pour validation, pas en dialogue section par section.

Si tout est clair, saute directement à **Règles**. Sinon, suis le **Mode guidé** ci-dessous.

## 📖 Mode guidé (pas à pas)

### Étape 1 — Comprendre l'intention

Pose 3-5 questions de cadrage pour comprendre :
- Quel problème résoudre ? Pour qui ? Pourquoi maintenant ?
- Quelles contraintes techniques ou business ?
- Quelle taille d'équipe et quel horizon temporel ?

### Étape 2 — Rédiger le PRD

Utilise le template `.aiad/PRD.md` et remplis-le avec les réponses obtenues.
Assure-toi que chaque Outcome Criteria est mesurable (baseline → cible → méthode).

### Étape 3 — Rédiger l'ARCHITECTURE

Sur la base du PRD validé, propose une stack technique et remplis `.aiad/ARCHITECTURE.md`.
Prépare un résumé condensé (max 500 tokens) pour le Context Engineering Budget.

### Étape 4 — Rédiger l'AGENT-GUIDE

Remplis `.aiad/AGENT-GUIDE.md` avec le contexte du projet :
- Stack technique (référence rapide)
- Règles absolues (TOUJOURS / JAMAIS)
- Conventions de code avec exemples
- Vocabulaire métier

### Règles

- Ne commence JAMAIS à coder sans les 3 artefacts validés
- Chaque artefact doit être compréhensible en 10 minutes
- Le PRD ne contient pas de "comment" technique — uniquement le "quoi" et le "pourquoi"
- L'ARCHITECTURE doit être compressible sans perdre son essentiel

$ARGUMENTS
