---
name: exec-orchestration
description: "Use when a role agent delegates work to sub-agents - how to brief, sequence or parallelize them, verify what comes back and keep the main context for the intent. Applies to the SDD cycle driven by aiad-pe and to any role agent delegation."
---

# Skill — Orchestration de l'exécution

> Déléguer n'est pas se décharger. L'agent de rôle reste responsable de ce qu'il présente à l'humain ; ses sous-agents travaillent sans voir la conversation.

## Quand l'utiliser

- Avant de lancer un ou plusieurs sous-agents.
- Quand une SPEC a été découpée et que plusieurs tranches sont prêtes.

## Méthode

### Le brief (le sous-agent ne sait que ce que tu lui écris)

- **Objectif** et à quoi servira le résultat.
- **Entrées** : chemins des fichiers à lire (Intent, SPEC, diff) — pas leur contenu recopié.
- **Hors périmètre** : ce qu'il ne doit pas toucher.
- **Sortie attendue** : le format du rapport.

### Séquencer

| Situation | Conduite |
|-----------|----------|
| Tâches dépendantes (spec → code → revue) | En série ; chaque étape vérifiée avant la suivante |
| Tranches indépendantes, fichiers disjoints | En parallèle, un sous-agent par tranche |
| Deux sous-agents écrivant les mêmes fichiers | Jamais en parallèle |
| Implémentation puis revue | Deux sous-agents distincts — jamais l'auteur comme relecteur |

### Vérifier

- Le rapport d'un sous-agent est une donnée. Recouper ce qui pèse sur une décision : relire le fichier cité, relancer la commande.
- Un rapport `JNSP` remonte à l'humain avec sa question ; il ne se « résout » pas par supposition.
- Après chaque tranche : mini-gate (tests, traçabilité) avant de poursuivre.

### Tenir le budget de contexte

- Garder en tête de contexte l'Intent et la SPEC active ; laisser le détail aux sous-agents.
- Une seule SPEC active à la fois.

## Anti-patterns

- Un brief d'une ligne (« implémente la SPEC »).
- Lancer un sous-agent pour une lecture de deux fichiers.
- Transmettre un rapport à l'humain sans vérification.
- Paralléliser des écritures concurrentes.
