# Légitimation empirique de l'Execution Gate et de Human Authorship

**Version 1.1 — Novembre 2026 (v1.0 : juin 2026) — Steeve Evers**
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

Cette réserve porte sur les sections 2 à 5. **La section 7 ci-dessous a été vérifiée sur les sources primaires le 12 novembre 2026** ; chaque source y est donnée avec sa nature et ses limites.

---

## 7. Compléments de novembre 2026 — ce qui fait qu'une porte tient *(v1.10)*

Les sections précédentes défendent l'existence d'un point de contrôle humain. Les sources de l'automne 2026 déplacent la question : une porte existe, mais **tient-elle** ? Elles décrivent quatre façons dont elle cède, et une façon de la graduer.

### 7.1 La porte de théâtre, et la supervision graduée par le risque

**Source :** Thoughtworks Technology Radar, Vol. 35, 4 novembre 2026. Avis d'un cabinet de conseil fondé sur ses missions ; pas une étude.

- **« Human-in-the-loop theater » — *Caution*.** « Human-in-the-loop theater is keeping a human in an agent's loop as an empty approval step rather than a real check. » L'humain approuve des prompts ou des diffs qu'il ne peut pas réellement évaluer ; l'approbation devient un « accountability sink ».
- **« Risk-tiered human oversight » — *Trial*.** Trois niveaux : « The riskiest or hardest-to-reverse changes are reserved for humans to apply » ; un niveau intermédiaire relu par un humain ; et, pour le reste : « Low-risk changes can be auto-merged by coding agents through a continuous integration pipeline. » Le tri se fait en marquant des fichiers ou répertoires sensibles, ou par une classification de l'impact confiée à un modèle.

**Ce que cela appuie.** La graduation de la supervision par classe de réversibilité (guide du framework, § 5.4).

**Limites et contre-indices.** Le Radar prévient que la classification par un modèle est faillible et ne doit pas être utilisée seule : AIAD fait déclarer la classe par un humain dans le Critère de Drift, ce qui est plus lent. Et contre la porte de théâtre, le Radar recommande de réserver la revue humaine à ce qu'une personne peut réellement juger, et de piloter le reste par des vérifications automatiques (tests par mutation, tests de propriétés, modèles formels, revue sémantique assistée) : c'est un argument pour **moins** de portes, mieux placées.

### 7.2 Le contrôle jugé par le modèle qu'il contraint

**Source 1 :** R. F. Abdo et P. C. Brom (Institut fédéral de Brasília), « A Gated Spec-Driven Workflow: An Audit-Trail Study of Coding-Agent Work », arXiv 2611.05094, 3 novembre 2026. **Étude de cas** sur les journaux de neuf fonctionnalités dans sept projets, tous menés par les auteurs avec leur propre workflow sous Claude Code. Preprint, non relu par les pairs.

- Cinq fonctionnalités sur neuf menées à terme ; 288 tâches sur 581 réalisées.
- L'exécuteur est resté dans ses fichiers déclarés : un seul changement non déclaré, détecté par le contrôle.
- L'orchestrateur, « which runs and judges its own checks », a relevé des changements non déclarés dans 11 contrôles de bloc sur 247 et n'a arrêté le travail que quatre fois. Conclusion des auteurs : « almost every control is an instruction carried out by the same model that it constrains ».

**Nuances indispensables.** Sur les onze écarts, six venaient d'un client de synchronisation de fichiers, un de caches de compilation, un d'une commande de vérification et trois de modifications demandées par les auteurs eux-mêmes : la plupart étaient bénins. Les auteurs écrivent : « Without a control condition, no result supports a causal claim about what the controls prevented. » L'étude montre *où* un tel dispositif est fragile, pas *combien* il protège. Elle note aussi que les approbations humaines dérivent : une réponse ambiguë a été traitée comme un consentement, et les auteurs ont fini par donner un ordre permanent de continuer sans demander.

**Source 2 :** Cannavale, De Lucia, Palomba et al. (Université de Salerne, Gran Sasso Science Institute), « Specification-Driven Governance for Fairness-by-Design », arXiv 2611.03231, 2 novembre 2026. **Expérience contrôlée** : 48 exécutions (quatre formulations de la demande, trois agents de code, quatre jeux de données), avec GitHub Spec Kit. Preprint, non relu par les pairs.

- Sur les douze exécutions où l'exigence d'équité est entièrement explicitée, 97,22 % des éléments attendus se retrouvent dans la spécification et 82,41 % dans le code.
- Les modèles produits ne sont pas significativement plus équitables. L'équité y est appliquée « as a post-hoc audit that neither shapes training nor prevents model delivery » ; la spécification rend l'exigence « traceable, but not enforceable ».

