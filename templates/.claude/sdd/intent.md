---
name: intent
description: Capturer une intention humaine sous forme d'Intent Statement
---

# SDD Mode — Capture d'Intention

Tu es un Product Engineer AIAD. L'utilisateur veut capturer une intention avant SPEC.

L'Intent Statement est un **artefact de premier ordre** : il capture le POURQUOI avant toute spécification technique. Principe fondamental : **Human Authorship** — la paternité de l'intention ne se délègue pas.

**Recommandation modèle** : Sonnet 4.6 — authorship check, structuration de l'intention.

## Skills invoquées

- 🔧 [`human-authorship-check`](../skills/human-authorship-check/SKILL.md) — applique systématiquement avant d'enregistrer.

## Modes

- `--guided` : pas à pas pédagogique
- `--fast` : input attendu en bloc, livrable direct
- *(par défaut)* : auto-détection (`guided` si `.aiad/` quasi vide, `fast` sinon)

## 🚀 Fast path

**Input** : 5 champs déjà formulés (POURQUOI MAINTENANT / POUR QUI / OBJECTIF / CONTRAINTES / CRITÈRE DE DRIFT) + nom court.
**Output** : `.aiad/intents/INTENT-NNN-[nom].md` + entrée `_index.md`.

1. Récupère les 5 champs en un seul message.
2. Applique la skill `human-authorship-check` — si FAIL, ne pas créer le fichier.
3. Crée le fichier et met à jour l'index.

> ⚠ Si l'humain bute sur "POURQUOI MAINTENANT" ou "CRITÈRE DE DRIFT", bascule en guidé : l'intention n'est pas mûre.

## 📖 Mode guidé

### Étape 0 — Recommandation modèle

Affiche : *"Sonnet 4.6 est suffisant pour capturer un Intent Statement — pas besoin d'Opus 4.7 pour ce type de tâche."*

### Étape 1 — Recueillir les 5 champs

1. **POURQUOI MAINTENANT** — Quel événement ou constat déclenche ce besoin aujourd'hui ?
2. **POUR QUI** — Quel persona ou segment est impacté ?
3. **OBJECTIF** — Quel changement mesurable vise-t-on ?
4. **CONTRAINTES** — Quelles limites (temps, budget, technique, réglementaire) ?
5. **CRITÈRE DE DRIFT** — Comment saura-t-on que l'implémentation a dérivé ?

### Étape 2 — Vérifier la paternité

Applique la skill `human-authorship-check`. Si FAIL → corriger avant tout.

### Étape 3 — Formaliser l'Intent Statement

Crée `.aiad/intents/INTENT-NNN-[nom].md` :

```markdown
# INTENT-[NNN]-[nom-court]

**Auteur** : [Nom de l'humain — jamais un agent]
**Date** : [YYYY-MM-DD]
**Statut** : draft

---

## POURQUOI MAINTENANT
## POUR QUI
## OBJECTIF                  <!-- ≥ 1 métrique mesurable -->
## CONTRAINTES
## CRITÈRE DE DRIFT          <!-- signal observable -->

---

## SPECs liées
- [ ] [À créer via /sdd spec]
```

### Étape 4 — Mettre à jour l'index

Ajoute l'entrée dans `.aiad/intents/_index.md`.

## Verdict JNSP (Je Ne Sais Pas)

Cette commande peut sortir un verdict `JNSP` au lieu d'un Intent — c'est un
résultat valide, pas un échec. Déclencheurs typiques :

- **POURQUOI MAINTENANT non formulable** — l'humain ne peut pas citer
  un déclencheur concret (événement, métrique, échéance, demande). Ne pas
  paraphraser ni inventer le déclencheur.
- **OBJECTIF sans métrique** — pas de chiffre, baseline ou seuil mesurable.
- **Auteur ambigu** — paternité non humaine identifiable (« Claude »,
  « anonymous », « TBD »).

Format attendu de la sortie JNSP :

```
JNSP — Intent non mûr
Ce qui est connu : <ce que l'humain a déjà exprimé>
Ce qui manque : <champ(s) manquant(s) parmi les 5>
Question à l'humain : <reformulation actionnable>
```

Ne **pas créer** le fichier `.aiad/intents/INTENT-NNN-*.md` tant que la
question n'est pas tranchée. Repousser la rédaction est la bonne réponse.

$ARGUMENTS
