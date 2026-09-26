# Légitimation empirique de l'Execution Gate et de Human Authorship

**Version 1.0 — Juin 2026 — Steeve Evers**
Framework AIAD — Dossier de légitimation empirique — aiad.ovh — Open Source

> Ce document est un dossier de preuves, pas un argumentaire commercial. Il synthétise des éléments externes rapportés par la veille du framework de mai 2026. Les identifiants arXiv, chiffres et noms d'outils sont consignés tels que rapportés et doivent être revérifiés avant toute citation externe formelle (voir [Note de fiabilité](#6-note-de-fiabilité)).

---

## 1. Introduction

L'**Execution Gate** (point de contrôle entre une SPEC validée et le lancement de l'agent de code, exigeant un SQS ≥ 4/5) et la valeur **Human Authorship** (7ème valeur fondatrice : la paternité de l'intention ne se délègue pas) ont été conçues comme des choix de conception du framework AIAD — des positions, en partie philosophiques, sur la place de l'humain dans le cycle de développement agentique.

La thèse de ce document est la suivante : **en mai 2026, ces deux principes cessent d'être de simples choix de conception pour devenir des réponses documentées à un consensus empirique émergent.** Trois types de preuves indépendants convergent dans une même fenêtre temporelle :

1. la **recherche académique**, qui mesure un biais d'action des agents IA justifiant un point de contrôle pré-exécution ;
2. les **données de terrain à grande échelle**, qui montrent que l'autorité de décision finale reste humaine ;
3. l'**outillage de référence**, qui implémente déjà spontanément des mécanismes de contrôle humain.

Cette convergence — académique, terrain, outillage — est rare. Elle ne prouve pas qu'AIAD a raison ; elle montre que l'Execution Gate et Human Authorship sont alignés avec ce que le reste de l'écosystème mesure, observe et construit indépendamment.

---

## 2. Preuve 1 — Le biais d'action des agents (35–65 %)

**Source rapportée :** FixedBench, arXiv 2605.07769 (veille du framework, mai 2026).

Des études documentent que les agents IA de pointe (SOTA) présentent un **biais d'action de 35 à 65 %** : placés devant une situation, ils tendent à agir — à modifier, corriger, ajouter — même lorsque l'action n'est pas requise, voire lorsqu'elle est contre-productive. Le biais ne porte pas sur la qualité de l'action une fois décidée, mais sur la **propension à agir plutôt qu'à s'abstenir**.

**Conséquence pour AIAD.** Ce biais est exactement la défaillance que l'Execution Gate adresse. Si un agent tend structurellement à agir, alors le risque n'est pas seulement qu'il agisse mal, mais qu'il agisse **avant que l'intention humaine ait été correctement formalisée et contrôlée**. Un point de contrôle humain placé *en amont* de l'exécution — et non une code review *en aval* — n'est donc pas une précaution excessive : c'est une réponse directe et proportionnée à un biais mesuré. L'exigence d'un SQS ≥ 4/5 avant ouverture de la Gate revient à interposer une décision humaine d'abstention/autorisation là où l'agent, livré à lui-même, agirait par défaut.

---

## 3. Preuve 2 — L'autorité de fusion reste humaine (29 585 PRs)

**Source rapportée :** analyse de 29 585 cycles de pull requests, arXiv 2605.08017 (veille du framework, mai 2026).

Cette analyse à grande échelle montre que l'autorité de merge/fusion reste **« presque exclusivement humaine »**. Environ **1 PR sur 5** implique un agent IA dans la production du code, mais la **décision finale d'intégration** — celle qui engage le produit — demeure prise par un humain.

**Conséquence pour AIAD.** Ce résultat déplace Human Authorship du registre de la valeur normative vers celui de la **pratique observée**. Là où AIAD affirme que « la paternité de l'intention ne se délègue pas », les données montrent qu'à grande échelle, dans le monde réel, **les équipes ne délèguent déjà pas la décision d'intégration**, quelle que soit l'ampleur de la contribution agentique en amont. Human Authorship ne décrit donc pas un idéal à atteindre mais formalise et nomme une frontière que la pratique trace spontanément. À noter : la preuve porte sur l'autorité de *fusion* (aval) ; AIAD étend cette logique à l'autorité d'*intention* (amont, via l'Intent Statement) — une extension cohérente avec la preuve, mais non strictement démontrée par elle.

