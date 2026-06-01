# AIAD vs Kiro — pourquoi AIAD n'est pas "Kiro avec des gates"

> **Argumentaire commercial — Batch A / briefing ALIS 2026-05-31 (HYP-2026-05-13-001)**
> Score signal : 17/20. À intégrer dans les présentations pour clients ayant évalué Kiro.

## Contexte : Kiro comme contre-modèle

Amazon Kiro a déployé en mai 2026 trois évolutions qui constituent le **contre-modèle exact** du
SDD Mode :

1. **Mode "autonomous"** — l'agent s'exécute sans intervention humaine par défaut.
2. **"Quick Plan"** — option explicite pour *sauter* les approval gates.
3. **Steering files** — fichiers de pilotage de l'agent, sans philosophie d'intention humaine.

Ces trois évolutions sont cohérentes avec la vision de Kiro : **maximiser l'autonomie agentique**,
réduire la friction, livrer vite. C'est un choix de design légitime — et un différenciant clair
vis-à-vis d'AIAD.

## Mapping point par point

| Dimension | Kiro | AIAD SDD Mode |
|---|---|---|
| **Execution par défaut** | Mode autonomous (sans intervention) | Gate obligatoire (SQS ≥ 4/5) |
| **Approval gates** | Quick Plan : contournement explicite possible | Gate non-contournable par le cycle |
| **Source de l'intention** | Steering files (configuration technique) | Intent Statement (paternité humaine) |
| **Philosophie de pilotage** | Dépolitisée — "dis à l'agent quoi faire" | Ancrée dans 7 valeurs (Human Authorship, Responsabilité Partagée…) |
| **Validation de la spec** | Aucun critère formel | SQS — 5 critères scorables + Test de l'Étranger |
| **Cohérence code/intention** | Non détectée | Drift Lock (sync code ↔ SPEC dans la même PR) |
| **Dépendance vendor** | Lock-in Amazon/AWS | Model-agnostic |

## Pourquoi AIAD n'est pas "Kiro avec des gates"

La différence n'est pas quantitative (plus ou moins de gates) — elle est **architecturale** :

- **Kiro part de l'exécution** et propose optionnellement du contrôle.
- **AIAD part de l'intention humaine** et construit l'exécution sur cette base.

Un gate posé sur un agent autonome reste un garde-fou ponctuel. Un **Intent Statement** validé
par un Human Authorship change la question fondamentale : on ne demande plus *"l'agent a-t-il
bien exécuté ?"* mais *"l'agent a-t-il bien réalisé ce que nous voulions ?"*.

La distinction porte sur qui *décide* de ce qui est construit. Kiro optimise la production de
l'agent. AIAD gouverne l'intention qui la précède.

## Argument pour les clients ayant évalué Kiro

Kiro est un bon outil pour les équipes qui veulent **accélérer l'exécution agentique**. AIAD est
le bon choix pour les équipes qui veulent **maintenir la gouvernance de l'intention** — qui a
voulu quoi, pourquoi, et comment vérifier que c'est bien ce qui a été livré.

Les deux sont compatibles : on peut utiliser Kiro comme couche exécution d'une SPEC validée par
AIAD. AIAD n'est pas un outil, c'est un meta-framework qui peut intégrer Kiro.

**Formulation courte** : "Kiro accélère l'agent. AIAD garantit que l'agent accélère dans la bonne
direction."

## Liens internes

- Vue d'ensemble governance gap : [`governance-gap-2026.md`](./governance-gap-2026.md)
- Positionnement vs Symphony/Routines : [`../frameworkAIAD.md`](../frameworkAIAD.md) §Positionnement
