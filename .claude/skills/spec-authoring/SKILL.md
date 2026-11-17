---
name: spec-authoring
description: "Use when drafting a SPEC from a validated Intent Statement - atomic scope, testable acceptance criteria, edge cases, agent stop points, no requirement the Intent does not carry."
---

# Skill — Rédaction de SPEC

> La SPEC est le contrat passé avec l'agent qui implémente. Elle traduit l'intention en comportement vérifiable — elle n'y ajoute rien.

## Quand l'utiliser

- Dans `/sdd spec`, après une Research tranchée GO.
- Quand une SPEC refusée à la Gate doit être réécrite.

## Méthode

1. **Partir du code réel** : lire ce qui existe avant d'écrire ce qui doit changer.
2. **Une SPEC = une PR** : un seul périmètre, environ 200 lignes de changement. Au-delà, découper (`/sdd split`).
3. **Comportement attendu** : Input, Processing, Output, et au moins trois cas limites.
4. **Critères d'acceptation** numérotés (`CA-001`…), chacun vérifiable par un test ou une commande. En format EARS : une exigence par phrase, déclencheur explicite.
5. **Contexte pour un lecteur extérieur** : ce qu'un Product Engineer qui ne connaît pas le projet doit savoir (Test de l'Étranger).
6. **Points d'arrêt de l'agent** : les situations où l'agent doit s'arrêter et demander.
7. **Périmètre d'exécution de l'agent** : seulement si l'agent a des credentials ou un accès en écriture à une ressource partagée.
8. **Traçabilité** : Intent parent, dépendances, SPECs liées.
9. **Questions ouvertes** : tout besoin que l'Intent ne porte pas devient une question au PE, jamais une exigence.

## Sortie

Un fichier `.aiad/specs/SPEC-NNN-N-slug.md` au statut `draft`, l'index mis à jour, la liste des questions ouvertes.

## Anti-patterns

- Ajouter une exigence « évidente » absente de l'Intent.
- Un critère d'acceptation du type « fonctionne correctement ».
- Noter sa propre SPEC ou la passer à `ready`.
