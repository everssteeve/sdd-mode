---
name: init
description: Cadrage initial d'un projet SDD Mode (PRD + ARCHITECTURE + AGENT-GUIDE)
---

# SDD Mode — Cadrage Initial

Tu es un Product Engineer AIAD. L'utilisateur veut initialiser le cadrage d'un nouveau projet (ou d'une nouvelle fonctionnalité majeure) en mode SDD.

Le cadrage produit les **3 artefacts fondamentaux** :
1. **PRD.md** — Vision produit (PM)
2. **ARCHITECTURE.md** — Décisions techniques (Tech Lead)
3. **AGENT-GUIDE.md** — Contexte permanent agent (AE)

## Skills invoquées

- 🔧 [`human-authorship-check`](../skills/human-authorship-check/SKILL.md) — vérifie que les "POURQUOI" du PRD sont humains.

## Modes

- `--guided` : pas à pas
- `--fast` : 3 artefacts directs
- *(par défaut)* : auto-détection

## ⚡ Étape 0 — Message de redémarrage

Avant toute action, affiche :

> *"Pour charger toutes les 27 commandes AIAD dans cette session, il est recommandé de relancer l'agent (`/exit` puis relancer la commande). Souhaites-tu continuer sans redémarrage ?"*

Si l'utilisateur continue sans redémarrer, note que certaines commandes pourraient ne pas être disponibles.

## 🚀 Fast path

**Input** : nom projet, stack, horizon, 1-2 phrases sur le problème.
**Output** : `PRD.md` + `ARCHITECTURE.md` + `AGENT-GUIDE.md` pré-remplis.

1. Demande les 3-5 éléments de cadrage en un seul bloc.
2. Applique la skill `human-authorship-check` sur les "POURQUOI" du PRD.
3. Produis les 3 artefacts directement.
4. Livre en diff pour validation, pas section par section.

## 📖 Mode guidé

### Étape 1 — Comprendre l'intention

Pose 3-5 questions :
- Quel problème résoudre ? Pour qui ? Pourquoi maintenant ?
- Quelles contraintes techniques ou business ?
- Quelle taille d'équipe et quel horizon temporel ?

Applique la skill `human-authorship-check` — la paternité de la vision produit ne se délègue pas.

### Étape 2 — Rédiger le PRD

Présente les deux options suivantes au PE avant de continuer :

```
📋 PRD.md — Comment veux-tu le renseigner ?

  A) Assistant PRD  (/sdd prd)
     → Je te pose des questions comme un PM expérimenté (problem, personas,
       outcomes mesurables, scope, risques). Tu réponds, je rédige le PRD.
     → Recommandé pour un nouveau projet ou si le PRD est encore flou.

  B) Manuel
     → J'ouvre le template .aiad/PRD.md avec les sections pré-remplies.
     → Tu le complètes à ton rythme, puis /sdd init reprend depuis l'ARCHITECTURE.

Ton choix ? (A/B)
```

- Si **A** → charge `.claude/sdd/prd.md` avec ton outil `Read` et suis ses instructions.
- Si **B** → affiche le contenu actuel de `.aiad/PRD.md` et indique au PE de le compléter, puis propose de continuer avec `/sdd init` une fois terminé.

### Étape 3 — Rédiger l'ARCHITECTURE

Une fois le PRD validé, présente les deux options :

```
🏗 ARCHITECTURE.md — Comment veux-tu le renseigner ?

  A) Assistant ARCHITECTURE  (/sdd arch)
     → Je te pose des questions comme un architecte expérimenté (NFRs, stack,
       composants, flux critique, sécurité, ADRs). Tu réponds, je rédige le doc.
     → Recommandé si la stack n'est pas encore arrêtée ou si l'équipe est junior.

  B) Manuel
     → J'ouvre le template .aiad/ARCHITECTURE.md avec les sections pré-remplies.
     → Tu le complètes à ton rythme, puis /sdd init reprend depuis l'AGENT-GUIDE.

Ton choix ? (A/B)
```

- Si **A** → charge `.claude/sdd/arch.md` avec ton outil `Read` et suis ses instructions.
- Si **B** → affiche le contenu actuel de `.aiad/ARCHITECTURE.md` et indique au PE de le compléter.

### Étape 4 — Rédiger l'AGENT-GUIDE

Remplis `.aiad/AGENT-GUIDE.md` avec :
- Stack technique (référence rapide, dérivée de l'ARCHITECTURE.md)
- Règles absolues (TOUJOURS / JAMAIS)
- Conventions de code avec exemples
- Vocabulaire métier

## Règles

- Ne JAMAIS commencer à coder sans les 3 artefacts validés.
- Chaque artefact doit être compréhensible en 10 minutes.
- Le PRD ne contient pas de "comment" technique — uniquement le "quoi" et le "pourquoi".
- L'ARCHITECTURE doit être compressible sans perdre son essentiel.

$ARGUMENTS
