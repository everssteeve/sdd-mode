---
name: human-authorship-check
description: Use when validating that an Intent Statement, decision or strategic artefact has explicit human authorship — ensures the POURQUOI is not generated, paraphrased or invented by the agent. Triggered by /sdd intent, /sdd spec, /aiad intention.
---

# Skill — Human Authorship Check

> Garde-fou structurant d'AIAD : la paternité de l'intention ne se délègue pas.
> Cette skill bloque toute Intent ou décision dont l'origine humaine n'est pas vérifiable.

## Quand l'utiliser

- Avant d'enregistrer un Intent Statement (`/sdd intent`)
- Avant de rédiger une SPEC dont l'Intent parent semble flou ou auto-généré (`/sdd spec`)
- Lors d'un retour d'intention stratégique (`/aiad intention`)
- Quand l'agent est tenté de "compléter" un POURQUOI manquant

## Vérifications (5 points)

| # | Vérification | Échec = signal |
|---|--------------|----------------|
| 1 | Le champ `Auteur` est un nom humain identifiable (pas "Claude", "Agent", "AI", "PE", "anonymous", "TBD") | Auteur non humain |
| 2 | Les 5 champs (POURQUOI MAINTENANT / POUR QUI / OBJECTIF / CONTRAINTES / CRITÈRE DE DRIFT) viennent de l'utilisateur, pas d'une paraphrase de l'agent | Intention dictée par l'agent |
| 3 | "POURQUOI MAINTENANT" cite un déclencheur concret (événement, métrique, échéance, demande) | Intention non mûre |
| 4 | "OBJECTIF" contient au moins une métrique mesurable (chiffre, baseline, seuil) | Objectif vague |
| 5 | "CRITÈRE DE DRIFT" est un signal observable (pas une intention reformulée) | Garde-fou inopérant |

## Procédure

1. Lire l'Intent Statement (ou l'artefact équivalent).
2. Évaluer chacun des 5 points.
3. Si un seul échoue → renvoyer le verdict ⚠ FAIL avec action corrective.
4. Si l'humain ne peut pas répondre au point 3 ("POURQUOI MAINTENANT"), basculer en mode guidé et **ne jamais inventer** la réponse — c'est le signal que l'intention n'est pas prête.

## Output

**Si OK :**
```
✅ HUMAN AUTHORSHIP — validé
Auteur : <nom>
Intent : INTENT-NNN
```

**Si FAIL :**
```
⚠ HUMAN AUTHORSHIP — non validé
Critère échoué : [#X — intitulé]
Problème : [description précise]
Action : [reformuler / repousser / demander à l'humain]
```

## Règles

- L'agent peut **aider à reformuler** un POURQUOI, mais jamais l'inventer.
- Si l'humain bute sur "POURQUOI MAINTENANT" ou "CRITÈRE DE DRIFT" → l'intention n'est pas mûre, repousser la rédaction.
- Cette skill est non-négociable : elle s'applique avant TOUTE création d'artefact stratégique.
