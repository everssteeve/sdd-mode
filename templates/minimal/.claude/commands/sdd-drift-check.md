---
name: sdd-drift-check
description: Vérifier la synchronisation artefacts/code (Drift Lock)
---

# SDD Mode — Anti-Drift Check

Tu es un Product Engineer AIAD. L'utilisateur veut vérifier la synchronisation entre les artefacts (SPEC, AGENT-GUIDE) et le code.

## Principe

Le **Spec Drift** — situation où le code évolue mais les artefacts ne suivent pas — est le risque #1 du développement avec agents IA. Le **Drift Lock** exige que code ET SPEC soient synchronisés dans la même PR.

## Étape 1 — Scanner les changements

Identifie tous les fichiers modifiés depuis le dernier commit/PR :

- fichiers de code modifiés ;
- SPECs dans `.aiad/specs/` — modifiées ou non ;
- `AGENT-GUIDE.md` — modifié ou non.

## Étape 2 — Vérifier la synchronisation SPEC ↔ Code

Pour chaque SPEC active (`in-progress` ou `validation`) :

| SPEC | Fichiers code liés | Code modifié ? | SPEC mise à jour ? | Statut |
|------|--------------------|----------------|--------------------|--------|
| SPEC-NNN | [fichiers] | OUI/NON | OUI/NON | OK / DRIFT |

## Étape 3 — Vérifier la cohérence globale

| Artefact | Dernière MAJ | Cohérent avec le code ? |
|----------|--------------|-------------------------|
| AGENT-GUIDE.md | [date] | OUI / À VÉRIFIER |
| Intent parent | [date] | OUI / À VÉRIFIER |

## Étape 4 — Verdict

**Si AUCUN drift :**

1. Mettre à jour le statut de la SPEC → `done`.
2. Mettre à jour `.aiad/specs/_index.md`.
3. La PR est prête pour review.

**Si DRIFT détecté :**

1. Lister précisément les écarts.
2. Proposer SOIT la mise à jour de la SPEC pour refléter le code, SOIT la correction du code pour correspondre à la SPEC.
3. **Ne JAMAIS merger une PR en état de drift.**

## Règles

- Le Drift Lock est **non-négociable** : code + SPEC dans la même PR.
- Un drift détecté n'est pas une honte — c'est le signe que le check fonctionne.
- La SPEC est modifiable ! Si le code révèle une meilleure approche, mets à jour la SPEC.
- Le drift le plus dangereux est celui qu'on ne vérifie pas.

$ARGUMENTS
