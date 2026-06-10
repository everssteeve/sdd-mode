---
name: grill-me
description: Use when a human gate must be interactive (« grill me ») rather than a static form — one question at a time, the agent proposes its recommended answer, the human validates or corrects. Triggered by /sdd gate --guided and /sdd research --guided. Preserves Human Authorship.
review_at: v2.3.0
sunset_when: "le modèle conduit nativement un interrogatoire 1-question/tour avec recommandation"
---

# Skill — Grill Me (gate humain interactif, garde-fou GF4)

> Un gate humain efficace n'est pas un formulaire statique : c'est un
> **interrogatoire** (Matt Pocock « grill me », design-concept de Brooks).
> Une question à la fois, l'agent **propose sa réponse recommandée**, l'humain
> valide d'un mot ou corrige. La paternité reste humaine.

## Quand l'utiliser

- `/sdd gate --guided` — avant d'ouvrir l'Execution Gate.
- `/sdd research --guided` — avant de trancher GO/NO-GO.
- Toute décision où l'agent pourrait inventer une intention à la place de l'humain.

## Principe (≠ formulaire)

| Anti-pattern (formulaire) | Pattern « grill me » |
|---------------------------|----------------------|
| 8 champs à remplir d'un coup | **1 question à la fois** |
| L'agent attend passivement | L'agent **propose une réponse recommandée** |
| L'humain rédige tout | L'humain **valide d'un mot ou corrige** |
| Paternité diluée | **Human Authorship** préservée |

## Déroulé

1. Construis la file de questions du gate (obligatoires + optionnelles).
2. Pose **la première non répondue** + ta recommandation argumentée.
3. Attends l'arbitrage humain (valide / corrige). N'enchaîne pas seul.
4. Recommence jusqu'à ce que toutes les questions **obligatoires** soient tranchées.
5. Ne clôs le gate que sur décision humaine — jamais en auto-validant tes propres recommandations.

## Outillage déterministe

La commande `aiad-sdd` expose la logique pure (`lib/grill.js`) :
`prochaineQuestion(questions, reponses)` → la suivante non répondue + recommandation ;
`grillComplet(questions, reponses)` → toutes les obligatoires tranchées.

## Anti-patterns

- Poser toutes les questions d'un bloc (retour au formulaire).
- Valider ses propres recommandations sans arbitrage humain (perte de paternité).
- Sauter une question obligatoire « parce que la réponse semble évidente ».
