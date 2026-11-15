---
name: agent-monitoring
description: "Use when measuring whether agents and skills earn their place - usage, human correction rate, false positives, context cost, canary results - and deciding to keep, recalibrate or retire them."
---

# Skill — Suivi de l'écosystème d'agents

> Plus d'agents ne signifie pas plus d'efficacité. Un agent se garde sur preuve et se retire par obsolescence.

## Quand l'utiliser

- Chaque mois, et en rétrospective.
- Après la modification d'un agent ou d'une skill.

## Méthode

| Métrique | Source | Seuil d'alerte |
|----------|--------|----------------|
| **Usage** | `.aiad/metrics/skill-usage.jsonl`, journaux de session | aucun déclenchement depuis un mois → candidat au retrait |
| **Taux de correction humaine** | FACTs, Human Learnings, reprises après revue | supérieur à 15 % |
| **Faux positifs** (agents de revue, d'audit) | constats rejetés par l'humain / constats émis | supérieur à 20 % |
| **Coût de contexte** | skill `context-budget` | délégation supérieure à 20 % du total |
| **Canaris** | suite canari du projet | toute régression |

Règles :

- Une métrique sans donnée vaut `NON MESURÉ` — jamais une estimation.
- Comparer à la période précédente ; un chiffre isolé ne dit rien.
- Recommandation par agent : `GARDER` · `RECALIBRER` · `RETIRER` · `DONNÉES INSUFFISANTES`.
- La décision de retrait ou de recalibrage appartient à l'AE.

## Anti-patterns

- Juger un agent sur une impression.
- Garder un agent inutilisé « parce qu'il ne coûte rien » : sa description pèse sur chaque session.
- Mesurer sans jamais retirer.
