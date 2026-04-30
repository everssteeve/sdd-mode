# Guide AIAD — Framework v1.6

**La méthodologie de référence pour le développement produit à l'ère des agents IA.**

Version 1.6 — Mai 2026 — Steeve Evers
Framework AIAD — Artificial Intelligence Agent Development — [aiad.ovh](https://aiad.ovh) — Open Source

---

## Table des matières

1. [Préambule — Pourquoi ce guide ?](#1-préambule--pourquoi-ce-guide-)
2. [Vision et Philosophie](#2-vision-et-philosophie)
3. [L'Écosystème AIAD — Les Cinq Responsabilités](#3-lécosystème-aiad--les-cinq-responsabilités)
4. [Les Artefacts](#4-les-artefacts)
5. [Les Boucles Itératives](#5-les-boucles-itératives)
6. [Les Synchronisations Intentionnelles](#6-les-synchronisations-intentionnelles)
7. [Les Métriques et l'Amélioration Continue](#7-les-métriques-et-lamélioration-continue)

---

## 1. Préambule — Pourquoi ce guide ?

Les **agents IA** ont rendu obsolète la façon dont nous développions des logiciels. Ce n'est pas une hyperbole — c'est un constat opérationnel. Les agents savent désormais transformer une intention claire en code fonctionnel, générer des tests en parallèle, refactorer et optimiser automatiquement. Ce qui prenait des jours prend maintenant des heures. La question n'est plus "comment coder plus vite" — c'est "comment penser et orchestrer mieux".

AIAD est la réponse organisationnelle à ce changement. Ce guide n'est pas un ensemble de règles à suivre mécaniquement. C'est un cadre pour prendre de meilleures décisions : qui fait quoi, quand se réunir, quoi mesurer, et surtout comment s'assurer que l'intention humaine reste au cœur de chaque livraison.

**La différence qu'AIAD crée est visible dès la première semaine.** Avant, un Product Engineer passait trois à quatre jours sur une fonctionnalité : écriture du code, code review, corrections, tests. Avec AIAD, trente minutes de réflexion précise en amont — une spécification claire, un contexte bien configuré — permettent à l'agent de générer code et tests en dix minutes. La validation humaine prend une heure. Total : deux heures. La différence n'est pas la vitesse : c'est la nature du travail.

**Trois erreurs fréquentes tuent cette promesse dans l'œuf.** La première : croire que l'IA fait juste coder plus vite. Résultat — on génère plus de code médiocre, plus rapidement, et la dette technique explose. La deuxième : penser qu'il suffit d'ajouter des agents à un framework existant. Résultat — friction permanente entre la vélocité des agents et la rigidité des cadences artificielles. La troisième : croire qu'un agent sans contexte produit du code de qualité. Résultat — code générique, incohérent, que le PE passe son temps à corriger manuellement.

AIAD résout les trois. Il repositionne la valeur humaine là où elle est irremplaçable : l'intention, la décision, la validation. Il donne aux agents le contexte dont ils ont besoin pour performer. Et il remplace les cadences artificielles par des boucles itératives fluides, calquées sur la complexité réelle du travail.

Un praticien qui lit ce guide entièrement peut démarrer en une semaine. La maîtrise vient en trois mois. Ce guide est son seul référentiel.

---

## 2. Vision et Philosophie

### Définition

La philosophie d'AIAD tient en une phrase : **AIAD ne juge pas sur l'effort, la vélocité ou la conformité aux processus. AIAD juge sur la valeur réalisée pour les stakeholders.** Tout le reste en découle.

### Pourquoi cette clarté est nécessaire

Sans définition explicite de ce que signifie "réussir", les équipes optimisent les mauvaises métriques. Une fonctionnalité techniquement parfaite que personne n'utilise est un échec. Un cycle complété à 100 % sans impact mesurable est un échec. Une livraison partielle qui résout le problème réel est un succès. AIAD énonce cela sans ambiguïté pour éviter que l'équipe ne confonde activité et valeur.

**Exemple concret :** une équipe livre un système de notifications push en trois semaines. Code propre, tests complets, documentation exhaustive. Résultat : 2 % des utilisateurs activent les notifications. Avant de construire, l'équipe aurait dû valider l'hypothèse "les utilisateurs veulent des notifications push" par un test simple — un bouton factice, une enquête, un prototype. Coût : deux jours. Économie : trois semaines.

### Les quatre piliers

**L'empirisme radical** est le premier pilier. Dans un contexte de développement assisté par IA, la vélocité d'exécution rend les plans obsolètes avant leur complétion. Tout est une hypothèse jusqu'à preuve du contraire. Les données et usages réels priment sur les intuitions. Pivoter rapidement vaut mieux que persévérer dans l'erreur. Maximiser la vitesse d'apprentissage compte plus que maximiser la vitesse de production. L'anti-pattern classique : "On sait ce que veulent nos utilisateurs, on travaille avec eux depuis cinq ans." Les besoins évoluent. Les certitudes d'hier sont les échecs de demain.

**L'orchestration systémique** est le deuxième pilier. La valeur d'une équipe ne réside plus dans sa capacité à coder, mais dans sa capacité à orchestrer des agents IA efficacement. Les humains définissent le pourquoi et le quoi — l'intention et la validation. Les agents prennent en charge le comment — la génération de code, de tests, de documentation. Former un développeur expert améliore la performance d'une personne de 20 %. Configurer correctement l'AGENT-GUIDE améliore la performance de toute l'équipe de 50 %. L'investissement optimal est évident. L'anti-pattern : "Notre meilleur dev n'a pas besoin des agents, il code plus vite manuellement." Peut-être. Mais son temps serait mieux investi à configurer l'écosystème pour les dix autres.

**La fluidité par émergence** est le troisième pilier. Les cadences artificielles — cycles de durée fixe — créent une friction avec la vélocité naturelle du développement assisté par IA. AIAD substitue aux cycles prescrits un flux continu ajusté à la complexité réelle. Une tâche simple (correction de bug) s'accomplit en deux heures. Une tâche complexe (nouvelle fonctionnalité) prend trois jours. Une exploration (nouveau domaine) prend une semaine. Chaque tâche trouve sa cadence naturelle. L'anti-pattern : "On garde nos cycles mais on fait de l'AIAD dedans." Vous aurez le pire des deux mondes : rigidité plus confusion.

**L'Excellence Intentionnelle** est le quatrième pilier. Livrer du code n'est pas l'objectif. Réaliser une intention digne de la valeur investie l'est. Le mot "intentionnelle" ancre ce pilier sur ce que seul l'humain peut apporter dans un système d'orchestration IA : l'agent peut contribuer à l'excellence technique, il ne peut pas porter l'intention. La question centrale n'est plus seulement "les fonctionnalités atteignent-elles leurs critères d'outcome ?" mais "les critères d'outcome eux-mêmes reflètent-ils une intention digne de la valeur investie ?" L'**Atelier d'Intention** mensuel est le mécanisme qui vérifie cet alignement. L'anti-pattern : "On livre d'abord, on améliorera après si besoin." "Après" n'arrive jamais.

*Ancrage constitutionnel de l'Excellence Intentionnelle : Valeur 1 (Primauté de l'Intention Humaine), Valeur 3 (Sobriété Intentionnelle), Article I (Raison d'être).*

### Les trois principes fondateurs de l'orchestration

**La spécification comme invariant vivant.** Une spécification n'est pas un document de passage. C'est un invariant vivant qui reste la source de vérité entre l'intention humaine et le code généré, avant, pendant et après l'implémentation. Le code évolue — la spécification évolue avec lui. Une spécification est "done" quand elle reflète exactement l'état du code en production. Tant que ce n'est pas le cas, l'itération n'est pas terminée. Conséquence directe : le **spec drift** — l'écart entre spécification et réalité du code — est l'anti-pattern numéro un d'AIAD, non un problème mineur de documentation.

**Le drift comme échec de Definition of Done.** Le spec drift n'est pas un problème d'IA — c'est un échec de processus humain. Quand le code évolue sans que la spécification soit mise à jour, l'artefact devient de la documentation morte. La prochaine session avec l'agent repart d'une intention incorrecte. Après une itération : spécification légèrement désalignée, corrections mineures. Après cinq itérations : spécification obsolète, l'agent génère du code conflictuel. Après vingt itérations : spécification inutilisable, retour au codage sans cadre de facto. La règle est non-négociable : toute itération qui modifie le comportement d'une fonctionnalité doit mettre à jour la spécification correspondante dans la même session.

**Le Context Budget comme discipline d'orchestration.** Les études terrain (Addy Osmani, janvier 2026 ; Anthropic, mars 2026) montrent que les agents IA dégradent leur adhérence aux instructions quand le contexte injecté dépasse un certain seuil. Un AGENT-GUIDE de cent pages n'est pas plus efficace — il est moins efficace. Ce phénomène, le **context rot**, désigne la dégradation de la qualité LLM bien avant la limite théorique de la fenêtre de contexte. Le **Product Engineer** est responsable de ne pas saturer le **Context Engineering Budget** de l'agent. La hiérarchie des artefacts AIAD (PRD → ARCHITECTURE → AGENT-GUIDE → SPEC) est précisément l'outil pour gérer ce budget : le contexte permanent (standards, conventions, patterns) va dans l'AGENT-GUIDE ; le contexte de tâche (fonctionnalité en cours) va dans la SPEC activée uniquement pour la session ; le contexte stratégique (vision, outcomes) va dans un PRD synthétique en référence. Injecter tout dans chaque session est l'anti-pattern principal : l'agent reçoit tout, comprend peu.

*Note : Anthropic a formalisé en mars 2026 le Context Engineering comme discipline à part entière, distincte du prompt engineering — "l'art et la science de curating ce qui entre dans la fenêtre de contexte limitée à partir d'un univers en constante évolution d'informations possibles". Le Context Budget AIAD est une implémentation opérationnelle de cette discipline.*

### Les sept valeurs fondatrices

AIAD repose sur sept valeurs fondatrices, immuables et non-négociables. Elles ne sont pas des aspirations — elles sont constitutives du framework.

**1. Primauté de l'Intention Humaine.** L'intention de ce qu'on construit reste le domaine exclusif de l'humain. L'agent exécute. Il ne décide pas de ce qui mérite d'être construit.

**2. Honnêteté sur les Contradictions.** Quand les contraintes s'opposent, AIAD dit la vérité sur les trade-offs plutôt que de promettre l'impossible.

**3. Sobriété Intentionnelle.** On construit ce qui est nécessaire, pas ce qui est impressionnant. Chaque fonctionnalité doit se justifier par une intention claire.

**4. Ouverture Radicale.** AIAD est open source. Le savoir méthodologique se partage, il ne se verrouille pas. Les pratiques, outils et retours d'expérience sont publiés sur [aiad.ovh](https://aiad.ovh). La transparence est une condition de l'amélioration collective.

**5. Empirisme sans Concession.** On valide les hypothèses par l'observation, pas par le consensus. Une équipe AIAD ne prend pas de décision sur la foi d'une intuition quand une mesure est possible.

**6. Responsabilité Partagée.** Le succès et l'échec appartiennent à l'équipe, pas à un individu. Les responsabilités sont claires — la culpabilisation ne l'est jamais.

**7. Human Authorship.** La paternité de l'intention ne se délègue pas à l'agent. Tout **Intent Statement** doit être rédigé en première personne par un humain. L'agent peut enrichir, questionner, affiner. Il ne peut pas initier. Si un agent a rédigé l'Intent Statement, la session est invalidée. L'Execution Gate ne peut pas être passé sans un Intent Statement dont l'auteur est humain et identifiable.

*Ancrage constitutionnel : Valeur 1 de l'Article II de la Constitution AIAD v1.0.*

Ces sept valeurs forment un système. En retirer une fait s'effondrer l'ensemble.

### Positionnement dans l'écosystème des outils SDD (v1.6)

AIAD intègre les meilleures pratiques SDD (Kiro, GitHub Spec-Kit, SPDD) en leur ajoutant la dimension organisationnelle et humaine. Cette phrase résume le positionnement du framework dans un écosystème en rapide évolution.

**Les outils gèrent le "comment faire avec les agents"** — Kiro (Amazon), GitHub Spec-Kit, SPDD et son REASONS Canvas, OpenAI Symphony : ces outils s'attachent à la production de spécifications ou à l'orchestration d'agents dans un flux individuel ou équipe. Ils sont utiles, souvent complémentaires, et évoluent rapidement.

**AIAD gère le "comment travailler en équipe humain-IA"** — il opère à un niveau supérieur : qui porte quelle responsabilité, comment valider que l'intention reste intacte, comment mesurer la valeur réelle livrée, et comment maintenir la gouvernance réglementaire. AIAD est un meta-framework : il peut intégrer ces outils comme implémentations de sa couche spec.

**Relation avec SPDD :** Le REASONS Canvas de SPDD constitue une approche optionnelle et enrichissante pour la phase de rédaction de SPEC (`/sdd-spec`). SPDD = couche méthode de production de spec. AIAD = couche gouvernance du cycle complet.

**Relation avec OpenAI Symphony :** Symphony et les Intent Statements AIAD convergent sur le concept d'artefact d'intention persistant pour ancrer les agents. La différence clé : Symphony est issue-tracker-first, sans critères qualité formels. AIAD enrichit ce concept avec le SQS, le Drift Lock et la gouvernance réglementaire. Les Intent Statements AIAD peuvent pointer vers des issues Jira/GitHub tout en existant comme artefacts indépendants avec leur propre cycle de vie.

**Validations industrielles 2026 :** Anthropic formalise en mars 2026 le Context Engineering comme discipline à part entière — AIAD l'implémente opérationnellement depuis v1.3. Thoughtworks Radar 2026 identifie des concepts convergents (Context Engineering, Harness Engineering, Spec-Driven Development). R2Code (arXiv, avril 2026) valide empiriquement le spec-first : −41,7 % de tokens et +7,4 % de fidélité sur le code généré. Ces convergences ne sont pas des suivis — elles sont des validations indépendantes d'une approche antérieure. Voir `GLOSSAIRE-AIAD.md` pour les définitions précises des concepts clés.

---

### Anti-patterns de vision

"On mesure déjà la vélocité, c'est pareil." La vélocité mesure l'output — les unités livrées. L'outcome est la valeur créée. Une équipe peut livrer des fonctionnalités inutiles à grande vitesse. AIAD mesure l'adoption, l'usage, la satisfaction — pas les points.

"L'empirisme, c'est ne pas planifier." Confusion entre "pas de plan" et "plan adaptatif". AIAD donne une direction (North Star), des objectifs (Outcomes), et des hypothèses à valider. Ce qu'il n'a pas, c'est un plan détaillé à six mois figé.

"Les piliers sont indépendants, on en prend deux sur quatre." Les piliers forment un système. Sans l'empirisme, on construit les mauvaises choses. Sans l'orchestration, on construit lentement et mal. Sans la fluidité, on crée de la friction et du gaspillage. Sans l'Excellence Intentionnelle, on livre du code, pas une intention réalisée.

---

## 3. L'Écosystème AIAD — Les Cinq Responsabilités

### Définition

Dans AIAD, il n'y a pas de "rôles" au sens traditionnel — une personne, un titre, des frontières rigides. Il y a des **responsabilités** qui doivent être assumées. Une responsabilité est définie par ce qui doit être fait, pas par un organigramme. Dans une équipe de trois personnes, un membre peut assumer deux ou trois responsabilités simultanément. Dans une équipe de huit, chaque responsabilité peut avoir un porteur dédié. L'important n'est pas qui porte quel titre — c'est que chaque responsabilité soit clairement assumée par quelqu'un.

### Pourquoi cette approche existe

Les rôles rigides créent trois problèmes. Ils produisent du "ce n'est pas mon job" qui laisse des responsabilités orphelines. Ils créent des frontières qui ralentissent la prise de décision. Et ils découragent l'adaptabilité contextuelle que les équipes hybrides humains/IA requièrent. AIAD remplace les frontières rigides par une responsabilité fluide selon le contexte.

---

### 3.1 Product Manager — Responsable de la Valeur

**Définition.** Le **Product Manager** s'assure que l'équipe construit les bonnes choses pour les bonnes personnes. Sa question centrale : construit-on la bonne chose ?

**Pourquoi cette responsabilité existe.** Sans quelqu'un focalisé exclusivement sur la valeur, les équipes construisent des fonctionnalités techniquement parfaites que personne n'utilise. Le PM est le gardien des outcomes.

**Comment.** Le PM définit le Product Goal (horizon de quatre à douze semaines) mensuellement, maintient le backlog ordonné par valeur en continu, conduit la discovery (problème → solution → validation) hebdomadairement, et définit les Outcome Criteria de chaque fonctionnalité. Après chaque release, il mesure l'impact réel. Quatre compétences sont non-négociables : la stratégie produit (savoir où on va et pourquoi), la discovery (identifier le vrai problème avant de construire), l'analytics (mesurer ce qui compte, décider sur des données), et la maîtrise des trade-offs (arbitrer entre court et long terme). Les indicateurs de succès : plus de 70 % des fonctionnalités atteignent leurs Outcome Criteria, et le délai entre insight utilisateur et release est inférieur à deux semaines.

**Anti-pattern.** Le PM "passe-plat" qui transmet les demandes des stakeholders sans les challenger ni les prioriser. Il n'est pas un secrétaire de la direction — il est responsable de la valeur.

---

### 3.2 Product Engineer — Gardien de l'Intention

**Définition.** Le **Product Engineer** est le gardien de l'intention tout au long du cycle de développement. Il orchestre des agents IA pour réaliser l'intention sans la trahir. Sa responsabilité ne s'arrête pas au merge — il veille à ce que l'intention reste intacte tout au long du processus, y compris après la livraison.

**Pourquoi cette responsabilité existe.** Les agents IA savent générer du code. Ils ne savent pas définir ce qu'il faut construire ni valider si c'est correct. Le PE fait le pont. Sa valeur n'est pas dans sa capacité à orchestrer — qui peut se standardiser — mais dans sa capacité à protéger l'intention, qui ne peut pas être déléguée.

*Ancrage constitutionnel : Valeur 1 (Primauté de l'Intention Humaine), Article II (Human Authorship), Article III (Vision des Ruptures).*

**Comment.** Le PE rédige des spécifications techniques précises (par fonctionnalité), orchestre les agents pour générer le code (quotidiennement), valide la qualité du code généré (post-génération), maintient le contexte (AGENT-GUIDE, patterns) en continu, et gère la dette technique. Quatre compétences sont non-négociables : l'orchestration d'agents (formuler des intentions claires, structurer le contexte), l'architecture (penser système, anticiper les implications), le quality thinking (définir "Done", penser aux cas limites), et le product thinking (comprendre le pourquoi, pas juste le comment). Les indicateurs de succès : first-time success rate supérieur à 70 %, ratio code généré/manuel supérieur à 80/20, couverture de tests supérieure à 80 % backend et 70 % frontend, et taux d'alignement intention/livraison supérieur à 80 % (évalué lors de l'Atelier d'Intention).

**Anti-pattern.** Le PE qui réécrit systématiquement le code des agents au lieu d'améliorer ses spécifications et son contexte. Ce comportement est le symptôme d'un problème en amont, pas une solution.

---

### 3.3 Agents Engineer — Responsable de l'Écosystème IA

**Définition.** L'**Agents Engineer** construit et optimise l'écosystème d'agents qui démultiplie les capacités de l'équipe. Sa question centrale : l'écosystème est-il optimal ?

**Pourquoi cette responsabilité existe.** Un agent mal configuré produit du code générique. Un écosystème bien calibré produit du code adapté au contexte. La différence réside entièrement dans l'investissement en configuration.

**Comment.** L'AE sélectionne les agents pertinents (mensuellement), les configure et calibre (initialement, puis de façon itérative), définit la gouvernance (supervision, validation) à l'initialisation, forme l'équipe à l'utilisation efficace en continu, monitore les performances hebdomadairement, et expérimente avec de nouveaux agents chaque mois.

L'écosystème d'agents est structuré en niveaux d'autorité. Au **Niveau 0**, la Gouvernance Réglementaire (v1.5) : les AGENT-GUIdes réglementaires injectés dans chaque session de développement impliquant un domaine régulé. Ces guides ont un droit de veto absolu sur tout code non conforme.

| AGENT-GUIDE | Référentiel | Scope |
|-------------|-------------|-------|
| **AIAD-AI-ACT** | Règlement (UE) 2024/1689 — EU AI Act | Classification risque, obligations par niveau, calendrier d'application (complète le 2 août 2026) |
| **AIAD-RGPD** | RGPD (UE) 2016/679 | Privacy by Design, minimisation données, bases légales, droits des personnes |
| **AIAD-RGAA** | RGAA 4.1 / WCAG 2.1 | Accessibilité numérique, obligations légales françaises |
| **AIAD-RGESN** | RGESN | Écoconception de services numériques, sobriété computationnelle |

Ces guides s'activent selon le contexte du projet : un projet traitant des données personnelles active AIAD-RGPD ; un projet impliquant un composant IA en contexte européen active AIAD-AI-ACT. Le principe Human Authorship constitue une réponse directe aux exigences de supervision humaine imposées par l'AI Act pour les systèmes à haut risque.

Au **Niveau 1**, la Gouvernance (sécurité, conformité, architecture) : droit de veto sur le code généré. Au **Niveau 2**, la Qualité (tests, code review, performance) : avertissements et recommandations. Au **Niveau 3**, la Productivité (documentation, refactoring, migration) : suggestions d'amélioration. À la base, l'Agent Principal (Claude Code, Cursor, Copilot) : génération de code.

La sélection suit quatre principes : commencer minimal (agent principal + sécurité + qualité), ajouter par douleur (un problème récurrent justifie un nouvel agent), retirer par obsolescence (un agent non utilisé depuis un mois est supprimé), et optimiser par mesure (suivre l'usage et l'efficacité réelle). Les indicateurs de succès : taux d'adoption supérieur à 90 %, taux de faux positifs inférieur à 20 %, satisfaction PE sur l'écosystème supérieure à 8/10.

**Harness Engineering — La pratique centrale de l'AE (v1.6).** Le terme "Harness Engineering" désigne l'ensemble des pratiques de configuration, supervision et gouvernance des agents IA que l'AE met en œuvre. Il couvre : la sélection et le paramétrage des agents, la définition de leurs périmètres d'autorisation (**minimal necessary permissions** — un agent n'a accès qu'aux ressources strictement nécessaires à sa mission), la surveillance de leur comportement en production, et l'adaptation continue de l'écosystème. Ce vocabulaire est convergent avec les pratiques de l'industrie (Thoughtworks Radar 2026) et positionne l'AE comme un métier à part entière.

La **gouvernance sécurité des agents** est une dimension non-négociable du Harness Engineering : chaque agent configuré dans l'écosystème AIAD doit opérer selon le principe de moindre privilège. Un agent de génération de code n'a pas besoin d'accès aux systèmes de production. Un agent de documentation n'a pas besoin d'accès au registre des secrets. Cette gouvernance est le pendant technique de la valeur Human Authorship : on ne délègue pas la supervision des accès critiques à l'agent.

*Ancrage constitutionnel : Valeur 7 (Human Authorship) — la gouvernance sécurité des agents est l'expression technique du principe de supervision humaine, convergente avec les exigences de l'AI Act (Art. 14).*

**Anti-pattern.** L'AE qui accumule des agents "au cas où" sans mesurer leur utilité réelle, ou qui configure des agents avec des permissions larges "pour simplifier". Plus d'agents ne signifie pas plus d'efficacité — et des permissions non restreintes sont un risque de gouvernance.

---

### 3.4 QA Engineer — Responsable de la Qualité

**Définition.** Le **QA Engineer** garantit que la qualité est intégrée dès le départ, pas vérifiée à la fin. Sa question centrale : le résultat est-il fiable ?

**Pourquoi cette responsabilité existe.** Les agents génèrent des tests, mais ils ne savent pas penser comme un utilisateur frustré ni anticiper les cas limites métier. La qualité built-in requiert une intelligence humaine que l'agent ne peut pas remplacer.

**Comment.** Le QA définit la stratégie de tests globale (initialement, puis revue trimestrielle), contribue au Definition of Done par fonctionnalité, valide la pertinence des tests générés post-génération, conduit les tests exploratoires pré-release, et mesure et communique la qualité hebdomadairement.

La validation s'organise en quatre niveaux. Les tests unitaires (agents IA + PE) : 100 % automatisés. Les tests d'intégration (PE + Agent Quality) : 90 % automatisés. Les tests fonctionnels (QA + Agent Quality) : 70 % automatisés. Les tests exploratoires (QA humain) : 0 % automatisés. Ce dernier niveau reste 100 % humain pour une raison simple : un agent suit des scénarios. Un humain trouve ce qui ne va pas en dehors des scénarios prévus.

Les indicateurs de succès : bugs en production en tendance décroissante, temps de détection d'un bug inférieur à 24 h, taux de régression inférieur à 5 %.

**Anti-pattern.** Le QA qui teste uniquement à la fin du cycle au lieu de contribuer à la définition de "Done" dès le départ. Cette pratique transforme la qualité en goulot d'étranglement.

---

### 3.5 Tech Lead — Responsable de la Cohérence Technique

**Définition.** Le **Tech Lead** garantit que les décisions techniques d'aujourd'hui ne bloquent pas les évolutions de demain. Sa question centrale : le système reste-t-il cohérent ?

**Pourquoi cette responsabilité existe.** Sans vision technique long-terme, chaque fonctionnalité est optimisée localement mais le système global devient incohérent. La dette technique s'accumule invisiblement.

**Comment.** Le Tech Lead définit et maintient le document ARCHITECTURE, valide les décisions architecturales majeures à la demande, conduit les design reviews par fonctionnalité majeure, établit les standards de qualité à l'initialisation, gère la dette technique en continu (visibilité et priorisation), et coache les PE sur les sujets complexes.

Son périmètre de décision est clairement délimité. Sur les décisions stratégiques (architecture globale, choix de stack) : il décide avec l'input de l'équipe. Sur les décisions tactiques (patterns, librairies) : il guide, l'équipe décide. Sur les décisions opérationnelles (implémentation spécifique) : il n'intervient pas. Les indicateurs de succès : dette technique stable ou décroissante, décisions architecturales revisitées inférieures à 10 % par an, temps de design review inférieur à deux heures.

**Anti-pattern.** Le Tech Lead "super développeur" qui code plus qu'il ne guide, créant un goulot d'étranglement. Son rôle est de multiplier l'efficacité de l'équipe, pas de concentrer la production sur lui.

---

### 3.6 Les Supporters

Les **Supporters** sont des stakeholders qui créent les conditions de succès de l'équipe sans faire partie de son quotidien. Ils créent un environnement psychologiquement sûr pour que l'équipe ose expérimenter et échouer. Ils lèvent les obstacles organisationnels qui bloquent le flux. Ils facilitent l'accès aux ressources. Ce qu'ils ne font pas : définir le backlog (c'est le PM), valider les décisions techniques (c'est le Tech Lead), participer aux synchronisations quotidiennes.

---

### 3.7 Combiner les responsabilités

La taille de l'équipe détermine comment les responsabilités se distribuent — pas comment elles s'exercent. Dans une équipe de deux à trois personnes, une personne assume typiquement PM et Tech Lead, une autre PE, QA et AE. Dans une équipe de quatre à six personnes, PM, QA et AE peuvent être portés par des personnes distinctes, avec des PE qui doublent sur Tech Lead et AE. Au-delà de sept personnes, chaque responsabilité peut avoir un porteur dédié.

**La règle d'or :** quelle que soit la taille de l'équipe, chaque responsabilité doit avoir un porteur clairement identifié.

### Anti-patterns d'écosystème

"On n'a pas besoin d'Agents Engineer, chacun gère ses agents." Résultat : chaque PE configure différemment, l'écosystème devient incohérent, les bonnes pratiques ne se partagent pas. Même à temps partiel, quelqu'un doit avoir la vision globale.

"Le Tech Lead décide de tout ce qui est technique." Résultat : goulot d'étranglement, PE déresponsabilisés, frustration générale. Le Tech Lead guide les décisions stratégiques. Les décisions opérationnelles appartiennent aux PE.

"Le PM n'a pas besoin de comprendre la technique." Résultat : trade-offs mal arbitrés, fonctionnalités impossibles promises, dette technique ignorée. Le PM n'a pas besoin de coder, mais il doit comprendre les implications techniques de ses décisions.

---

## 4. Les Artefacts

### Définition

Les **artefacts AIAD** ne sont pas de la bureaucratie. Ce sont des outils de pensée et de communication. Ils rendent visible ce qui resterait implicite, alignent l'équipe sur une compréhension partagée, et fournissent aux agents IA le contexte dont ils ont besoin pour performer. Un bon artefact est actionnable (peut-on agir à partir de ce document ?), vivant (évolue-t-il avec la compréhension ?), minimal (contient-il juste assez, pas plus ?), et collaboratif (a-t-il été co-créé, pas dicté ?).

L'important n'est pas d'avoir des documents parfaits — c'est d'avoir des documents utiles.

### Pourquoi les artefacts sont indispensables

Sans artefacts, le contexte se perd à chaque changement de session. Les agents IA produisent du code générique sans AGENT-GUIDE, du code incohérent sans ARCHITECTURE, et du code incorrect sans SPEC. L'alignement entre intention et implémentation se dégrade silencieusement. Les artefacts sont la mémoire collective de l'équipe et le carburant de l'écosystème d'agents.

---

### 4.0 Intent Statement — Artefact de Premier Ordre (v1.5)

**Définition.** L'**Intent Statement** capture et archive l'intention humaine derrière chaque fonctionnalité, indépendamment de la spécification qui en découle. C'est un artefact de premier ordre : il précède et transcende la SPEC.

**Pourquoi cet artefact existe.** Dans six mois, quand une fonctionnalité est contestée ou doit être révisée, la question essentielle n'est pas "qu'est-ce que la SPEC dit ?" mais "qu'est-ce que l'équipe voulait accomplir et pourquoi ?". La SPEC répond à la première question. L'Intent Statement archivé répond à la seconde. Sans cet archivage, l'intention se perd dans le bruit des itérations — c'est l'une des causes profondes de la dette intentionnelle.

*Ancrage constitutionnel : Valeur 5 (Empirisme sans Concession), Article VII (mécanisme d'évolution du framework).*

**Comment.** L'Intent Statement comprend cinq champs obligatoires.

```markdown
## Intent Statement — [ID] — [Titre]

**Auteur humain :** [Prénom Nom] — [Date]

**POURQUOI MAINTENANT**
Qu'est-ce qui a changé dans le monde, dans le produit, ou dans la compréhension
de l'équipe pour que cette fonctionnalité soit nécessaire aujourd'hui ?

**POUR QUI**
Quel humain va voir sa vie changer, et comment ? Soyez précis sur la personne,
pas sur le persona.

**OBJECTIF**
Ce qu'on cherche à accomplir — formulé en termes d'impact, pas de fonctionnalité.

**CONTRAINTES**
Ce qu'on ne sacrifiera pas — valeurs, qualité, éthique, ressources.

**CRITERE DE DRIFT**
Comment saura-t-on, dans 3 mois, si l'implémentation a trahi l'intention initiale ?
```

Le cinquième champ — le **CRITERE DE DRIFT** — ancre la vérification de fin d'itération non plus uniquement sur une vérification technique (le code correspond-il à la SPEC ?) mais sur une vérification d'intention (l'implémentation reflète-t-elle ce que l'humain voulait vraiment ?).

La **règle Human Authorship** : le champ *Auteur humain* est obligatoire et rempli délibérément — jamais automatiquement. Cette friction minuscule est intentionnelle : elle marque le moment de l'appropriation.

Les Intent Statements sont archivés dans `.aiad/intents/`. La structure complète du répertoire AIAD est la suivante :

```
.aiad/
├── PRD.md
├── ARCHITECTURE.md
├── AGENT-GUIDE.md
├── intents/
│   ├── _index.md
│   ├── INTENT-001-[nom].md
│   └── archive/
├── specs/
│   ├── _index.md
│   └── SPEC-001-[nom].md
└── CHANGELOG-ARTEFACTS.md
```

Les indicateurs de succès : Intent Statements archivés pour 100 % des fonctionnalités majeures, taux d'alignement intention/livraison supérieur à 80 % (Atelier d'Intention), et auteur humain identifiable sur chaque Intent Statement à 100 %.

**Anti-pattern.** Demander à l'agent de "proposer un Intent Statement" pour gagner du temps. Si l'agent l'a rédigé, la session est invalidée.

---

### 4.1 PRD — Product Requirement Document

**Définition.** Le **PRD** clarifie pourquoi et quoi construire avant de se poser la question du comment. C'est le document de référence de la valeur attendue.

**Pourquoi cet artefact existe.** Sans PRD, les équipes construisent des fonctionnalités techniquement parfaites que personne n'a demandées, ou résolvent des problèmes mal compris.

**Comment.** Le PRD contient le contexte et le problème (quel problème, pour qui, pourquoi maintenant), les Outcome Criteria (métriques mesurables de succès), les personas et use cases (profils utilisateurs et scénarios d'usage), le hors périmètre (ce que l'équipe ne fait pas volontairement), les trade-offs et décisions (décisions majeures et alternatives écartées), et les dépendances et risques (prérequis et risques identifiés).

Cinq bonnes pratiques sont non-négociables. Commencer par le problème, pas par la solution. Définir les critères de succès avant de construire (approche outcome-driven). Le rédiger avec l'équipe, pas pour l'équipe. Le maintenir vivant — il évolue avec la compréhension. Et intégrer des wireframes et flows quand pertinent. Les indicateurs de succès : 100 % des membres comprennent le "pourquoi", changements de scope inférieurs à 20 %, et Outcome Criteria atteints pour plus de 70 % des fonctionnalités.

**Anti-pattern.** Le PRD fleuve de cinquante pages que personne ne lit, ou le PRD vague type "Améliorer l'expérience utilisateur". Les deux sont inutiles.


---

### 4.2 ARCHITECTURE — Standards Techniques

**Définition.** Le document **ARCHITECTURE** définit les standards techniques que les agents IA et les PE doivent respecter. C'est le référentiel de cohérence de l'équipe.

**Pourquoi cet artefact existe.** Sans document d'architecture, chaque fonctionnalité est implémentée différemment, les agents IA génèrent du code incohérent, et la dette technique s'accumule silencieusement.

**Comment.** Le document ARCHITECTURE contient les principes architecturaux (cinq principes non-négociables), la vue d'ensemble (architecture high-level avec justification), le stack technique (technologies, versions, justifications), la structure du projet (organisation des dossiers et modules), les conventions de code (nommage, formatage, imports), les patterns et bonnes pratiques (design patterns avec exemples), la sécurité (principes et pratiques obligatoires), la performance (budgets et stratégies), et les ADR (Architecture Decision Records).

Cinq bonnes pratiques guident la rédaction : rendre le document évolutif (l'architecture évolue avec le produit), justifier chaque choix (la rationale est explicite), rester pragmatique (YAGNI, pas d'over-engineering), le rendre visuel (diagrammes, pas que du texte), et le garder actionnable (les PE s'y réfèrent quotidiennement). Les indicateurs de succès : décisions architecturales revisitées à moins de 10 % par an, code généré conforme aux standards à plus de 90 %, et temps d'onboarding technique inférieur à une semaine.

**Anti-pattern.** L'architecture "ivory tower" décidée sans connaître la réalité du terrain, ou le CV-driven development qui choisit des technos pour impressionner plutôt que pour résoudre.


---

### 4.3 AGENT-GUIDE — Contexte pour les Agents IA

**Définition.** L'**AGENT-GUIDE** fournit le contexte optimal aux agents IA pour qu'ils génèrent du code de qualité aligné avec les standards de l'équipe. C'est le document le plus opérationnel du framework.

**Pourquoi cet artefact existe.** Un agent sans contexte génère du code générique. Un agent avec un contexte riche génère du code professionnel adapté au projet. L'écart de qualité est considérable — et entièrement sous contrôle de l'équipe.

**Comment.** L'AGENT-GUIDE contient l'identité du projet (nom, description, domaine métier, mission), la documentation de référence (liens vers PRD, ARCHITECTURE, SPECs), le stack technique (résumé des technologies utilisées), les règles absolues (TOUJOURS et JAMAIS), les conventions de code (nommage, imports, structure composants), le vocabulaire métier (termes spécifiques au domaine), les patterns de développement (approches favorisées avec exemples), les anti-patterns (ce qu'il faut éviter avec exemples), et deux sections d'apprentissage spécifiques : **Lessons Learned** et **Human Learnings**.

**La section Lessons Learned** est un rituel obligatoire à chaque fin d'itération. Elle documente les erreurs récurrentes de l'agent pour éviter qu'elles se reproduisent d'une session à l'autre. La règle : à la fin de chaque itération, le PE vérifie s'il y a une erreur agent à documenter. Cinq minutes. Pas optionnel. Exemple de structure :

| Date | Contexte de l'erreur | Comportement observé | Correction appliquée | Statut |
|------|---------------------|---------------------|---------------------|--------|
| 2026-02-01 | Génération service auth | Import circulaire créé | Expliciter l'ordre d'import dans la SPEC | ✅ Résolu |

**La section Human Learnings (v1.5)** est le pendant des Lessons Learned : elle documente non pas les défaillances de l'agent, mais les défaillances de l'intention humaine. Les Lessons Learned posent la question "qu'est-ce que l'agent a mal fait ?". Les Human Learnings posent la question complémentaire : "qu'est-ce que l'humain a mal exprimé ?" Elle est maintenue par le PE et/ou le PM, et revue lors de l'Atelier d'Intention mensuel.

*Ancrage constitutionnel : Valeur 5 (Empirisme sans Concession) — si on observe et révise les outputs de l'agent, on observe aussi les processus d'intention humaine.*

Cinq bonnes pratiques guident la rédaction : rester concret (exemples de code, pas juste principes abstraits), tenir la section Notes d'Apprentissage à jour en continu, inclure le vocabulaire métier spécifique au domaine, maintenir l'équilibre (ne pas dépasser le Context Budget — un guide de cent règles est moins efficace qu'un guide de dix règles bien choisies), et le réviser mensuellement au minimum. Les indicateurs de succès : first-time success rate du code généré supérieur à 70 %, conformité aux conventions supérieure à 90 %, et temps de correction post-génération inférieur à 20 % du temps total.

**Anti-pattern.** Le guide encyclopédique de cinquante pages jamais mis à jour, ou le guide vague type "Écrire du bon code". L'AGENT-GUIDE doit être le document le plus lu par l'agent — et donc le plus ciblé.


---

### 4.4 SPECS — Spécifications Techniques

**Définition.** Une **SPEC** fait le pont entre l'intention métier (PRD) et l'implémentation concrète par les agents IA. C'est l'instruction de travail de l'agent pour une fonctionnalité donnée.

**Pourquoi cet artefact existe.** Une SPEC de qualité permet à un agent IA de générer 80 %+ du code correct du premier coup. Sans SPEC, le PE passe plus de temps à corriger qu'à orchestrer. La SPEC est l'investissement au meilleur ROI du framework.

**Comment.** Une SPEC contient le scope d'activation (injectée seule ou combinée avec d'autres SPECs — préciser), le contexte (référence Intent Statement parent, objectif, outcome attendu), le périmètre (in scope et out of scope explicites), les fichiers impactés (à créer ou à modifier), l'interface technique (API endpoints, types, schémas DB), le comportement détaillé (flow nominal et cas limites), les règles de validation (avec schémas), les règles métier (à appliquer), les tests attendus (scénarios à implémenter), les exemples d'usage (concrets, requête/réponse), la Definition of Done (critères de "Done"), et le Critère de Drift (règle concrète pour détecter si cette SPEC est devenue obsolète).

**Quatre critères définissent une SPEC de qualité.** L'atomicité : une seule responsabilité fonctionnelle, pas un module entier. La précision : "Retourner 400 si title vide ou supérieur à 200 caractères", pas "Gérer les erreurs". La testabilité : "Accepter test@example.com, rejeter invalid", pas "Tester la validation". La complétude : types, validation, edge cases, tests inclus.

**Le Spec Quality Score** est une checklist en cinq points que le PE valide avant de soumettre une SPEC à un agent. Atomicité (une seule responsabilité fonctionnelle ?), interfaces précises (types et signatures explicites, sans "retourner un objet" vague ?), testabilité (cas de test inclus et liés aux Outcome Criteria du PRD ?), non-ambiguïté (zéro adverbe vague — correctement, convenablement, rapidement ?), et scope défini (fichiers impactés exhaustifs et Critère de Drift renseigné ?). Une SPEC qui ne passe pas le Spec Quality Score ne doit pas être soumise à l'agent. Corriger prend dix minutes. Corriger le code généré sur une mauvaise SPEC prend des heures.

**Le Critère 6 — Test de l'Étranger (v1.5, non-scorable)** est un sixième critère ajouté à la checklist. Il ne bloque pas l'**Execution Gate** si la réponse est négative, mais il doit être posé, et la réponse doit être documentée dans la SPEC avant de continuer. La question : *"Si je montrais cette SPEC à quelqu'un qui ne connaît pas le projet, saurait-il pourquoi on la fait ?"* Répondre en deux phrases maximum. Si ce n'est pas possible, le contexte humain est insuffisant. La réponse s'intègre dans la SPEC :

```markdown
## Contexte pour un lecteur extérieur
[Deux phrases. Rédigées par un humain. Avant l'Execution Gate.]
```

*Ancrage constitutionnel : Valeur 1 (Primauté de l'Intention Humaine), Article VIII (transparence). Ce critère traduit le principe Feynman : on ne comprend vraiment quelque chose que quand on peut l'expliquer simplement.*

Si vous ne pouvez pas remplir ce champ, revenez à l'Intent Statement avant de continuer.

Le champ *Scope d'Activation* indique si cette SPEC doit être injectée seule (par défaut) ou en combinaison avec d'autres SPECs (cas des fonctionnalités transverses). Mélanger le contexte permanent de l'AGENT-GUIDE avec des SPECs multiples non reliées sature le budget de contexte de l'agent. Le champ *Critère de Drift* est une règle concrète pour détecter si cette SPEC est devenue obsolète. Exemple : "Cette SPEC est en drift si le fichier `auth/validator.ts` est modifié sans mise à jour de la section Interface Technique."

Les indicateurs de succès : code généré correct du premier coup supérieur à 80 %, ratio temps de rédaction SPEC versus correction code supérieur à 1:3, et moins de deux questions de clarification par SPEC.

**Anti-pattern.** La SPEC tentaculaire avec vingt fonctionnalités, ou la SPEC vague type "Améliorer la performance". Les deux sont inutilisables.


---

### 4.5 Les Definitions of Done

**La Definition of Output Done (DoOD)** établit le standard de qualité uniforme pour qu'un incrément soit considéré comme "Done" et livrable. Sans DoOD partagée, "Done" signifie quelque chose de différent pour chaque membre de l'équipe.

Les critères s'organisent en six catégories : techniques (conventions respectées, linting OK, types complets, tests passants), sécurité (scan passé, pas de secrets, validation inputs), performance (budgets respectés, queries optimisées), fonctionnels (SPEC respectée, acceptance criteria validés), déploiement (build réussit, déployé en staging, smoke tests OK), et review (code review faite, QA validé). Le principe est non-négociable : une fonctionnalité n'est "Done" que si TOUS les critères sont satisfaits. "Done à 90 %" n'est pas Done.

**La Definition of Outcome Done (DoOuD)** mesure si la valeur attendue a été réalisée pour les stakeholders. L'output est le moyen. L'outcome est le but. Une fonctionnalité livrée mais non adoptée n'est pas un succès. Les métriques se distribuent en trois catégories : User Outcomes (NPS, CSAT, adoption, time to value, retention), Business Outcomes (MRR, conversions, efficacité opérationnelle), et Learning Outcomes (hypothèses validées ou invalidées, insights découverts). Le process de mesure suit cinq étapes : définir les outcomes avant de construire, mesurer à des jalons définis (une semaine, un mois, trois mois), comparer attendu versus réalisé, décider (continuer, itérer ou sunset), et documenter les learnings.


---

### Anti-patterns des artefacts

"On n'a pas le temps de rédiger des SPECs." Résultat : le PE passe 80 % de son temps à corriger le code généré au lieu de 20 %. Une heure de SPEC bien rédigée économise plusieurs heures de correction. Ce n'est pas une contrainte — c'est un investissement à rendement élevé.

"Notre AGENT-GUIDE fait cent pages." Conséquence directe d'un Context Budget dépassé : l'agent ignore la plupart des règles. Un guide concis et priorisé est plus efficace qu'une encyclopédie. L'AGENT-GUIDE pour le contexte permanent, la SPEC pour le contexte de tâche. Ne jamais mélanger les deux.

"La SPEC est validée, on ne la touche plus." Le code évolue, la SPEC reste figée. C'est le spec drift. En cinq itérations, la SPEC est obsolète et l'agent travaille sur une base erronée. Toute modification du comportement d'une fonctionnalité impose une mise à jour immédiate de la SPEC dans la même session. Sans exception.

---

## 5. Les Boucles Itératives

### Définition

Les **boucles itératives** AIAD sont les cycles naturels de création de valeur. Elles ne sont pas des cycles prescrits à durée fixe — ce sont des boucles dont la durée est dictée par la complexité réelle du travail. Une correction de bug : deux heures. Une nouvelle fonctionnalité : trois jours. Une exploration de domaine : une semaine. Chaque tâche trouve sa cadence naturelle.

Quatre caractéristiques définissent une boucle : flux continu (dès qu'une fonctionnalité est intégrée, la prochaine démarre), durée variable (la complexité dicte la durée, pas le calendrier), priorité dynamique (le feedback peut réorienter la prochaine fonctionnalité), et focus absolu (une seule fonctionnalité à la fois par PE).

### Pourquoi les boucles remplacent les cycles prescrits

Les cycles de durée fixe créent une friction artificielle avec la vélocité naturelle du développement assisté par IA. Ils imposent une cadence indépendante de la complexité, ce qui produit soit du surengagement (trop pour une boucle), soit du rembourrage (trop peu). Les boucles AIAD éliminent cette friction en calquant le rythme sur la réalité.

L'important n'est pas de suivre un calendrier — c'est de livrer de la valeur en continu.

---

### 5.1 La phase d'initialisation

**Définition.** La phase d'initialisation pose les fondations avant de construire. Elle n'a lieu qu'une fois par produit, ou à chaque pivot majeur.

**Pourquoi cette phase existe.** Sans initialisation structurée, les équipes démarrent dans le flou. Les agents IA génèrent du code sans contexte, l'architecture émerge par accident, et la dette technique s'accumule dès le premier jour.

**Comment.** La phase d'initialisation produit sept livrables : la vision produit et le Product Goal (PM), le PRD initial (PM), le document ARCHITECTURE (Tech Lead), l'AGENT-GUIDE (AE + PE), les Definitions of Done DoOD et DoOuD (équipe), le repository avec CI/CD (PE), et la première SPEC prête (PM + PE). L'équipe doit pouvoir démarrer l'implémentation entre le cinquième et le septième jour, avec tous les artefacts essentiels en place.

**Anti-pattern.** L'initialisation qui s'éternise pendant des semaines — aucun artefact n'est parfait au départ. Ou le démarrage précipité sans artefacts — les premières semaines coûtent des mois de dette.


---

### 5.2 Boucle 1 : Planifier

**Définition.** La boucle Planifier transforme une intention métier en spécification que les agents IA peuvent implémenter.

**Pourquoi cette boucle existe.** Sans planification explicite, le PE interprète l'intention du PM. Cette interprétation diverge. Le code livré ne correspond pas au besoin.

**Comment.** La boucle se déroule en cinq étapes : le PM présente la prochaine priorité, le PE questionne et clarifie, l'équipe prend la décision de décomposition, rédige la SPEC collaborativement, puis la valide. Ce qui déclenche la boucle : la fonctionnalité précédente est intégrée, ou une nouvelle priorité critique émerge. Ce que produit la boucle : une SPEC détaillée prête pour implémentation, les Outcome Criteria définis (si fonctionnalité majeure), et une compréhension partagée entre PM et PE.

Les indicateurs de succès : l'agent IA peut implémenter sans clarification, les tests attendus sont explicites à 100 %, et tous les cas limites sont documentés.

**Anti-pattern.** La planification marathon de quatre heures, ou la SPEC de trois lignes type "Ajouter le login". Les deux sont des anti-investissements.


---

### 5.3 Boucle 2 : Implémenter

**Définition.** La boucle Implémenter orchestre les agents IA pour transformer la SPEC en code fonctionnel.

**Pourquoi cette boucle existe.** C'est là que la valeur se matérialise. Un PE qui orchestre bien produit plus qu'une équipe traditionnelle de cinq développeurs.

**Comment.** La boucle se déroule en sept étapes. Le PE prépare le contexte (SPEC + ARCHITECTURE + AGENT-GUIDE) en respectant le Context Budget. Il demande le plan à l'agent avant de coder. Il valide en continu (compilation, linting, types). Il génère les tests. Il itère si nécessaire — maximum trois fois. Il finalise (tous les tests passent, commit local). Et il réalise la **micro-phase Sync des artefacts**.

La micro-phase Sync des artefacts dure quinze minutes. Elle est sous la responsabilité du PE. Elle n'est pas négociable. Elle pose quatre questions : la SPEC reflète-t-elle le comportement implémenté (si non, mettre à jour la SPEC) ? Le Critère de Drift de la SPEC est-il toujours valide (si les fichiers impactés ont changé, réviser) ? Une erreur agent notable a-t-elle été corrigée manuellement (si oui, documenter dans Lessons Learned) ? Une nouvelle convention a-t-elle émergé (si oui, ajouter dans les patterns de l'AGENT-GUIDE) ?

Ce que produit la boucle : code fonctionnel respectant la DoOD, tests automatisés passants, commit prêt, SPEC mise à jour si le comportement a évolué, et Lessons Learned mis à jour si une erreur agent notable a été corrigée.

Les indicateurs de succès : code correct du premier coup supérieur à 70 %, ratio code généré/manuel supérieur à 80/20, couverture de tests supérieure à 80 % backend et 70 % frontend.

**Anti-pattern.** Le PE qui corrige 80 % du code généré — c'est le signal que la SPEC ou l'AGENT-GUIDE est déficient. Ou le PE qui génère sans contexte et espère que ça marche — le résultat est prévisible.


---

### 5.4 Boucle 3 : Valider

**Définition.** La boucle Valider s'assure que le code répond aux attentes métier ET aux standards de qualité.

**Pourquoi cette boucle existe.** Le code qui compile n'est pas forcément le code qui fonctionne. Le code qui fonctionne n'est pas forcément le code qui apporte de la valeur.

**Comment.** La validation se déroule en cinq étapes avec des responsables distincts. La validation technique (PE) : CI, couverture, linting, DoOD. La validation fonctionnelle (QA) : tests, acceptance criteria. La validation utilisabilité (QA + PM) : UX, accessibilité, performance. La validation métier (PM) : intention respectée, outcomes. La décision (équipe) : VALIDÉ, CORRECTIONS ou REJET.

Ce que produit la boucle : un rapport de validation, une liste de corrections mineures si applicable, et le feu vert pour intégration.

Les indicateurs de succès : validation au premier essai supérieure à 70 %, zéro bug critique détecté, et moins de trois bugs mineurs par fonctionnalité.

**Anti-pattern.** La validation bâclée "ça a l'air de marcher", ou le ping-pong interminable entre QA et PE. Le premier crée de la dette cachée. Le second crée de la friction inutile.


---

### 5.5 Boucle 4 : Intégrer

**Définition.** La boucle Intégrer met le code en production et prépare la prochaine itération.

**Pourquoi cette boucle existe.** Le code non déployé n'a aucune valeur. Plus le délai entre merge et production est long, plus le feedback est tardif.

**Comment.** La boucle se déroule en huit étapes : revue de code (self ou peer selon criticité), pull main, résolution de conflits et tests, push, PR et CI/CD, déploiement staging puis production, vérification post-déploiement, mise à jour CHANGELOG et AGENT-GUIDE, **Anti-drift check**, et nettoyage du contexte et fermeture du ticket.

**L'Anti-drift check** dure dix minutes et est sous la responsabilité du PE. Avant de fermer le ticket, le PE répond à trois questions pour chaque SPEC utilisée dans la session. Un : le comportement livré correspond-il exactement à ce que décrit la SPEC ? Deux : les fichiers impactés listés dans la SPEC sont-ils toujours exhaustifs ? Trois (v1.5) : le CRITERE DE DRIFT de l'Intent Statement parent signale-t-il un écart entre l'intention initiale et ce qui a été livré ? Si la réponse à l'une des trois est non, mettre à jour la SPEC et éventuellement l'Intent Statement avant de fermer. La SPEC doit être committée dans le même PR que le code, dans le même **Drift Lock**.

Ce que produit la boucle : code en production, documentation mise à jour, contexte prêt pour la prochaine fonctionnalité, SPECs vérifiées et synchronisées avec la réalité du code livré (**Drift Lock** respecté), et Intent Statement archivé dans `.aiad/intents/`.

Les stratégies de déploiement disponibles : Continuous Deployment (fonctionnalités non-critiques), Staged Rollout (fonctionnalités majeures), Feature Flags (expérimentales, A/B tests), et Manual Release (critiques, compliance). La recommandation AIAD : Continuous Deployment avec Feature Flags.

Les indicateurs de succès : temps merge à production inférieur à une heure (idéal quinze minutes), taux de rollback inférieur à 5 %, et zéro downtime lors des déploiements.

**Anti-pattern.** Le code qui attend des jours avant d'être mergé, ou le déploiement manuel stressant du vendredi soir. Les deux sont des anti-patterns de gouvernance, pas de compétence.


### Anti-patterns des boucles

"On planifie tout en début de semaine." Retour au mode batch : les priorités changent mais le plan est figé. Planifier juste avant d'implémenter — le contexte est frais, les décisions sont pertinentes.

"L'implémentation prend toujours plus longtemps que prévu." SPECs insuffisantes ou contexte agent mal préparé. Investir trente minutes de plus en planification économise des heures en implémentation.

"On valide à la fin, juste avant la release." Les bugs s'accumulent, la validation devient un goulot d'étranglement. Valider chaque fonctionnalité immédiatement : le feedback rapide permet de corriger vite.

---

## 6. Les Synchronisations Intentionnelles

### Définition

Les **synchronisations** ne sont pas des cérémonies. Ce sont des moments de décision collective déclenchés par un besoin réel. AIAD substitue au calendrier imposé une discipline de synchronisation à la demande.

Sept caractéristiques définissent une synchronisation de qualité : intentionnelle (objectif clair défini avant la réunion), timeboxée (durée maximale définie et respectée), actionnable (génère des décisions et actions assignées), flexible (fréquence et format s'adaptent au contexte), orientée valeur (focus sur outcomes et apprentissage), documentée (notes disponibles pour toute l'équipe), et améliorée (feedback régulier sur son utilité).

L'important n'est pas de suivre un calendrier — c'est de se synchroniser quand c'est nécessaire.

### Pourquoi les synchronisations remplacent les cérémonies

Les cérémonies prescrites ont trois défauts : elles se tiennent même quand elles n'apportent pas de valeur, elles imposent un format rigide indépendamment du contexte, et elles créent un overhead systématique. AIAD remplace ce modèle par des synchronisations intentionnelles — ciblées, utiles, et tenues uniquement quand nécessaires.

---

### 6.0 Atelier d'Intention (v1.5)

**Définition.** L'**Atelier d'Intention** est la synchronisation fondamentale d'AIAD. Il vérifie collectivement que l'équipe est toujours en train de construire ce qu'elle voulait vraiment construire.

**Pourquoi cette sync existe.** Les autres synchronisations répondent aux questions "qu'a-t-on livré ?", "est-ce que ça marche ?", "l'architecture est-elle cohérente ?". Aucune ne demande "est-ce qu'on construit les bonnes choses pour les bonnes raisons ?" Cette question est la plus importante de toutes — et la seule que l'agent ne peut pas poser à notre place.

*Ancrage constitutionnel : Article II (Valeurs 1 et 6), Article I (rendre le développement plus humain), Article VII (décision humaine explicite à chaque cycle d'évolution).*

**Comment.** La question centrale : *Sommes-nous toujours en train de construire ce que nous voulions vraiment construire ?*

L'Atelier d'Intention se tient mensuellement, implique toute l'équipe (PM, PE, Tech Lead, QA), et dure une heure. Il peut fusionner avec la Rétrospective mensuelle, mais les questions doivent rester séparées.

Il se déroule en quatre étapes. Lecture des Intent Statements (dix minutes) : chaque PE lit à voix haute l'Intent Statement de la fonctionnalité principale livrée. Confrontation avec le réel (vingt minutes) : comparer intention déclarée versus ce qui a effectivement été livré et utilisé, sans jugement, avec curiosité. Hypothèses d'écart (vingt minutes) : pourquoi y a-t-il eu des écarts — problème d'intention, de SPEC, ou de contrainte externe ? Ces hypothèses alimentent les Human Learnings. Décision (dix minutes) : l'équipe décide collectivement si elle est toujours alignée sur les intentions du PRD, ou si une révision s'impose.

**Règle non-négociable :** les agents IA n'ont aucun rôle dans cet atelier. Pas de résumé automatique, pas d'analyse IA des écarts. C'est un espace humain pur.

Ce que produit l'atelier : Human Learnings mis à jour dans l'AGENT-GUIDE, décision d'alignement ou de révision des intentions, hypothèses d'écart documentées, et un compte-rendu minimal (trois à cinq lignes) commité dans `.aiad/`.

Les indicateurs de succès : taux d'alignement intention/livraison supérieur à 80 %, deux à cinq hypothèses d'écart documentées par session, et participation de toute l'équipe à 100 %.

**Anti-pattern.** L'Atelier d'Intention qui se transforme en revue technique ou en post-mortem de bugs. Les questions doivent rester au niveau de l'intention, pas de l'implémentation.


---

### 6.1 Synchronisation Alignement Stratégique

**Définition.** La **Synchronisation Alignement Stratégique** s'assure que l'équipe reste alignée avec la stratégie produit.

**Pourquoi cette sync existe.** Sans alignement régulier, les équipes dérivent. Le Product Goal devient obsolète, les priorités divergent de la stratégie, et l'effort se disperse.

**Comment.** Elle se déclenche mensuellement ou bi-mensuellement, quand un Product Goal est atteint, ou après un pivot stratégique. Elle implique PM, PE, Tech Lead, QA, stakeholders clés et Supporters, et dure une heure trente à deux heures.

Le déroulé : review des Outcomes (trente minutes — outcomes atteints, learnings, effets secondaires), review du Product Goal (vingt minutes — pertinence, adaptation, prochain goal), priorisation du backlog (quarante minutes — prochaines priorités et ce qu'on décide de ne pas faire), feedback des Supporters (vingt minutes — obstacles organisationnels, actions), et clôture (dix minutes — résumé des décisions, actions assignées).

Ce que produit cette sync : Product Goal validé ou adapté, Product Backlog priorisé, actions Supporters assignées, et décisions stratégiques documentées.

Les indicateurs de succès : alignement de l'équipe sur le Product Goal à 100 %, clarté cristalline sur les cinq prochaines priorités, et actions Supporters complétées à plus de 80 %.

**Anti-pattern.** La synchronisation qui devient une revue de status de trois heures, ou la réunion fantôme où personne ne prend de décision.


---

### 6.2 Demo & Feedback

**Définition.** La **Demo & Feedback** obtient du feedback direct sur les fonctionnalités livrées.

**Pourquoi cette sync existe.** Le code en production n'a de valeur que si les utilisateurs l'adoptent. Sans feedback rapide, les équipes construisent des fonctionnalités que personne n'utilise.

**Comment.** Elle se déclenche hebdomadairement, après chaque fonctionnalité majeure, ou quand du feedback est nécessaire pour décider. Elle implique PM, PE et utilisateurs/clients/stakeholders concernés, et dure trente minutes à une heure.

Le déroulé : démonstration (quinze à vingt minutes — PE montre les fonctionnalités, focus usage réel), feedback qualitatif (vingt à trente minutes — questions ouvertes, discussion), analyse des données (dix minutes — métriques d'usage si disponibles), et adaptation du backlog (dix minutes — nouvelles stories, repriorisation).

Ce que produit cette sync : feedback utilisateur documenté, nouvelles user stories si pertinent, Product Backlog repriorisé si nécessaire, et décisions d'itération ou de pivot.

Les indicateurs de succès : plus de trois insights actionnables par session, satisfaction utilisateur supérieure à 8/10, et participation des stakeholders supérieure à 70 %.

**Anti-pattern.** La démo PowerPoint sans produit réel, ou la session où seul le PM parle pendant que les utilisateurs écoutent passivement.


---

### 6.3 Tech Review

**Définition.** La **Tech Review** assure la cohérence technique et gère la dette.

**Pourquoi cette sync existe.** Sans revue technique régulière, l'architecture dérive par accident. La dette technique s'accumule invisiblement jusqu'à paralyser l'équipe.

**Comment.** Elle se déclenche mensuellement, après des changements architecturaux majeurs, ou quand la dette technique devient problématique. Elle implique Tech Lead, PE, Agents Engineer et QA si pertinent, et dure une à deux heures.

Le déroulé : review de l'architecture (trente minutes — ARCHITECTURE à jour, dérives, adaptations), review de la dette technique (trente minutes — niveau, priorités de remédiation), review de l'écosystème d'agents (trente minutes — performance, ajouts et retraits), partage des learnings (vingt minutes — nouveaux patterns, anti-patterns), et clôture (dix minutes — décisions, plan de remédiation).

Ce que produit cette sync : document ARCHITECTURE mis à jour, plan de remédiation de la dette technique, catalogue d'agents adapté, AGENT-GUIDE mis à jour, et ADR pour les décisions majeures.

**Anti-pattern.** La tech review qui devient un débat philosophique sans décision, ou la revue superficielle "tout va bien" qui ignore les vrais problèmes.


---

### 6.4 Rétrospective

**Définition.** La **Rétrospective** améliore continuellement l'efficacité et le bien-être de l'équipe.

**Pourquoi cette sync existe.** Une équipe qui ne s'améliore pas régresse. La rétrospective est le mécanisme d'apprentissage collectif qui transforme les erreurs en améliorations systémiques.

**Comment.** Elle se déclenche hebdomadairement ou bi-hebdomadairement, après un incident majeur, ou quand l'équipe sent le besoin. Elle implique toute l'équipe (PE, PM, AE, QA, Tech Lead) et dure quarante-cinq minutes à une heure.

Le déroulé : rétrospective classique (trente minutes — Start/Stop/Continue ou autre format), rétrospective IA (vingt minutes — prompts efficaces, erreurs agents, AGENT-GUIDE), amélioration du workflow (dix minutes — goulots, collaboration, synchronisations), et engagement (dix minutes — une à trois actions maximum, owners, deadlines). Les formats disponibles : Start/Stop/Continue, Mad/Sad/Glad, 4Ls (Liked/Learned/Lacked/Longed For), Sailboat, Timeline.

Ce que produit cette sync : une à trois actions d'amélioration, AGENT-GUIDE mis à jour avec les learnings, et engagement collectif sur les actions.

Les indicateurs de succès : participation équipe à 100 %, actions complétées supérieures à 80 % (vérifiées à la rétrospective suivante), satisfaction équipe supérieure à 7/10 en tendance stable ou croissante, et au moins une amélioration implémentée par rétrospective.

**Anti-pattern.** La rétrospective où tout le monde dit "ça va" sans rien changer, ou celle qui génère quinze actions dont aucune n'est jamais faite.


---

### 6.5 Standup Quotidien (Optionnel)

**Définition.** Le **Standup** est une synchronisation rapide pour aligner le travail en cours. C'est un outil, pas une obligation.

**Pourquoi cette sync existe.** Certaines équipes ont besoin de se synchroniser quotidiennement pour éviter les blocages et maintenir le flux. D'autres non. La décision appartient à l'équipe.

**Comment.** Il se déclenche quotidiennement si l'équipe le souhaite, et peut être remplacé par un standup asynchrone. Il implique les PE principalement (plus d'autres responsabilités si souhaité) et dure cinq à quinze minutes maximum.

En format synchrone, chaque membre partage en une à deux minutes maximum : sur quoi je travaille actuellement, ce que je prévois de faire aujourd'hui, et les blocages éventuels. En format asynchrone (recommandé pour les équipes distribuées), via un outil de messagerie chaque matin : hier (ce que j'ai fait), aujourd'hui (ce que je prévois), et blocages (aucun ou description).

Les indicateurs de succès : participation supérieure à 90 %, durée respectée à moins de quinze minutes, et blocages résolus dans la journée à plus de 80 %.

**Anti-patterns :** le standup de quarante-cinq minutes qui devient réunion de status, les débats techniques pendant le standup, le micro-management déguisé, et l'obligation rigide sans valeur ajoutée.


---

### Anti-patterns des synchronisations

"On fait toutes les syncs chaque semaine." Surcharge de réunions. L'équipe passe plus de temps à se synchroniser qu'à produire. Adapter la fréquence au besoin — une équipe mature peut espacer certaines syncs.

"Les syncs durent toujours plus longtemps que prévu." Pas de timebox respecté, pas d'agenda clair, discussions qui dérivent. Définir l'agenda et la durée à l'avance. Couper les discussions hors-sujet avec "On en parle après."

"Personne ne prépare les syncs." Les syncs deviennent des sessions d'improvisation inefficaces. Chaque sync a un owner qui prépare l'agenda et les inputs nécessaires.

---

## 7. Les Métriques et l'Amélioration Continue

### Définition

Les **métriques AIAD** informent les décisions — elles ne les dictent pas. La distinction est fondamentale. Dans une approche data-driven, les chiffres décident. Dans l'approche data-informed d'AIAD, les chiffres éclairent. On optimise la valeur, pas la métrique. On comprend les tendances, on ne réagit pas aux fluctuations.

Quatre caractéristiques définissent une bonne métrique : actionnable (pointe vers une amélioration concrète), compréhensible (l'équipe sait ce qu'elle mesure et pourquoi), comparable (permet de voir l'évolution dans le temps), et honnête (difficile à manipuler sans amélioration réelle).

L'important n'est pas de mesurer beaucoup — c'est de mesurer ce qui compte.

### Pourquoi les métriques sont structurées en catégories

Cinq catégories couvrent les dimensions essentielles de la performance d'une équipe AIAD. Sans cette structure, les équipes tendent à soit tout mesurer (paralysie par l'analyse), soit mesurer uniquement ce qui flatte (vanity metrics). Les cinq catégories forment un tableau de bord équilibré : productivité, qualité, efficacité IA, outcomes, et équipe.

---

### 7.1 Catégorie 1 : Productivité

La productivité mesure la capacité de l'équipe à livrer de la valeur rapidement. Sans visibilité sur le flux de livraison, impossible de détecter les goulots d'étranglement.

| Métrique | Cible | Fréquence |
|----------|-------|-----------|
| **Cycle Time** (PLANIFIER → INTÉGRER) | < 3 jours | Hebdomadaire |
| **Lead Time** (Idée → Production) | < 2 semaines | Hebdomadaire |
| **Throughput** (fonctionnalités livrées) | Stable ou en hausse | Hebdomadaire |
| **Release Frequency** | Quotidien (idéal) | Hebdomadaire |
| **Deployment Success Rate** | > 95 % | Hebdomadaire |

Les signaux d'alerte : un Cycle Time en hausse indique des fonctionnalités trop complexes ou des problèmes avec les agents ; un Lead Time stagnant pointe vers des goulots dans les boucles itératives ; un Throughput en baisse interroge la qualité des SPECs ou la motivation de l'équipe.

---

### 7.2 Catégorie 2 : Qualité

La qualité mesure la robustesse du code et la fiabilité du produit. La vélocité sans qualité est une illusion — les bugs en production détruisent la confiance des utilisateurs.

| Métrique | Cible | Fréquence |
|----------|-------|-----------|
| **Couverture de Tests** | > 80 % backend, > 70 % frontend | Hebdomadaire |
| **Bugs en Production** | Tendance en baisse (−20 %/trimestre) | Hebdomadaire |
| **Mean Time To Detect (MTTD)** | < 24 h | Mensuel |
| **Mean Time To Repair (MTTR)** | < 4 h | Mensuel |
| **Dette Technique** | Stable ou en baisse | Mensuel |
| **First-Time Success Rate** | > 70 % | Hebdomadaire |

Les signaux d'alerte : une couverture inférieure à 80 % interroge la configuration de l'Agent Quality ; des bugs en hausse questionnent le respect de la DoOD ou la suffisance de la validation QA ; un MTTR élevé révèle un monitoring insuffisant ou une architecture trop couplée.

---

### 7.3 Catégorie 3 : Efficacité IA

L'efficacité IA mesure la performance de l'écosystème d'agents. Les agents sont au cœur d'AIAD — si l'écosystème sous-performe, toute la méthode en souffre.

| Métrique | Cible | Fréquence |
|----------|-------|-----------|
| **Taux d'Adoption Agents** | > 90 % | Hebdomadaire |
| **First-Time Success Rate (Agents)** | > 70 % | Hebdomadaire |
| **Ratio Code Généré / Manuel** | > 80/20 | Hebdomadaire |
| **Itérations Moyennes par Feature** | < 3 | Hebdomadaire |
| **Taux de Faux Positifs (Agents)** | < 20 % | Mensuel |
| **Temps Résolution Problèmes Agents** | < 2 h | Mensuel |
| **Satisfaction PE sur Écosystème** | > 8/10 | Mensuel |

Les signaux d'alerte : une adoption inférieure à 90 % révèle soit des agents peu performants, soit une résistance culturelle ; un First-Time Success inférieur à 70 % pointe vers un AGENT-GUIDE obsolète ou des SPECs mal rédigées ; des faux positifs supérieurs à 20 % signalent un besoin de tuning des agents.

---

### 7.4 Catégorie 4 : Outcomes

Les outcomes mesurent la valeur réelle livrée aux utilisateurs et stakeholders. Livrer du code ne suffit pas — ces métriques vérifient que ce qui est livré résout réellement les problèmes des utilisateurs.

| Métrique | Cible | Fréquence |
|----------|-------|-----------|
| **Atteinte Outcome Criteria** | > 70 % | Mensuel |
| **Satisfaction Utilisateur (NPS, CSAT)** | > 8/10 | Mensuel |
| **Adoption Fonctionnalité** | > 60 % en 1 mois | Par feature |
| **Time to Value** | < 5 min (selon produit) | Mensuel |
| **Retention Rate** | > 80 % (selon produit) | Mensuel |
| **Business Impact** | Variable selon contexte | Mensuel |

Les signaux d'alerte : une atteinte des outcomes inférieure à 70 % interroge la qualité de la discovery ou la validité des hypothèses ; une satisfaction inférieure à 8 indique que les fonctionnalités ne résolvent pas le vrai problème ; une faible adoption questionne le go-to-market ou l'utilité réelle.

---

### 7.5 Catégorie 5 : Équipe

L'équipe mesure le bien-être et l'engagement. Une équipe épuisée ou démotivée ne peut pas performer durablement — ces métriques sont des indicateurs avancés de problèmes à venir.

| Métrique | Cible | Fréquence |
|----------|-------|-----------|
| **Satisfaction Équipe** | > 7/10 | Hebdomadaire (pulse) |
| **Psychological Safety** | > 8/10 | Mensuel |
| **Temps en Flow** | > 4 h/jour | Hebdomadaire |
| **Turnover** | < 10 % /an | Annuel |
| **Sick Days** | Baseline stable | Mensuel |

Les signaux d'alerte : une satisfaction inférieure à 7 révèle des problèmes de management, de surcharge ou de manque d'autonomie ; un temps en flow inférieur à quatre heures signale trop d'interruptions ou trop de synchronisations ; un turnover élevé alerte sur du burnout ou un manque de perspectives.

---

### 7.6 Les deux dashboards

**Le dashboard hebdomadaire** donne à l'équipe une vision claire de sa performance opérationnelle. Il couvre le flux (Cycle Time, Throughput, WIP), la qualité AIAD (qualité des specs, taux de premier passage à l'Execution Gate, drifts détectés), les DORA (Deployment Frequency, Change Failure Rate), et l'efficacité IA (adoption des agents, First-Time Success). Trois signaux déclenchent une action immédiate : un Cycle Time qui double, un score qualité des specs inférieur à 3,5/5, ou un Change Failure Rate supérieur à 15 %.

**Le dashboard mensuel** donne aux stakeholders une vision de la valeur livrée et des tendances. Il couvre les DORA (Deployment Frequency, Lead Time, Change Failure Rate, MTTR), les Flow Metrics (Cycle Time P85, Lead Time, Throughput, WIP, Flow Efficiency), les Outcomes (atteinte des criteria, NPS, adoption, impact business), la santé technique (dette technique, ADRs pris, composants en attention), et le top trois des améliorations nécessaires. Ce dashboard ne doit jamais devenir un outil de micro-management, une liste de vanity metrics, ou un rapport sans actions associées.


---

### 7.7 DORA Metrics et Flow Metrics

AIAD intègre nativement les **DORA Metrics** (DevOps Research and Assessment) et les **Flow Metrics** comme indicateurs de performance de livraison. Contrairement aux frameworks qui les imposent comme overhead de saisie, AIAD les génère organiquement depuis le cycle de travail : chaque boucle itérative produit des données dans `.aiad/metrics/`, et les commandes d'agrégation les calculent automatiquement.

Les **DORA Metrics** couvrent quatre indicateurs : Deployment Frequency (fréquence de mise en production), Lead Time for Changes (délai intention → production), Change Failure Rate (pourcentage de déploiements causant un incident), et MTTR (temps moyen de rétablissement).

Les **Flow Metrics** couvrent cinq indicateurs : Cycle Time (durée exécution → déploiement), Lead Time (durée intention → déploiement), Throughput (fonctionnalités livrées par période), WIP (fonctionnalités en cours simultanément), et Flow Efficiency (temps actif / temps total, calculé depuis Lead Time versus Cycle Time).


---

### 7.8 Le processus d'amélioration continue

L'amélioration continue suit le cycle PDCA adapté. En phase PLAN : identifier un problème via les métriques, analyser la cause racine, définir une hypothèse d'amélioration. En phase DO : implémenter le changement à petite échelle, documenter, mesurer. En phase CHECK : analyser avant/après, vérifier si l'hypothèse est validée, identifier les effets de bord. En phase ACT : si succès, standardiser ; si échec, apprendre et réessayer autrement.

**La technique des 5 Pourquoi** structure l'analyse de cause racine. Exemple : le Cycle Time a augmenté — pourquoi ? Les agents font plus d'erreurs. Pourquoi ? Les SPECs sont moins claires. Pourquoi ? Un nouveau PM n'est pas encore formé à la rédaction de SPECs. Pourquoi ? Il n'y a pas de processus d'onboarding. Action : créer un guide d'onboarding pour la rédaction de SPECs.

La cadence d'amélioration : surveillance automatique quotidienne (système), review des métriques équipe hebdomadaire (Rétrospective), review des métriques outcomes mensuelle (Synchronisation Alignement Stratégique), et review du framework AIAD lui-même trimestriellement (équipe et Supporters).

---

### 7.9 L'amélioration du framework lui-même

AIAD n'est pas gravé dans le marbre. Il doit évoluer avec l'équipe, les outils, et les apprentissages. Une équipe qui applique AIAD sans jamais l'adapter finit par suivre un processus obsolète.

La revue trimestrielle pose six questions. Les boucles itératives sont-elles fluides — y a-t-il des frictions ou des goulots, faut-il modifier des étapes ? Les synchronisations sont-elles utiles — apportent-elles de la valeur, faut-il adapter la fréquence ou le format ? Les artefacts sont-ils vivants et utiles — PRD, ARCHITECTURE, AGENT-GUIDE sont-ils à jour et utilisés quotidiennement ? L'écosystème d'agents est-il optimal — les agents apportent-ils 80 %+ de la valeur, y a-t-il de nouveaux agents à explorer ? Les métriques sont-elles actionnables — informent-elles vraiment les décisions, y a-t-il des vanity metrics à retirer ? Et l'équipe est-elle épanouie — satisfaction supérieure à 7/10, turnover acceptable, équilibre vie pro/perso respecté ?


---

### Anti-patterns des métriques

"On mesure tout ce qu'on peut mesurer." Paralysie par l'analyse. Commencer avec cinq à sept métriques essentielles. Ajouter uniquement si un besoin réel émerge.

"Les métriques sont bonnes, donc tout va bien." Les métriques peuvent être optimisées sans amélioration réelle — c'est la Goodhart's Law : "Quand une mesure devient un objectif, elle cesse d'être une bonne mesure." Croiser les métriques quantitatives avec le feedback qualitatif.

"On n'a pas le temps de faire de l'amélioration continue." L'équipe court après les deadlines sans jamais s'arrêter pour s'améliorer. Les mêmes problèmes se répètent. L'amélioration continue n'est pas un luxe — c'est un investissement. Une heure de rétrospective bien faite économise des jours de travail inefficace.

---

