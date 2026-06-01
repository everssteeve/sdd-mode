# Gartner valide la productivité agentique — AIAD garantit la gouvernance

> **Argumentaire commercial — Batch A / briefing ALIS 2026-05-31 (HYP-2026-05-27-001)**
> Score signal : 17,5/20. Fenêtre : 90 jours à compter du 31 mai 2026.
>
> ⚠️ Chiffres Gartner issus de la veille ALIS — à confirmer avant présentation externe.

## Le contexte : Gartner formalise la catégorie

Le **Gartner Magic Quadrant 2026** pour les "Enterprise AI Coding Agents" projette des gains
de productivité de **30 à 50 %** d'ici 2028. En formalisant cette catégorie, Gartner crée deux
effets simultanés :

1. **Les équipes enterprise vont prendre des décisions d'adoption dans les 90 prochains jours**
   — le MQ sert d'autorisation interne pour les achats et les budgets.
2. **Un vide de gouvernance apparaît** : Gartner mesure la productivité, pas la gouvernance. Les
   outils évalués (harnesses propriétaires, agent labs) optimisent l'output — ils ne répondent
   pas à la question "qui est responsable de ce que l'agent a décidé de faire ?".

## Le vide que AIAD adresse

Les grands labs (Anthropic, OpenAI, Amazon, Google) pivotent tous vers des **harnesses
propriétaires** : Anthropic Routines, OpenAI Symphony, Amazon Kiro, Google Agent Space. Ces
outils sont puissants et réels — mais ils partagent un angle mort commun :

- **Pas d'Intent Statement** : l'agent reçoit des instructions, pas une intention validée par
  un humain identifiable.
- **Pas de SQS** : aucun critère de qualité formels avant le lancement.
- **Pas de Drift Lock** : le code peut dériver de l'intention initiale sans détection.
- **Pas de Human Authorship** : la paternité de la décision reste floue.

Et surtout : **ils sont propriétaires**. Adopter un harness = risquer un lock-in vendor dans
un marché en disruption rapide (abandon Llama par Meta, pivots successifs de tous les labs).

## L'argument AIAD

**AIAD n'est pas un concurrent des harnesses — c'est la couche gouvernance qu'ils n'ont pas.**

| Question | Harnesses (Routines, Symphony, Kiro…) | AIAD |
|---|---|---|
| "L'agent a-t-il bien exécuté ?" | ✅ Oui, avec métriques | ✅ Oui |
| "Qui a voulu ce que l'agent a fait ?" | ❌ Flou | ✅ Intent Statement (Human Authorship) |
| "La SPEC était-elle validée avant lancement ?" | ❌ Non | ✅ Execution Gate (SQS ≥ 4/5) |
| "Le code a-t-il dévié de l'intention ?" | ❌ Non détecté | ✅ Drift Lock |
| "Ça marchera avec un autre modèle demain ?" | ❌ Lock-in vendor | ✅ Model-agnostic |

**Formulation pour les décideurs enterprise** : "Gartner vous dit que les agents vont vous faire
gagner 30-50 % de productivité. AIAD garantit que vous gardez la gouvernance de ce qu'ils font."

## Signaux convergents

- **Gartner MQ 2026** (score veille 18/20) : formalise la catégorie, crée la pression d'adoption.
- **35-65 % de biais d'action** (FixedBench, arXiv 2605.07769) : les agents SOTA agissent par
  défaut — l'Execution Gate est la réponse documentée.
- **29 585 PR** (arXiv 2605.08017) : l'autorité de fusion reste humaine sur le terrain, même
  quand les outils ne le formalisent pas — AIAD le formalise.

## Liens internes

- Comparaison Kiro : [`aiad-vs-kiro-autonomie.md`](./aiad-vs-kiro-autonomie.md)
- Model-agnostic : [`model-agnostic-disruption.md`](./model-agnostic-disruption.md)
- Légitimation empirique : [`../docs/legitimation/execution-gate-evidence.md`](../docs/legitimation/execution-gate-evidence.md)
