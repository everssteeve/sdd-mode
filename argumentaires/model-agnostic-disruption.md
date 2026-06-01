# Model-agnostic — résistance aux disruptions de modèles

> **Argumentaire commercial — Batch A / briefing ALIS 2026-05-31 (HYP-2026-05-06-004)**
> Score signal : 13/20. Fenêtre : 2-3 cycles (l'abandon Llama est récent).

## Ce que vous avez vécu avec Llama — AIAD vous en protège

Meta a abandonné Llama en 2026, disruption qui a touché des équipes ayant construit des
workflows dépendants de ce modèle : prompts calibrés, pipelines d'orchestration, benchmarks
internes — tout à refaire pour migrer vers un autre modèle.

Ce n'est pas la première disruption de ce type et ce ne sera pas la dernière. Le marché des LLM
est structurellement instable : chaque lab pivote, chaque modèle est remplacé, les APIs changent,
les pricing basculent. **Une équipe dépendante d'un modèle spécifique porte un risque systémique.**

## Comment la posture model-agnostic aurait mitigé l'impact

AIAD étant model-agnostic par conception, une équipe AIAD aurait pu migrer sans refonte
structurelle :

1. **Les Intent Statements et SPECs ne contiennent pas de prompts propriétaires** — ce sont des
   spécifications en langage naturel structuré, lisibles par n'importe quel modèle.
2. **L'Execution Gate évalue la SPEC, pas le modèle** — un SQS 4/5 reste valide quel que soit
   l'agent qui va l'exécuter.
3. **Le AGENT-GUIDE encode les conventions du projet, pas les particularités d'un modèle** — pas
   de prompt engineering spécifique à un vendor.

**La disruption Llama se serait réduite à une mise à jour de configuration** (quel modèle appeler),
pas à une refonte de la gouvernance.

## Les 3 pratiques AIAD qui implémentent le model-agnosticism

| Pratique | Mécanisme | Bénéfice en cas de disruption |
|---|---|---|
| **Intent Statement** | Artefact en langage naturel structuré | Porte l'intention, pas le prompt — migrable |
| **Execution Gate (SQS)** | Critères indépendants du modèle | La gate reste valide après migration |
| **AGENT-GUIDE** | Contexte projet, conventions, règles | Réinjectables dans n'importe quel agent |

## Le contexte de marché amplifie l'argument

Tous les grands labs proposent maintenant des harnesses propriétaires (Routines, Symphony, Kiro,
Agent Space). Ces outils sont puissants — et chacun crée une dépendance : si vous construisez
votre gouvernance *dans* l'outil d'un vendor, vous migrez cette gouvernance avec le reste quand
vous changez de provider.

**AIAD étant un meta-framework indépendant**, sa gouvernance (Intent Statements, SPECs, SQS,
Drift Lock) survit aux changements de modèle ET aux changements d'outil d'orchestration.

**Formulation courte** : "Avec AIAD, changer de modèle ou d'outil ne remet pas en cause
votre gouvernance — elle est dans vos artefacts, pas dans votre provider."

## Liens internes

- Vue d'ensemble governance gap : [`governance-gap-2026.md`](./governance-gap-2026.md)
- Comparaison Kiro : [`aiad-vs-kiro-autonomie.md`](./aiad-vs-kiro-autonomie.md)
