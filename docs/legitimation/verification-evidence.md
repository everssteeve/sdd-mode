# Légitimation empirique de la couche Vérification — Preuves terrain 2026

**Version 1.0 — Septembre 2026 — Steeve Evers**
Framework AIAD — Dossier de légitimation empirique — aiad.ovh — Open Source

> Ce document est un dossier de preuves, pas un argumentaire commercial. Contrairement au dossier sur l'Execution Gate (juin 2026), **chaque source a été vérifiée sur son résumé ou son texte d'origine le 25 septembre 2026** (règle de vérification sur source primaire du processus d'évolution du framework). Pour chacune sont indiqués son type, son échantillon, son statut de peer review et ce qu'elle établit réellement. Un indice n'est pas une démonstration : la force de ce dossier tient à la convergence de sources indépendantes, pas à l'une d'elles prise isolément.

---

## 1. La thèse, et ce qu'elle n'est pas

**Position AIAD.** AIAD fait le pari que la qualité de la vérification dépend d'abord du **design du processus** — ce qu'on vérifie, à quel moment, par qui — et non de la puissance du modèle qui relit. Conséquence : la conversation critique a lieu à l'Execution Gate, sur la SPEC, et non en revue de pull request, sur le code.

**Ce que cette position n'est pas.** Ce n'est pas un résultat démontré. Le papier qui formule le plus directement l'hypothèse « process over capability » (Kwon, arXiv 2609.04218) écrit lui-même qu'elle « remains a hypothesis, not a result of this paper ». Les indices ci-dessous vont dans le même sens ; aucun ne suffit seul.

---

## 2. Les indices

### 2.1 La vitesse de revue ne produit pas la qualité de revue

**Source :** Zhong, Noei, Adams, Zou — « From Human-Centric to Agentic Code Review », arXiv 2607.13196 (juillet 2026). Étude empirique, **1,02 million de pull requests, 207 projets GitHub**. Preprint.

**Ce qu'elle établit.** Entre l'ère pré-LLM et l'ère des agents, le temps de revue baisse de 2,5 jours/KLOC (adoption graduelle) à 4,5 jours/KLOC (adoption rapide d'agents), sans gain de qualité de revue. Les « review smells » concernent 69 à 76 % des revues purement humaines et 78 à 94 % des schémas impliquant l'IA ; le smell *Review Buddies* (dépendance répétée aux mêmes relecteurs) passe de 16 % à 60 % (LLM) et 53 % (agents).

**Limite.** Les auteurs précisent que leurs modèles sont explicatifs, pas causaux.

**Mécanismes AIAD concernés :** Execution Gate, Drift Lock, rôle QA Engineer.

### 2.2 Face à une consigne floue, les agents devinent

**Source :** Ji et al. — « Coding Agents Are Guessing », arXiv 2607.02294 (juillet 2026). Benchmark UnderSpecBench : **2 208 variantes de consignes, 69 familles de tâches DevOps**, Claude Code, Codex et OpenCode. Preprint.

**Ce qu'elle établit.** « Underspecification does not mainly make agents fail; it makes them guess » : **55,8 à 67,8 % des exécutions violent au moins une frontière d'action**. Les indications sur le rayon d'impact réduisent à peine la propension à agir.

**Mécanismes AIAD concernés :** Intent Statement, SQS (précision, scope), Execution Gate.

### 2.3 Concevoir d'abord plutôt que tester pas à pas, en boucle agent

**Source :** Birgitta Böckeler — « TDD in the agent loop », martinfowler.com, série *Exploring Gen AI* (août 2026). Expérience exploratoire : **5 lots de tâches, 2 exécutions TDD et 2 non-TDD par lot**, logique métier en greenfield.

**Ce qu'elle établit.** Le TDD classique en boucle agent consomme **2,96 à 8,5 fois plus de tokens**, sans différence de qualité nette (jugement d'un modèle, scores de mutation sans avantage significatif). Les exécutions non-TDD et test-first produisaient toujours la conception complète (architecture, types, cas limites, contrats) avant le code ; les exécutions TDD la faisaient émerger morceau par morceau.

**Limite.** L'autrice souligne elle-même la très petite taille de l'échantillon, la simplicité des tâches et un jugement de qualité largement délégué au modèle évaluateur.

**Mécanismes AIAD concernés :** SPEC comme conception complète avant exécution ; section Verification.

