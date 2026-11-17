---
name: agent-authoring
description: "Use when creating or modifying an agent (.claude/agents/) or a skill (.claude/skills/) - need validated by a human, single owning role agent, least-privilege tools, execution contract, trigger description, deterministic validation."
---

# Skill — Création d'agents et de skills

> Tout ce qu'un agent charge se traite comme du comportement exécutable. Un agent ou une skill naît d'une douleur constatée, pas d'une idée — et passe par une revue humaine.

## Quand l'utiliser

- Un problème récurrent justifie un nouvel agent ou une nouvelle skill.
- Un agent existant doit être recalibré.

## Méthode

1. **Justifier** : quelle douleur, constatée combien de fois ? Existe-t-il déjà un agent ou une skill qui la couvre ? Règle : au moins trois usages prévisibles.
2. **Rattacher** : un sous-agent a **un seul** agent de rôle gestionnaire (`aiad-managed-by`). Il s'ajoute au registre et à la liste `Agent(...)` de ce rôle.
3. **Contrat d'exécution** : mission en une phrase, entrée attendue, déroulé, format de sortie avec verdict, limites, conduite en cas d'information manquante (`JNSP`).
4. **Moindre privilège** :

   | Mission | Outils |
   |---------|--------|
   | Analyse, revue, audit | `Read, Grep, Glob` (+ `Bash` seulement s'il faut exécuter) et `disallowedTools: Edit, Write` |
   | Production de fichiers | écriture limitée par consigne à un répertoire nommé |
   | Sous-agent | jamais l'outil `Agent` |

5. **Description** (en anglais, 30 à 1536 caractères) : dit **quand** déclencher, pas seulement ce que fait l'agent.
6. **Modèle** : le plus sobre qui suffit (`haiku` pour un balayage, `sonnet` pour une analyse, `inherit` pour le raisonnement lourd).
7. **Valider** : `npx aiad-sdd agents validate` et `npx aiad-sdd skills validate`.
8. **Revue humaine** du diff par l'AE avant usage ; essai sur un cas nominal ; mesure après un mois (skill `agent-monitoring`).

## Anti-patterns

- Un agent « au cas où ».
- Des outils larges « pour simplifier ».
- Une consigne qui relâche la supervision (« continue sans approbation », `--no-verify`).
- Un agent qui modifie ses propres instructions sans revue.
