# Index des Intent Statements

> Chaque Intent Statement capture le POURQUOI d'une fonctionnalité avant toute spécification.
> Format : `INTENT-NNN-[nom-court].md`
> Commande : `/sdd-intent` dans Claude Code

| ID | Titre | Auteur | Date | SPECs liées | Statut |
|----|-------|--------|------|-------------|--------|
| INTENT-001 | Feedback qualitatif utilisateurs SDD Mode | Steeve Evers | 2026-05-29 | SPEC-001-1 | done |

## Cycle de vie d'un Intent Statement

Chaque Intent Statement possède un champ `status:` dans son frontmatter :

| Statut | Signification | Transition |
|--------|---------------|------------|
| `draft` | Intent en cours de rédaction, pas encore validé par un stakeholder | → `active` (après validation PM + stakeholder) |
| `active` | Intent validé, au moins une SPEC en cours ou planifiée | → `done` (toutes les SPECs liées sont validées et mergées) |
| `done` | Intent réalisé, toutes les SPECs liées sont complétées | → `archived` (après revue à l'Atelier d'Intention) |
| `archived` | Intent historique, conservé pour traçabilité | Réactivation possible → `active` (nécessite un nouvel Intent Statement de justification) |

### Signaux de santé (`/aiad-health`)

- **Zombie** : Intent `active` sans activité depuis >30 jours → décision humaine requise (archiver ou relancer)
- **Orphelin** : Intent `active` sans SPEC liée → probablement un intent non décomposé
- **Draft oublié** : Intent `draft` depuis >14 jours → intention pas mûre ou abandonnée