### 2.4 Un protocole spec-first strict sur une grande base de code

**Source :** Joel Abenhaim — arXiv 2608.12440 (août 2026). **Étude de cas unique, rapportée par son auteur sur son propre travail.** Preprint.

**Ce qu'elle établit.** Refactoring d'une invariante architecturale dans une application TypeScript de 717 725 lignes (3 648 fichiers) : 189 fichiers modifiés, 31 passes d'audit (14 de raffinement de la spécification, 17 de vérification), **201 défauts corrigés avant toute exécution humaine**, 3 jours, 2 430 USD, plus de 1 500 pages de spécifications et de journaux publiées.

**Limite.** Cas unique, auto-rapporté, et réalisé **sans revue humaine du code généré** — ce qui en fait un indice sur la puissance du spec-first, pas un modèle de gouvernance à reproduire tel quel.

### 2.5 Séparer celui qui produit de celui qui critique

**Source :** Faizan Tanveer — arXiv 2609.04270 (septembre 2026). Preprint de 6 pages, **100 problèmes d'olympiades de mathématiques**.

**Ce qu'elle établit.** L'auto-revue par le même modèle rejette à tort **35 % de ses propres réponses correctes, contre 2 % pour un reviewer d'une autre famille** (p = 0,000015). Un reviewer cross-famille de milieu de gamme fait passer la justesse de 52 % à 64 %.

**Limite.** Domaine mathématique, pas du code : c'est un indice transposé. Le titre du papier rappelle d'ailleurs que la capacité du reviewer compte — le choix d'un reviewer d'une autre famille est un choix de design du processus, pas une preuve que la capacité est indifférente.

**Illustration outillée :** GitHub Project HydraFusion (research preview, septembre 2026), orchestration multi-fournisseurs dont un pattern *draft-with-critique* ; les gains de coût annoncés (-36 à -67 %) sont des chiffres éditeur non audités.

### 2.6 Le coût de la vérification, nommé

**Source :** Happy Bhati — « Beyond Code Generation », arXiv 2609.04681 (septembre 2026). **Synthèse de littérature** (« No new model experiment is claimed »). Preprint.

**Ce qu'elle apporte.** Un vocabulaire : la **Verification Tax** — les gains « attenuate sharply between writing code and shipping reliable software » ; revue, intégration, tests, sécurité et exploitation restent les étapes contraignantes. Aucune donnée nouvelle.

### 2.7 Gouvernance déclarée vs gouvernance réelle

**Source :** Observatoire du métier de DPO, 5ᵉ édition — ministère du Travail, AFCDP, CNIL, avec l'Afpa (résultats publiés le 3 juillet 2026).

**Ce qu'elle établit.** 70 % des organismes répondants utilisent ou prévoient d'utiliser l'IA ; **moins d'un quart disposent d'une stratégie formelle sur l'IA** ; 85 % des DPO n'ont pas suivi de formation spécifique à l'IA.

**Mécanismes AIAD concernés :** agents de gouvernance Tier 1, AIAD-AI-ACT, AIAD-RGPD.

### 2.7 bis Ne plus savoir d'où vient son code

**Source :** GitLab — AI Accountability Report (23 juin 2026). Enquête Harris Poll auprès de **1 528 développeurs et acheteurs de technologie** dans six pays.

**Ce qu'elle établit.** **43 %** des répondants ne distinguent plus de façon fiable le code généré par IA du code écrit par un humain ; **85 %** estiment que l'IA a déplacé le goulot de l'écriture vers la revue et la validation ; **34 %** des organisations ayant subi un incident n'ont pas pu déterminer si du code généré par IA en était la cause.

**Limite.** Enquête déclarative commandée par un éditeur d'outils de développement, qui vend par ailleurs des solutions de gouvernance du code.

**Mécanismes AIAD concernés :** Drift Lock et traçabilité (`/sdd trace`), trace AIAD comme élément de preuve ([dossier dédié](./responsabilite-evidence.md)).

### 2.8 Le SDD devient une offre d'intégrateur

**Source :** annonce Anthropic, 27 juillet 2026. Cognizant devient Global Premier Partner du Claude Partner Network ; son produit Flowsource comprend un module explicitement nommé **« Spec-Driven Development »**, qui « directs Claude Code using the specifications, coding standards, and architectural blueprints a project defines ».