**Limites.** Onze blocs de comparaison seulement : des effets faibles ou modérés peuvent passer inaperçus. Agents réglés en faible effort de raisonnement. Les auteurs n'excluent pas qu'une exigence d'application explicite change le résultat.

**Ce que cela appuie.** La distinction entre contrôle *appliqué* et contrôle *déclaratif*, et la *clause d'échec* de la SPEC (guide du framework, § 5.4 et § 4.4). **Ce que cela coûte à la thèse AIAD :** ces deux études portent sur des workflows par spécification proches du SDD Mode, et aucune n'en démontre le bénéfice. La seconde montre qu'une spécification presque complète peut ne rien changer au résultat.

### 7.3 L'approbation mémorisée, écrite par un tiers, ou jamais configurée

**Source 1 — approbation mémorisée :** Apiiro, billet du 5 novembre 2026 (mis à jour le 8). **Scan d'un éditeur de sécurité, non audité** ; aucun secret n'a été testé.

- 104 185 copies publiques de `.claude/settings.local.json` trouvées sur GitHub (branches par défaut, 1er – 3 novembre 2026).
- 1 122 de ces fichiers (1,1 %) contiennent ce que l'éditeur classe comme un secret réel, soit 1 379 secrets distincts.
- En ajoutant l'historique git, les réglages partagés et les transcriptions de sessions : 2 539 secrets distincts dans 1 994 dépôts.
- 215 des 1 122 fichiers (environ 19 %) n'étaient signalés ni par gitleaks ni par TruffleHog.
- Mécanisme : répondre « Yes, and don't ask again » enregistre la commande approuvée telle quelle, secret compris.

*Réponse de l'éditeur de l'outil* (Boris Cherny, équipe Claude Code, Hacker News, 7 novembre 2026) : le fichier ne doit pas être versionné, l'outil l'ajoute aux exclusions git lors de sa création, et l'équipe étudie un scan de secrets. D'après la documentation et Apiiro, cette exclusion est inscrite dans la liste globale du poste, pas dans le `.gitignore` du dépôt : elle ne couvre ni les autres clones ni un fichier déjà suivi.

**Source 2 — approbation écrite par un tiers :** issue publique n° 14370 du support de Postman, ouverte le 25 octobre 2026. **Signalement d'un seul utilisateur, non reproduit indépendamment.** Il décrit l'installation automatique d'un plugin Claude Code, d'un plugin Codex et d'un serveur MCP, et constate qu'un enregistrement de confiance existe pour le hook de démarrage installé — en reconnaissant que cet enregistrement seul ne prouve pas qui l'a créé. Postman a répondu le 5 novembre : « we are reverting this change », en indiquant que le lot était mentionné lors du téléchargement, ce qu'un commentateur conteste.

**Source 3 — approbation jamais configurée :** Yao et al. (chercheurs indépendants), « When Neither Side Confirms », arXiv 2611.02527, 2 novembre 2026. **Mesure par analyse statique** de 1 000 dépôts du registre MCP et de 41 hosts et SDK d'agents open source (25 applications, 16 SDK), plus une expérience d'injection. Preprint, non relu par les pairs.

- Environ 90 % des outils destructifs n'ont aucune confirmation côté serveur (estimation, intervalle de confiance à 95 % : 82 – 95 %).
- 32 des 41 hosts et SDK n'ont aucune étape d'approbation par défaut, dont 16 des 25 applications.
- Pour les 25 applications, 60,7 % des paires outil destructif / application ne sont soumises par défaut à aucune approbation humaine.
- Quatre des cinq modèles à bas coût testés ont exécuté une suppression injectée dans 479 exécutions sur 960.
- « Applications should therefore configure approval. » Selon les auteurs, demander systématiquement l'approbation côté application ramènerait la part non approuvée de 60,7 % à 5,4 %.

**Limite essentielle, dite par les auteurs :** « We count whether a blocking human decision exists, not whether users read it. » L'étude mesure la présence d'une porte, pas son efficacité.

**Ce que cela appuie.** Les règles « une approbation persistée est un artefact de gouvernance » et « approbation des actions destructives configurée côté application » (guide du framework, § 3.3).