---

## 4. Preuve 3 — L'outillage de référence implémente déjà la porte

**Sources rapportées :** mécanisme `hard_deny` de Claude Code ; « Trust Layer » de GitHub (veille du framework, mai 2026).

Les outils leaders du développement assisté par agents intègrent désormais des mécanismes de contrôle humain sur l'action agentique :

- **`hard_deny` (Claude Code)** — refus dur de certaines actions agent : une catégorie d'opérations ne peut tout simplement pas être exécutée par l'agent sans intervention, indépendamment de sa proposition.
- **« Trust Layer » (GitHub)** — couche de confiance interposée entre la contribution agentique et son intégration.

**Conséquence pour AIAD.** L'industrie **outille spontanément** ce que l'Execution Gate formalise comme rituel. Quand l'écosystème converge, sans coordination, vers des points de contrôle humains intégrés au flux agentique, cela indique que le besoin n'est pas théorique mais opérationnel. L'Execution Gate se distingue toutefois de ces mécanismes par sa nature : `hard_deny` et le Trust Layer sont des contrôles *techniques sur l'action* ; l'Execution Gate est un contrôle *humain sur l'intention* (qualité de la SPEC via le SQS, Test de l'Étranger, préparation du Context Engineering Budget). AIAD formalise au niveau du processus ce que l'outillage implémente au niveau de la mécanique.

---

## 5. Synthèse

| Preuve | Source rapportée | Principe AIAD légitimé |
|---|---|---|
| Biais d'action des agents SOTA (35–65 %) | FixedBench — arXiv 2605.07769 | **Execution Gate** : un contrôle humain *avant* exécution répond à un biais mesuré |
| Autorité de fusion presque exclusivement humaine (29 585 PRs, ~1 PR/5 implique un agent) | arXiv 2605.08017 | **Human Authorship** : la non-délégation de la décision finale est la pratique observée |
| Mécanismes de contrôle humain intégrés (`hard_deny`, Trust Layer) | Claude Code ; GitHub | **Execution Gate** : l'industrie outille spontanément le point de contrôle |

**Conclusion.** La force de ce dossier ne tient pas à une preuve isolée mais à leur **convergence dans une fenêtre temporelle unique**. Une validation venue simultanément de la recherche académique (ce que les agents *font*), des données de terrain (ce que les équipes *décident*) et de l'outillage de référence (ce que l'industrie *construit*) est inhabituelle. Elle fait passer l'Execution Gate et Human Authorship d'un choix de conception défendable à une **réponse documentée à un consensus empirique émergent**. AIAD n'a pas inventé ce besoin : il l'a formalisé en rituel (Gate) et en valeur (Authorship) avant que les preuves ne s'accumulent — ce qui en fait, à ce stade, une anticipation cohérente plutôt qu'une déduction des preuves.

---

## 6. Note de fiabilité

Les identifiants arXiv (2605.07769, 2605.08017), les chiffres (biais d'action 35–65 %, 29 585 PRs, ~1 PR sur 5) et les noms de mécanismes outillés (`hard_deny`, « Trust Layer ») sont **issus de la veille du framework de mai 2026** et sont consignés ici tels que rapportés. Ils n'ont pas fait l'objet d'une vérification primaire dans le cadre de ce dossier. **Avant tout usage public, citation formelle ou diffusion externe, chaque référence doit être revérifiée à la source** (lecture de l'article original, vérification de l'identifiant et des chiffres, confirmation de l'existence et du périmètre des mécanismes outillés). Tant que cette vérification n'est pas faite, ce document conserve un statut de note de travail interne.

---

## Liens croisés

- Argumentaire — Dette de maintenance agentique
- Argumentaire — Governance Gap 2026

---

*Dossier de légitimation empirique — Framework AIAD v1.0 — Juin 2026*
*Gardien : Steeve Evers — aiad.ovh — Open Source*