**Portée.** Preuve de marché, pas preuve d'efficacité : le SDD passe du pattern d'outillage au service vendu aux grands comptes — ce qui rend d'autant plus nécessaire de distinguer une méthode d'exécution spec-driven d'un cadre de gouvernance de l'intention.

### 2.9 Appui philosophique — le code comme passif

**Source :** Cory Doctorow — « Canonization », *Pluralistic* (2 juillet 2026). **Essai d'opinion**, sans donnée.

**Ce qu'il apporte.** En s'appuyant sur la notion de « canonisation » de Kellan Elliott-McCrea, Doctorow distingue le code jetable (« I got it working ») du code rendu général, réutilisable et cohérent pour les équipes futures. Il soutient que l'économie de l'IA générative pousse vers le premier — « code is a liability, not an asset » — en transformant les développeurs en relecteurs chargés de « mark the AI's homework, at superhuman speed ».

**Mécanisme AIAD concerné :** Valeur 3, Sobriété Intentionnelle. Appui argumentatif, pas preuve.

---

## 3. Contre-indice — à ne pas omettre

**Source :** He, Agarwal, Denisov-Blanch, Azaletskiy, Koyejo, Vasilescu — « AI Writes Faster Than Humans Can Review », arXiv 2607.01904 (juillet 2026). Étude longitudinale : **802 développeurs, 196 212 pull requests** (janvier 2024 – avril 2026), dans une entreprise ayant fixé l'objectif de doubler les PR fusionnées par ingénieur.

**Ce qu'elle établit.** Le débit par personne atteint **2,09 fois** la référence ; la charge par relecteur double environ et la revue automatisée dépasse la revue humaine — **tandis que les taux de merge et de revert restent stables**.

**Pourquoi c'est un contre-indice.** Sur l'indicateur de qualité qu'elle mesure (les reverts), cette étude ne montre **pas** de dégradation liée à la vitesse. Elle confirme le déplacement du goulot vers la revue, pas la thèse « la vitesse dégrade la qualité ». AIAD doit la citer pour ce qu'elle dit (Valeur 2 — Honnêteté sur les Contradictions) : la question ouverte est ce que les reverts ne mesurent pas — dette, dérive d'intention, conformité.

---

## 4. Synthèse

| Indice | Source (type) | Ce qu'il appuie | Force |
|---|---|---|---|
| Revue plus rapide, pas meilleure | arXiv 2607.13196 (empirique, 1,02M PR) | Execution Gate, QA Engineer | Forte, corrélationnelle |
| Les agents devinent face au flou | arXiv 2607.02294 (benchmark, 2 208 variantes) | Intent Statement, SQS | Forte |
| Concevoir avant de coder | Böckeler (exploratoire, très petit échantillon) | SPEC comme conception complète | Faible |
| Spec-first à grande échelle | arXiv 2608.12440 (cas unique auto-rapporté) | Spec-first | Faible |
| Séparer producteur et critique | arXiv 2609.04270 (mathématiques, 100 problèmes) | Revue cross-famille | Moyenne, transposée |
| Verification Tax | arXiv 2609.04681 (synthèse) | Vocabulaire | Aucune donnée nouvelle |
| Gouvernance IA peu formalisée | Observatoire DPO (enquête) | Agents de gouvernance | Moyenne |
| Origine du code non traçable (43 %) | GitLab (enquête éditeur) | Drift Lock, SPEC comme preuve | Moyenne, déclarative |
| SDD vendu par un intégrateur | Anthropic / Cognizant (annonce) | Positionnement | Preuve de marché |
| Le code comme passif | Doctorow (essai) | Sobriété Intentionnelle | Argument, pas preuve |
| **Débit ×2 sans hausse des reverts** | arXiv 2607.01904 (longitudinal, 196k PR) | **Contre-indice** | Forte |

**Sources écartées après vérification** (suivies en veille jusqu'à la publication de résultats) : arXiv 2609.04208 (registered report sans résultats) ; l'ablation d'arXiv 2609.04218 (N = 5), dont seule la taxonomie de défauts est retenue.

---

## Liens croisés

- [Légitimation empirique de l'Execution Gate et de Human Authorship](./execution-gate-evidence.md)
- Framework AIAD — § 3.4 QA Engineer, § 5.4 Boucle Valider, § 5.5 Boucle Intégrer

---

*Dossier de légitimation empirique — Framework AIAD v1.9 — Septembre 2026*
*Gardien : Steeve Evers — aiad.ovh — Open Source*