**Contre-indice de fond.** Dans le premier cas, c'est la porte d'approbation elle-même qui a produit la fuite. Et l'éditeur de l'outil soutient que la fatigue d'approbation rend le mode automatique « significantly safer than manual approval in practice » — affirmation d'éditeur, non étayée dans la discussion, mais qui rejoint la critique de la porte de théâtre. La conclusion d'AIAD n'est pas « plus d'approbations » : c'est **moins d'approbations, toutes tracées, et aucune qui dure sans relecture**.

### 7.4 Le consentement global de session

**Source :** journal des modifications officiel de Kiro CLI 2.24.0, 23 septembre 2026. « Run `/tools trust-all` to automatically approve tool calls for the rest of the current V3 session. » Par défaut, l'outil affiche un avertissement de sécurité et demande confirmation ; l'éditeur recommande de ne l'activer que dans un environnement de confiance.

**Portée.** Un réglage légitime dans un environnement jetable. Ce n'est pas un acte du continuum d'autorité : il n'est ni spécifique, ni borné par la classe de réversibilité, ni tracé action par action (guide du framework, § 4.4).

### 7.5 La porte humaine devient mesurable — avec des instruments imparfaits

- **GitHub, 5 novembre 2026 (journal des modifications officiel).** L'API de métriques d'usage expose un objet `copilot_code_review` par dépôt et par jour, dont le champ `total_merged_no_human_change_request_after_review` : le nombre de pull requests fusionnées, relues par la revue automatique, pour lesquelles personne n'a demandé de changement après cette revue. **Il mesure l'absence d'une demande de changement formelle, pas l'absence de revue humaine, ni une approbation, ni la qualité.**
- **Anthropic, 13 octobre 2026 (blog d'ingénierie de l'éditeur, chiffre interne non audité).** « In May 2026, Anthropic averaged around 2,500 code changes merged per day; as of September, we merged over 30,000 per day. » L'unité n'est pas définie, et l'article ne dit pas quelle part est relue par un humain.
- **Faros AI, juillet 2025 (télémétrie d'un éditeur sur ses clients : plus de 10 000 développeurs, 1 255 équipes ; corrélation, pas causalité).** Les équipes à forte adoption de l'IA fusionnent 98 % de pull requests en plus, et leur temps de revue augmente de 91 %. Le même rapport ne trouve aucune corrélation significative entre adoption de l'IA et amélioration au niveau de l'entreprise. Données antérieures à la génération actuelle d'agents.

**Ce que cela appuie.** Les trois indicateurs de l'annexe E.13 : la porte humaine peut se mesurer par classe de risque. **Ce que cela n'appuie pas :** aucune de ces sources ne fonde les valeurs de seuil retenues par AIAD, qui restent des valeurs de départ à calibrer.

### 7.6 Synthèse de la section

| Façon dont la porte cède | Source | Nature de la source | Règle AIAD |
|---|---|---|---|
| Approbation vide | Radar Vol. 35 | Avis de praticiens | Porte réelle : critère vérifié, auteur identifié, refus possible |
| Contrôle jugé par le modèle contraint | arXiv 2611.05094 | Étude de cas des auteurs sur leur propre outil, preprint | Contrôle appliqué hors du modèle pour l'irréversible |
| Exigence traçable mais non appliquée | arXiv 2611.03231 | Expérience contrôlée, preprint | Clause d'échec dans la SPEC |
| Approbation mémorisée | Apiiro | Scan d'éditeur, non audité | Portée, auteur, durée de vie ; hors dépôt ; relecture |
| Approbation écrite par un tiers | Issue Postman n° 14370 | Signalement d'un utilisateur | Approbation invalide si l'humain ne l'a pas écrite |
| Approbation jamais configurée | arXiv 2611.02527 | Analyse statique, preprint | Approbation des actions destructives côté application |
| Consentement global de session | Changelog Kiro CLI 2.24.0 | Page officielle | « Ce qui n'est pas un gate » |

Aucune de ces sources n'est une étude relue par les pairs. Elles convergent sur un mécanisme — une porte ne vaut que par ce qui l'exécute et par qui la tient — et ne mesurent pas le bénéfice d'un dispositif comme celui d'AIAD. C'est une orientation raisonnable, pas une démonstration.

---

## Liens croisés

- [Argumentaire — Dette de maintenance agentique](https://github.com/everssteeve/sdd-mode/blob/main/docs/legitimation/dette-maintenance-agentique.md)
- Argumentaire — Governance Gap 2026

---

*Dossier de légitimation empirique — Framework AIAD v1.10 — Novembre 2026 (v1.0 : juin 2026)*
*Gardien : Steeve Evers — aiad.ovh — Open Source*
