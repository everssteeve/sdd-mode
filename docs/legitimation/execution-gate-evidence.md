# Execution Gate — validation empirique externe

> Document de légitimation — synthèse des preuves externes qui valident l'Execution Gate
> et le Human Authorship d'AIAD. Établi à partir du cycle de veille ALIS (mai 2026).
>
> ⚠️ Les références académiques et chiffres ci-dessous proviennent de la veille ALIS
> et **doivent être confirmés avant publication externe** (un argumentaire de légitimation
> perd toute valeur s'il cite une source inexacte).

## En une phrase

L'**Execution Gate** (SQS ≥ 4/5 avant tout lancement d'agent) et le **Human Authorship**
ne sont plus des choix philosophiques propres à AIAD : ce sont des réponses à un **consensus
empirique** documenté indépendamment par la recherche, les données terrain et l'outillage des
grands fournisseurs en 2026.

## Preuve 1 — Le biais d'action des agents (35–65 %)

Les agents de code SOTA présentent un **biais d'action** : ils tendent à *agir* (écrire,
modifier, exécuter) plutôt qu'à s'arrêter, demander ou refuser, même lorsque l'arrêt serait
le bon comportement. Les mesures rapportées situent ce biais entre **35 % et 65 %** selon les
tâches.

- Source : *FixedBench* — arXiv, mai 2026 *(réf. exacte à confirmer : arXiv 2605.07769)*.
- **Lecture AIAD** : c'est exactement le risque que l'Execution Gate neutralise. En exigeant
  une SPEC validée (SQS ≥ 4/5) **avant** l'exécution, AIAD impose un point d'arrêt structurel
  là où l'agent, laissé à lui-même, agirait par défaut.

## Preuve 2 — L'autorité de fusion reste humaine (29 585 PR)

L'analyse d'un large corpus de pull requests impliquant des agents IA montre que la **décision
de fusion** demeure « presque exclusivement humaine » : l'agent propose, l'humain dispose.

- Source : analyse de **29 585 PR** — arXiv, mai 2026 *(réf. exacte à confirmer : arXiv 2605.08017)*.
- Sur GitHub, environ **1 PR sur 5** implique désormais un agent — mais l'acte d'autorité finale
  reste porté par un humain identifiable.
- **Lecture AIAD** : c'est la définition opérationnelle du **Human Authorship**. La paternité de
  l'intention et l'autorité de fusion ne se délèguent pas — la pratique terrain observée le
  confirme à grande échelle, ce n'est pas une posture morale isolée.

## Preuve 3 — L'outillage de référence converge

Les grands fournisseurs ont inscrit le principe « l'agent ne franchit pas seul certaines
limites » dans leur outillage :

- **`hard_deny`** (Claude Code) — des actions que l'agent ne peut exécuter sans validation
  humaine explicite, quelles que soient ses instructions.
- **Trust Layer** (GitHub) — couche de contrôle humain interposée sur les contributions
  agentiques.
- **Lecture AIAD** : l'Execution Gate est l'expression *méthodologique* (indépendante de l'outil)
  de ce que ces mécanismes implémentent *techniquement*. AIAD étant model-agnostic, le principe
  survit au changement d'agent ou de fournisseur.

## Synthèse

| Principe AIAD | N'est plus… | …mais |
|---|---|---|
| **Execution Gate** | un choix philosophique | la réponse à un biais d'action de 35–65 % mesuré sur agents SOTA |
| **Human Authorship** | une valeur fondatrice isolée | la pratique observée sur 29 585 cycles de PR réels |

Citer ces convergences renforce la crédibilité scientifique du framework : l'Execution Gate
passe d'un *« on pense que »* à un *« la recherche, le terrain et l'outillage le documentent »*.

## Liens internes

- Cycle SDD et Execution Gate : [`SDDMode.md`](../../SDDMode.md) (`/sdd-gate`, `/sdd-exec`)
- Valeur 7 — Human Authorship : [`frameworkAIAD.md`](../../frameworkAIAD.md)
- Dette de maintenance agentique : [`dette-maintenance-agentique.md`](./dette-maintenance-agentique.md)

## Sources (à vérifier avant publication)

- FixedBench — biais d'action des agents (35–65 %), arXiv, mai 2026 — *réf. à confirmer*.
- Étude 29 585 PR — autorité de fusion humaine, arXiv, mai 2026 — *réf. à confirmer*.
- Documentation Claude Code (`hard_deny`) ; GitHub Trust Layer.
