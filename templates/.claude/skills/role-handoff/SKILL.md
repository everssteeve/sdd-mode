---
name: role-handoff
description: "Use when a topic belongs to another AIAD responsibility (PM, PE, AE, QA, Tech Lead) - writes or reads a handoff note in .aiad/handoffs/ instead of acting outside the current role. Used by the five role agents."
---

# Skill — Relais inter-rôles

> Un agent de rôle ne lance pas les sous-agents d'un autre rôle et ne décide pas pour lui. Il laisse un **relais** : une note courte, datée, adressée, que l'assistant destinataire présente à son humain à l'ouverture de session.

## Quand l'utiliser

- Un constat relève d'une autre responsabilité (un défaut trouvé par le QA, une question d'architecture soulevée par le PE…).
- Une décision d'un autre rôle est nécessaire pour avancer.
- À l'ouverture de session : lire les relais `open` adressés à ton rôle.

## Méthode

### Écrire un relais

Fichier : `.aiad/handoffs/HANDOFF-<AAAA-MM-JJ>-<de>-<vers>-<slug>.md` (rôles : `pm`, `pe`, `ae`, `qa`, `tl`).

```markdown
---
from: pe
to: qa
status: open
date: "2026-11-15"
requested-by: <nom de l'humain qui demande, ou « assistant, à confirmer »>
---

# <Objet en une ligne>

## Demande
<Ce qui est attendu du rôle destinataire — une action ou une décision.>

## Contexte
<Artefacts concernés : INTENT-NNN, SPEC-NNN-N, fichiers, rapport de sous-agent.>

## Ce qui est déjà établi
<Faits vérifiés, avec leur source.>

## Échéance / blocage
<Ce qui est bloqué en attendant, ou « non bloquant ».>
```

### Traiter un relais

1. Le présenter à l'humain du rôle destinataire — c'est lui qui accepte, refuse ou reporte.
2. Une fois traité : passer `status` à `done` (ou `declined`) et ajouter une section `## Réponse` datée.
3. Ne jamais supprimer un relais : il fait partie de la trace.

## Anti-patterns

- Agir à la place du rôle destinataire « pour gagner du temps ».
- Un relais sans demande explicite (simple information) — préférer l'artefact concerné.
- Marquer `done` un relais que l'humain destinataire n'a pas vu.
