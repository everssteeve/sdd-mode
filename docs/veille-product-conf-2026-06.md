# Veille — La Product Conf 2026 → pistes d'évolution AIAD / SDD Mode

> **Source** : chaîne YouTube [@LaProductConfLPCLPCx](https://www.youtube.com/@LaProductConfLPCLPCx/videos)
> **Périmètre** : 27 conférences publiées le **2026-06-03** (les 7 derniers jours au 2026-06-09).
> **Méthode** : transcripts auto récupérés via `yt-dlp` (piste originale FR ou EN), analyse d'une conférence par sous-agent dédié, contexte AIAD/SDD injecté à chaque agent. Verdict `JNSP` émis quand la conférence est hors-sujet.
> **Avertissement** : transcripts auto-générés → noms propres et chiffres à revérifier avant toute citation publique.

---

## 1. Synthèse transversale

### 1.1 Les 6 signaux qui reviennent dans presque toutes les confs

1. **Outcome > Output.** Itamar Gilad ("feature factory sous stéroïdes"), Büşra Coşkuner (loi de Goodhart), ProductOps/Airtable ("déployez-vous ce qui compte ?"), TheFork (valeur prouvée ≠ adoption). → AIAD manque d'un critère qui vérifie qu'une SPEC est reliée à un **outcome mesurable**, pas seulement bien formée.

2. **Le contexte/harness est le vrai différenciateur, pas le modèle.** Skello/Leboncoin ("harness"), Codex, Atlassian/Tassi ("l'intelligence est une commodité"), Miro ("your canvas becomes the prompt"), Figma ("contexte design"), Club Med ("glossaire métier = game changer"). → AIAD a déjà `context-budget` et les annotations, mais ne traite pas le contexte comme un **artefact produit versionné**.

3. **Le "data/spec contract" devient fondamental.** Mandyev (data contract YAML versionné), Club Med (PRD+DRD+Data Contract → spec-as-code), Bubble ("la source de vérité, ce sont les specs"). → convergence directe avec le Drift Lock AIAD, qui pourrait s'étendre au **drift données ↔ contrat**.

4. **Le "80/20 cliff".** Anthropic/Blake, Figma/Alexia, Lean Tech/Bernhard : l'IA livre 80 % vite, les 20 % restants (jugement, finition, cohérence) concentrent le coût. → besoin d'un verdict explicite "ce qui reste à l'humain".

5. **Le goulot se déplace, il ne disparaît pas.** Orga AI-native (15-20x individuel → 4-5x équipe → plat en entreprise), Lean Tech (optimisation locale vs flux), Figma ("on déporte les problèmes"). → mesurer le **goulot actif**, pas seulement la vélocité.

6. **Prototype-first / cycle inversé + spec comme source de vérité.** Codex ("débattre coûte plus cher que construire"), Bubble ("spec-driven development"), Lovable-to-Runnable, Club Med. → place pour une étape **prototype** avant la SPEC, et un message culturel "le code est jetable, la SPEC ne l'est pas".

### 1.2 Roadmap d'évolutions priorisée (dédupliquée)

| # | Évolution | Mécanisme AIAD touché | Confs sources | Effort | Impact |
|---|-----------|----------------------|---------------|--------|--------|
| **P1** | **Critère SQS "Valeur/Outcome"** : une SPEC doit être reliée à un outcome comportemental mesurable (cap à 3/5 sinon, label `GOODHART-RISK`) | `sqs-scoring`, `/sdd gate` | Gilad, Coşkuner, ProductOps, TheFork, Bernhard | M | ⭐⭐⭐ |
| **P2** | **Triade GSM (Goal→Signal→Metric) obligatoire dans l'Intent** + champ "End State Observable" | `/sdd intent`, `human-authorship-check`, `ears-validator` | Coşkuner, Williams F1, Anthropic, Kittler | M | ⭐⭐⭐ |
| **P3** | **Section `## Data Contract` dans le template SPEC** + extension du Drift Lock au drift données↔contrat | template SPEC, `drift-detection`, `/sdd drift-check`, `AIAD-RGPD` | Mandyev, Club Med, Skello/Leboncoin | M | ⭐⭐⭐ |
| **P4** | **Critère/section "Harness" pour les SPECs IA** (garde-rails, contexte injecté, routing, fallback) — auto-activé si `@governance AIAD-AI-ACT` | `sqs-scoring`, template SPEC | Skello/Leboncoin, Codex, Tassi | M | ⭐⭐⭐ |
| **P5** | **`@decision-log` + registre d'agents** : tracer le raisonnement de l'agent et lister les agents/MCP actifs | annotations, `traceability`, `/aiad health` | Data table ronde, Stripe AX | L | ⭐⭐ |
| **P6** | **Validation LLM / régression intentionnelle** : golden set + seuil MVQ + N questions métier rejouées | `/sdd validate`, `@eval-dataset` | Skello/Leboncoin, Data table ronde | M | ⭐⭐⭐ |
| **P7** | **`/sdd research` ancré dans les signaux** (sources de feedback, data readiness, veille open-source, impact cross-métiers) | `/sdd research`, `discovery-gate.js` | ProductOps, Mandyev, Killeen, Criteo, RATP, Gilad | M | ⭐⭐ |
| **P8** | **Étape `/sdd proto` (prototype-first)** + message "la SPEC est la source de vérité, le code est régénérable" | nouvelle sous-commande, `/sdd init` | Codex, Bubble, Lovable-to-Runnable | M | ⭐⭐ |
| **P9** | **`GLOSSARY.md` + contexte design/équipe** injectés comme contexte permanent | `context-budget`, ARCHITECTURE | Club Med, Figma, Tassi | S | ⭐⭐ |
| **P10** | **Métrique "Bottleneck Role" + Impact Rate** | `/aiad flow`, `/aiad dora`, `/aiad retro` | Orga AI-native, Gilad, Figma | S | ⭐⭐ |
| **P11** | **"Sobriété d'exécution"** : ≤ 3 SPECs actives, time-box, Brain Fry index | `sqs-scoring`, `/aiad health` | AI Brain Fry, orga AI-native | S | ⭐ |
| **P12** | **Gouvernance `AIAD-AX` (Tier 2)** : friction-tax agentique sur les API/UI exposées | `regulatory-veto` | Stripe AX | M | ⭐⭐ |
| **P13** | **`@boundary: human\|agent`** sur les fonctions de jugement à garder sous contrôle humain | annotations, `traceability` | Nabou, Anthropic (80/20) | S | ⭐⭐ |

> **Recommandation** : commencer par **P1+P2** (cœur "outcome", faible risque de régression, fort signal de toutes les confs) puis **P3+P4** (l'ère des agents impose le data/harness contract). Les autres sont des incréments.

---

## 2. Fiches détaillées (27 conférences)

### Lean Tech Engineering — Fabrice Bernhard (Theodo)
**Résumé** : 2 500 Md$ investis dans l'IA en 2026 mais seulement ~6 % des entreprises (McKinsey) en tirent une valeur significative. Même malentendu que le lean automobile : confondre productivité locale et création de valeur globale. Le secret de Toyota n'est pas la productivité mais un **système d'apprentissage intégré à la production** orienté valeur client. Trois principes Lean Tech appliqués à l'IA : (1) cibler les cas où l'IA crée vraiment de la valeur (modernisation legacy : 70→21 semaines chez Hello Doctor) ; (2) traiter chaque dérive d'agent comme une opportunité d'apprentissage ("right first time" + analyse de défaut, 6-7 itérations pour x10 sur un geste) ; (3) capitaliser via des **blueprints** — annotations dans le code signalant les meilleurs exemples à l'IA.
**Concepts clés** : "créer des problèmes pour forcer l'apprentissage" · discipline "right first time" (repartir de zéro plutôt que patcher à chaud) · **blueprint** = exemple de référence indexé pour guider la génération · augmenter l'humain, pas le remplacer.
**Évolutions AIAD/SDD** :
- **Critère SQS "Valeur flux complet"** : la SPEC identifie-t-elle le vrai goulot du flux de valeur ? Warning `FLOW-BOTTLENECK` si elle optimise en aval d'un goulot non levé.
- **Skill `agent-debrief`** : post-mortem structuré de chaque dérive agent (description / cause racine / contre-mesure) alimentant les Lessons Learned de l'AGENT-GUIDE.
- **Annotation `@blueprint`** : marque les fragments de code de référence, injectés en tête de contexte par `/sdd exec` (anti lost-in-the-middle).
- **"Flow Mapping" dans `/sdd research`** : situer l'intention dans le flux de valeur, nommer le goulot amont, conditionner le GO à son adressage.

### AI Brain Fry : charge cognitive & burnout — Table ronde (Meilleur Taux, Penny Lane, Renault)
**Résumé** : Le "Brain Fry" = surcharge cognitive liée à l'usage intensif de l'IA, distinct du burnout mais plus aigu à court terme. Étude BCG : 39 % des personnes en Brain Fry commettent plus d'erreurs majeures ; au-delà de **3 streams/agents simultanés** la productivité chute. Facteurs : disparition des respirations naturelles, illusion d'omnipotence, polarisation enthousiastes/anxieux, multiplication des outils. Leviers : bande passante IA dédiée dans les objectifs, typologies d'adopteurs (adopteur/exploreur/pionnier), équipes ops d'orchestration, time-boxing, ≤ 3 outils, partages pair-à-pair.
**Concepts clés** : "suivre le rythme de la machine est le plus dangereux car grisant" · "mettre de l'IA sur une équipe au modèle opératoire défaillant l'accentue" · "réinvestir les gains en qualité, pas en volume" · typologies adopteur/exploreur/pionnier.
**Évolutions AIAD/SDD** :
- **Critère SQS "Sobriété d'exécution"** : ≤ 3 SPECs actives, time-box explicite, pas d'objectif de volume pur (`SQS-WARN: cognitive-overload`).
- **`execution-mode: adopt|explore|pioneer`** dans `/sdd exec`, conditionnant le `context-budget` et la tolérance au JNSP.
- **"Brain Fry index" dans `/aiad health`** : nb de SPECs en `exec` simultanées, délai exec→validate, `fact` régressifs.
- **Champ `delivery-target: prototype|mvp|production`** dans l'Intent ; si `production`, checklist monitoring/sécurité bloquante au SQS.

### Clarity for Product People — Arne Kittler
**Résumé** : La clarté est le facteur de succès critique à l'ère de l'IA. Quatre obstacles (pression temporelle, confusion clarté/certitude, peur, harmonie sociale) et un modèle en 4 couches : directionnelle (hypothèse explicite + mesure du succès), situationnelle (principes produit = arbitrages codifiés), des rôles, et communication claire. Point fort : un brief vague donné à un humain génère une question ; donné à une IA il génère "une réponse fausse, complète, livrée avec pleine confiance". La clarté est un travail continu.
**Concepts clés** : "vague brief → confident fully formed wrong answer" · "clarity is not a one-off thing" · "product principles should state the tradeoff, not the obvious" (we prefer X over Y) · "it is your responsibility to make yourself understood" · Decision Stack (Vision→Strategy→Objectives→Opportunities→Principles).
**Évolutions AIAD/SDD** :
- **Champ obligatoire "Hypothèse & Signal de validation"** dans la SPEC (critère SQS 2 plafonné à 3 si absent).
- **Lint de statut d'artefact** (`DRAFT|VALIDATED|SUPERSEDED|ARCHIVED`) dans `drift-detection` ; `JNSP — statut non déclaré` bloquant en PR.
- **"Coherence Check" dans `/aiad sync-strat`** : tracer SPEC → Objective PRD → Vision (le Decision Stack mappe la hiérarchie documentaire AIAD).
- **"Feedback Framing" dans `/aiad demo`** : `Change Request | À considérer | Idée` ; un CR ouvre automatiquement un `/sdd fact`.

### Service-as-a-Software — Lucien Bredin (Nabou)
**Résumé** : Bascule du SaaS (vendre un outil) au "Service-as-a-Software" (vendre le résultat). Ratio : 1 $ de logiciel pour 6 $ de services → marché adressable 6× plus grand. Chez Nabou, 90 % du travail backoffice est fait par des agents, l'humain garde la relation client. Thèse : **l'IA doit être invisible** (interface simple email/SMS, complexité absorbée en backoffice). Trois erreurs : tomber amoureux du produit, attendre du déterminisme d'un LLM probabiliste, traiter les tokens comme un coût fixe et non une énergie variable. La barrière à l'entrée n'est pas l'IA mais la **data propriétaire**.
**Concepts clés** : "en 2025 on vendait le logiciel, en 2026 on vend le résultat" · "l'IA doit être invisible" · "votre barrière à l'entrée, c'est la data" · matrice Intelligence (automatisable) / Jugement (humain).
**Évolutions AIAD/SDD** :
- **Sous-critère SQS "Résultat client"** : la SPEC décrit-elle le résultat observable pour l'utilisateur, pas seulement le comportement système ?
- **Matrice Intelligence/Jugement en sortie de `/sdd research`**, traçable et vérifiée par `drift-detection`.
- **Budget tokens comme dimension RGESN** : annotation `@rgesn-token-budget` exigée par `regulatory-veto` pour toute SPEC agentique.
- **Annotation `@boundary: human|agent`** sur les fonctions de confiance, drift bloquant si une fonction `human` délègue silencieusement.

### Du POC à l'Intégration : TheFork
**Résumé** : Refonte du moteur de recherche en IA sémantique ("AS the Fork"), née d'un hackathon. Le POC (Streamlit en quelques jours) était la partie facile ; l'intégration à l'échelle (52 000 restaurants, 75 M couverts/an) a demandé un microservice Python, 27 personnes, 6 mois. Le **chatbot était la mauvaise réponse** : besoin = recherche améliorée, pas conversation. Lancement en beta progressive (interne→5→10→20 %→5 marchés) avec 5 canaux d'écoute. L'**evidence layer** (citations d'avis, photos) a reconstruit la confiance ET débusqué des bugs de pertinence. Résultats : 17 % conversion, 91 % succès, 76 % CTR — mais **adoption 3,7 % < cible 5 %** car feature isolée du parcours. "Prouver la valeur et faciliter l'adoption sont deux problèmes différents".
**Concepts clés** : "le POC, c'était la partie facile" · "pas de happy ending, que des itérations" · **evidence layer** (explicabilité + filet de débogage) · perception utilisateur de l'output IA = 3e axe à instrumenter.
**Évolutions AIAD/SDD** :
- **Sous-critère SQS 5 "POC ≠ Prod"** : impact sur l'archi existante quantifié (schéma de dépendances, charge) sinon critère à 0.
- **"Architecture Discovery" dans `/sdd research`** : lecture d'ARCHITECTURE.md + services impactés ; GO invalide sans ce volet pour une composante IA.
- **Checklist "Evidence Layer" dans `/sdd validate`** auto-déclenchée si `@governance AIAD-AI-ACT`.
- **Séparer "valeur prouvée" et "adoption"** dans `/aiad dora` / `/aiad flow`.

### ProductOps à l'heure de l'IA — David Benoît (Airtable)
**Résumé** : "Avez-vous livré la bonne feature cette semaine ?" Le problème du PM moderne : la vitesse ne garantit pas la pertinence. Quatre cas (BlackRock, OpenAI, eBay, JetBlue) montrent le même "messy middle" : un chaos de signaux (Slack, Zendesk, Gong, NPS) impossible à réconcilier. Réponse : centraliser data+automatisation+IA pour que l'IA traite le bruit et l'humain décide. Chiffres : BlackRock −580 h/an de reporting ; eBay analyse +1 M de signaux en minutes et passe de 8 mois à 3 semaines par lancement. "Garbage in, garbage out".
**Concepts clés** : "l'IA augmente le PM, elle ne le remplace pas" · "le messy middle" · "garbage in, garbage out" · passer de réunions de découverte à des réunions de décision.
**Évolutions AIAD/SDD** :
- **Section "Signal Sources" obligatoire dans `/sdd research`** (sources de feedback + convergence/divergence) avant verdict GO/NO-GO.
- **Pré-read obligatoire dans `/aiad demo`** : dashboard / `/sdd trace` envoyé avant, statut `READY_FOR_DECISION` vs `DISCOVERY_NEEDED`.
- **Métrique M6 "Signal Quality" dans `/aiad health`** : tag `@signal-source` dans l'Intent, fraîcheur de la source.
- **Champ "Impact Opérationnel" dans `/sdd fact`** : équipe aval notifiée ? signal utilisateur confirmant la feature ?

### De l'UX à l'AX (Agent Experience) — Arielle Le Bail (Stripe)
**Résumé** : Sur la base de 1 900 Md$ de transactions Stripe, constat d'une cassure historique de la courbe de création d'entreprises depuis janvier 2026 — "premier trimestre de la singularité économique" (Collison). Bascule : 1 humain = 1 transaction → N agents en parallèle pour 1 humain. 31 % des acheteurs FR utilisent déjà l'IA générative ; 25 % des startups YC 2025 sont à 95 % construites par agents. Trois questions AX : **Découvrabilité** (GEO, pas SEO), **Interopérabilité** (supprimer la "friction tax" — captchas, vérifs ; "Claimable Sandboxes" API sans compte), **Gouvernance agentique** (qui délègue quoi, combien, traçabilité). Standards : MCP (Anthropic), ACP (OpenAI+Stripe).
**Concepts clés** : "friction tax" · Generative Engine Optimization (GEO) · "agent readiness" · singularité économique.
**Évolutions AIAD/SDD** :
- **Sous-critère SQS "Agent-Readiness"** (critère 3) : le flux est-il accessible à un agent autonome, sinon pourquoi intentionnellement non ?
- **Gouvernance `AIAD-AX` (Tier 2)** déclenchée sur tout point de contact API/UI exposé pour checker la friction-tax agentique.
- **`/sdd fact --signal`** : tracer les signaux faibles (trafic LLM, sessions sans UI) comme pré-Intent (l'humain qualifie → préserve le Human Authorship).
- **Déclencheurs AX dans `ears-validator`** si la SPEC contient `API/webhook/checkout/token/agent` : critère EARS sur délégation/scope/durée/traçabilité.

### From Lovable to Runnable — Claire Van de Voorde
**Résumé** : Coca-Cola = deux archétypes : le **créateur** (Pemberton invente) et l'**exploitant** (Candler scale). Avec l'IA générative, le prototype naît en minutes mais l'exploitation reste tout le problème. Chez Soft, 20+ prototypes en 2 ans ; un proto "trop réussi" est passé en prod avec un business model non scalable (3 €/utilisateur de licence tierce) et des équipes GTM non formées. Process en 3 phases : (1) **cartographie de portefeuille** trimestrielle (usage + traction + alignement vision), (2) **destruction créatrice** (on ne scale pas le proto, on le déconstruit : 100 leviers → 3 actions), (3) industrialisation + formation. Obstacle final : le "je le sens pas" en comité, surmonté par des critères clairs.
**Concepts clés** : créateur vs exploitant · "on ne scale pas nos prototypes, on les détruit" · décision courageuse = process + critères, pas conviction · "tango à deux tempos" builders/exploitation.
**Évolutions AIAD/SDD** :
- **Critère SQS "Viabilité exploitation"** : coûts de licence/dépendances tierces, business model, équipes GTM (cap à 3/5 sinon).
- **Phase "Destruction créatrice"** entre `/sdd research` et `/sdd spec` quand un prototype (Lovable/v0/Retool) est référencé : `CONDITIONAL GO` + checklist "quelle est l'essence ?".
- **Commande `/aiad portfolio`** : kill/continue/scale par Intent/SPEC croisé aux métriques.
- **Annotation `@prototype-origin: <provider>`** déclenchant `AIAD-RGESN` + `AIAD-AI-ACT` au pre-commit.

### Malleable Software — Dave Killeen (Pendo)
**Résumé** : Fin 2024 = "threshold of coherence" (Karpathy) : la barrière n'est plus le code mais la clarté amont. Le "goût" devient un goulot, pas un fossé, quand l'IA génère 100 idées avant le petit-déjeuner. Trois piliers : **Out-hunt** (veille autonome GitHub/concurrents), **Bend the system** (logiciel malléable reconfigurable par des non-tech), **Prove impact** ("est-ce que ça mérite d'exister ?"). Démo : son projet Dex piloté par 20 instances Claude Code en parallèle → 17 500 lignes en une nuit (200x). L'IA ne rend pas le dev plus rapide, elle reconfigure le mode opératoire (analogie conteneur maritime).
**Concepts clés** : "taste becomes a bottleneck" · "truffle hunters — pattern matching at massive scale" · "the barrier was upfront clarity" · "binary statements or hard metrics the AI can verify, otherwise a probabilistic walk in the dark".
**Évolutions AIAD/SDD** :
- **`/sdd research --hunt`** : veille open-source/concurrents avant GO/NO-GO.
- **Critères d'acceptation binaires/métriques exigés au SQS 2** (un critère purement qualitatif force le score à 0, comme une violation EARS).
- **Métrique "Signal-to-Shipped Lead Time" dans `/aiad flow`** (capture du signal → merge).
- **Réconciliation multi-agents dans `traceability`** : annotations `@spec` produites par des agents parallèles sans conflit avant merge.

### L'IA ne fera pas gagner du temps à votre produit — Alexia (Figma) & Grandin (BNP Paribas)
**Résumé** : L'IA atteint 80 % d'une solution instantanément, mais les **20 % restants concentrent les coûts** (tokens, qualité, cohérence UX). Le vrai défi non résolu : industrialiser l'IA à l'échelle d'une équipe (passer de l'expérimentation individuelle au workflow collectif). Trois leviers simultanés : vélocité, direction/intention, différenciation. Le "contexte design" (tokens, design system, patterns, historique de décisions, besoins utilisateurs encodés) est le **tissu connectif** qui rend l'IA exploitable à l'échelle. BNP : 20+ design systems, complexité réglementaire (RGPD, AI Act), espoir via Figma MCP pour rendre les silos perméables.
**Concepts clés** : "pour chaque chose débloquée, le défi se déplace ailleurs" · "le vrai challenge, c'est choisir les bonnes idées" · "le contexte design devient le tissu connectif" · encoder les décisions business/design = transfert auto vers les devs.
**Évolutions AIAD/SDD** :
- **Champ `origine: [intention|spec|finition-ia|drift]` dans `/sdd fact`** pour mesurer la dette de finition IA (les "20 %").
- **Étape "cohérence transversale" dans `/sdd exec`** quand plusieurs SPECs sont actives (check d'intention global sur le PRD).
- **Artefact `.aiad/DESIGN-CONTEXT.md`** (tokens, patterns, pourquoi UX) injecté par `/sdd exec` si `@governance AIAD-RGAA`.
- **Research non court-circuitable** pour toute intention multi-SPECs / multi-rôles (`discovery-gate.js`).

### Orchestrer une transformation IA multi-métiers sans chaos — Sarah & Claire (Criteo)
**Résumé** : Criteo (4 000 personnes), objectif −20 % de time-to-market. Optimiser outil par outil ne marche pas : c'est le **workflow end-to-end** (Discovery→Design→Build→Run) et les enchaînements inter-métiers qui comptent. Audit du workflow réel (pas le prescrit dans Confluence) → 4 phases (Diagnostiquer, Investiguer, Concevoir, Planifier). Le cas Replit (adopté par les PM seuls) crée du chaos chez designers/devs ; le cas Builder (échec technique) force une collaboration fructueuse. Face à l'obsolescence rapide des outils, substitution du ROI par le **Return on Learning** : ce qu'on apprend sur le workflow reste même si l'outil disparaît.
**Concepts clés** : "les outils ne garantissent rien, ce qui compte c'est leur place dans le workflow" · **Return on Learning** · "on parie sur la robustesse de l'archi data, du design system, de la doc — n'importe quelle machine peut les lire" · "la question n'est pas qui a accès à l'IA, mais qui est responsable de quoi, quand".
**Évolutions AIAD/SDD** :
- **Section "Apprentissage workflow" dans `/sdd fact`** (handoffs, gouvernance, archi révélés) → AGENT-GUIDE.
- **Vérification "impact cross-métiers" dans `/sdd research`** : modifie-t-elle un handoff consommé ailleurs ? si oui `CONDITIONAL GO` par défaut.
- **Champ `Portée: LOCAL|CROSS` dans `/sdd intent`** ; `CROSS` déclenche `regulatory-veto` (RGESN coordination) + stakeholder non-auteur.
- **Doc des handoffs comme actif machine-lisible** vérifié au `/sdd drift-check` (`@spec` orphelin signalé).

### RCS & appels in-app — Vonage & Big Télécom *(pertinence AIAD faible — transpositions)*
**Résumé** : RCS (successeur enrichi du SMS) : médias riches, CTA, métriques, identité de marque vérifiée par les opérateurs, 85 % de reach en France (iOS depuis fin 2024). Campagne "Allô Papa Noël" : 600 000 messages lus, 27 000 interactions, opt-out < 4 %. La **confiance** (identité vérifiée, canal natif) conditionne l'engagement. Appels in-app : les numéros inconnus sont ignorés → appel depuis l'app de la marque, biométrie, raison d'appel affichée.
**Concepts clés** : "Own Your Brand" (analogie BIMI) · reach > 85 % · formats courts + CTA explicites · appel in-app = confiance restaurée.
**Évolutions AIAD/SDD** *(analogies structurelles, pas enseignements directs)* :
- **"Own Your Spec"** : le pre-commit bloque tout fichier applicatif sans `@spec` valide (émetteur non vérifié).
- **Bloc "SPEC Health" dans `/aiad dashboard`** : SPECs passées Gate du 1er coup, ratio fact/spec, SQS médian.
- **Proportionnalité de longueur de l'Intent** dans `human-authorship-check` (intention sur-spécifiée → suggérer `/sdd split` dès l'intent).
- **"Raison de l'appel"** : `human-authorship-check` alerte si une intention n'est référencée par aucune ligne du PRD.

### Comment Leboncoin et Skello intègrent l'IA — Pauline (Leboncoin) & Aude (Skello)
**Résumé** : Leboncoin a refondu son tunnel de dépôt (UX + ML de catégorisation + LLM de description) sur 1 M d'annonces/jour, enjeu coût d'inférence critique. Skello a construit un agent conversationnel sur ses données RH (4 itérations archi : POC LLM brut → multi-agents → agent + outils → agent avec routing). Trois compétences PM nouvelles : **évaluation systématique** (golden set + revue humaine hebdo + LLM-as-a-judge), gestion du triplet **qualité/latence/coût**, IA comme **discovery continue** (analyse hebdo automatisée des logs de questions prod). Le **harness** (tout ce qui entoure le modèle) est le vrai différenciateur.
**Concepts clés** : **harness** ("votre produit, c'est tout ce qui est autour du modèle") · **MVQ — Minimum Viable Quality** (80-90 % de réponses correctes) · discovery continue (tâche Claude hebdo qui segmente la prod) · mix workflow déterministe / LLM.
**Évolutions AIAD/SDD** :
- **Critère SQS-6 "Harness Score"** (auto si `@governance AIAD-AI-ACT`) : garde-rails, contexte, routing, fallback décrits.
- **Section `## Contraintes LLM` dans la SPEC** (volume, latence P95, plafond coût/unité), exigée par `ears-validator` si `LLM`/`agent`.
- **"Validation LLM" dans `/sdd validate`** : golden set + seuil MVQ + fréquence de revue ; tag `@eval-dataset`.
- **Commande `/sdd discovery`** : segmente des logs prod, diff avec les SPECs existantes (via `/sdd trace`), génère des Intent candidats soumis à `human-authorship-check`.

### Codex for the future of work — Katia Gil Guzman (OpenAI)
**Résumé** : Codex = agent polyvalent, "Chief of Staff" du PM. Trois couches : modèles (GPT unifié), **harness** (outils, contexte, itération — open source), surfaces (app/IDE/terminal/mobile). 4 M d'utilisateurs hebdo, ×4 depuis le lancement. Le coût de build s'effondre → **cycle PM inversé** : on construit d'abord (proto en 15 min), on filtre ensuite. Chez OpenAI, obligation de présenter un prototype avant de défendre une idée. Workflow démontré : feedback multi-sources → dashboard → mockup (GPT Image) → prototype → PRD + slides en < 30 min. Skills réutilisables (Markdown) + automatisations récurrentes.
**Concepts clés** : "débattre d'une feature coûte plus cher que l'implémenter et voir" · **harness** comme différenciateur · cycle inversé build→filter→vision · skills = instructions Markdown réutilisables.
**Évolutions AIAD/SDD** :
- **Étape `/sdd proto`** entre `intent` et `spec` ; le proto devient pièce jointe obligatoire au contexte de l'Intent.
- **`/aiad automate <nom>`** : patron "automatisation récurrente" (template + cron) pour les rituels (standup, health).
- **Critère SQS-6 "Artefact de validation"** (+1 si proto/mockup/analyse attaché, non bloquant).
- **Section "Signal utilisateur" dans `/sdd research`** : sources de feedback analysées avant le verdict.

### Aligner 1 200 personnes sur 30 disciplines — Richard (Williams F1) × Atlassian
**Résumé** : Issu de l'aéro chez Williams F1, Richard reconstitue artificiellement la cohésion d'une grande orga via une **North Star unique et mesurable** : le **lap time**. Chaque idée/dépense est traduite en millisecondes gagnées/perdues → arbitrages data-driven. Modèle d'autonomie : le leadership fixe destination + route (OKR), l'expertise locale décide le "comment". IA = "analyste infatigable" : des agents trient le backlog (300 idées), estiment le gain en lap time, déposent un commentaire avant l'humain. Effet inattendu : les ingénieurs **argumentent avec le bot**, ce qui enrichit le contexte.
**Concepts clés** : "done = when lap time goes down, not when the task leaves the inbox" · "tell them what to achieve, let them innovate" · "tireless analyst" amplificateur de contexte · "tooling as a Trojan horse".
**Évolutions AIAD/SDD** :
- **Champ "Metric de succès" obligatoire dans `/sdd intent`** (North Star), vérifié par `human-authorship-check` ; absent → `JNSP` bloquant.
- **Pre-triage IA dans `/sdd research`** : agent qui scanne SPECs/AGENT-GUIDE/annotations et dépose un rapport de contexte avant le verdict humain.
- **Sections `Contraintes fixes` vs `Espace de solution`** dans la SPEC (SQS 4 décoté si fusionnées).
- **Virtuous context loop** : un `/sdd fact` propose auto une MAJ AGENT-GUIDE / annotation `@spec` corrigée.

### The AI PM Disruption — Hype vs Reality — Itamar Gilad
**Résumé** : Cycle de Gartner appliqué à l'IA 2026 : on est dans l'inflation des attentes (comme le web en 1999). "Le coût du dev tombé à zéro" est naïf : le vrai coût n'a jamais été le code mais la **résolution de contraintes** (business, users, système). Il démonte 3 archétypes hype (spécialiste LLM, PM-dev qui push en prod, PM remplacé) et propose le **PM augmenté** qui irrigue les 8 fonctions du Product Operating Model. Alerte : une feature factory + IA = "feature factory sous stéroïdes". Raisonner objectifs → technologie, jamais l'inverse. Seul rôle vraiment menacé : le "delivery PO" pur traducteur roadmap→backlog.
**Concepts clés** : "le vrai défi n'a jamais été le code, c'est un problème de contraintes" · "feature factory sous stéroïdes" · "partir des objectifs, descendre vers la techno" · Product Operating Model (8 fonctions).
**Évolutions AIAD/SDD** :
- **Critère "time to outcome vs time to output" dans `/sdd research`** (5e condition du CONDITIONAL GO).
- **SQS 1 "anti-feature-factory"** : lien explicite SPEC → outcome mesuré (OKR), sinon cap à 3/5 — empêche AIAD de devenir un "SDD factory".
- **Garde-fou "delivery PO" dans `human-authorship-check`** : détecter les Intent qui sont de simples retranscriptions de ticket → `JNSP` + reformulation en problème/outcome.
- **Bloc "outcomes vs outputs" dans `/aiad retro`** → **Impact Rate** dans `/aiad dora`/`flow`.

### From overwhelming feedback to confident decisions — Kevin Tassi (Atlassian)
**Résumé** : Depuis que les LLM sont une commodité, l'intelligence n'est plus différenciante : c'est le **contexte injecté** qui l'est. L'enjeu n'est plus la productivité individuelle mais décider *quoi* construire avec un contexte commun. Atlassian : "Product Collection" (Feedback, Discovery, Roadmap) sur un "teamwork graph" partagé + agent Rovo. Le feedback brut est inutile sans enrichissement métadonnée (CRM, segment, deal-stage) et liaison aux objectifs. Double sens : feedback→roadmap (left-to-right) et idée→scan du feedback (right-to-left). "Proactive intelligence" : l'agent pousse les insights pertinents sans requête.
**Concepts clés** : "l'intelligence est une commodité, le contexte différencie" · "left to right, right to left" · "proactive intelligence" · "fermer la boucle" (informer clients/stakeholders).
**Évolutions AIAD/SDD** :
- **Double balayage dans `/sdd research`** : left-to-right (faits/retro confirment l'intention) puis right-to-left (corpus scanné pour preuves contraires) avant GO/NO-GO.
- **Section "Team Context" dans l'AGENT-GUIDE** (objectifs actifs, segments, insights récurrents ≤ 500 tokens).
- **Proactive intelligence dans `/aiad standup`** : croiser faits récents × métriques × Intents actifs pour signaler les patterns.
- **Colonne "Stakeholder notified" dans la matrice `traceability`** : fermeture de boucle machine-vérifiable, bloquante en drift-check.

### Une histoire de disruption — Emmanuel Straschnov (Bubble)
**Résumé** : Bubble (no-code, 2012, −100x sur le coût de build) = cas d'école de disruption (Christensen, low-end). Disrupteur d'abord, puis disrupté par les LLM/agents de code dès fin 2022 — en reproduisant le même déni qu'il observait chez ses victimes. La disruption suit la courbe du deuil (déni→peur→...→innovation), les signaux avant-coureurs sont faibles et ignorés. Trois ruptures IA : (1) le code perd de sa valeur, **les specs deviennent la source de vérité** réutilisable par les agents ; (2) rééquilibrage de la triade (moins d'ingénieurs mais plus puissants, **renaissance du PM** rédacteur de specs) ; (3) les contraintes archi legacy s'évaporent (repartir from scratch en heures avec les bonnes specs).
**Concepts clés** : "spec-driven software development — la source de vérité, ce sont les specs" · "la qualité du code n'a plus la même importance" · "quelques ingénieurs avec des agents = une équipe de 30-40" + renaissance PM/designer · "le choc, c'est Claude Code et Opus".
**Évolutions AIAD/SDD** :
- **`/sdd init` + AGENT-GUIDE affichent "la SPEC est la source de vérité, le code est régénérable"** (alignement culturel des équipes qui bloquent les PRs sur la qualité du code généré).
- **"Weak Signal Radar" dans `/aiad health`** : questions qualitatives sur les pratiques émergentes minimisées (valeur "Empirisme").
- **SQS 4 valorise la vitesse de réécriture agentique** : coût de contournement d'un choix legacy estimé (éviter d'abandonner une SPEC pour une dette en réalité culturelle).
- **Rituel `/aiad hackathon`** : 1 journée, toute la triade, ≥ 1 PR agentique mergeable par équipe.

### L'agentique accélère : vis ma vie de Head of Data & IA — Table ronde (Photoroom, Sorare, ex-VP Data)
**Résumé** : Trois chantiers : (1) agents de nuit qui pré-corrigent les anomalies de pipelines (humain = validateur le matin) ; (2) **insights factory** = orchestrateur multi-agents, chaque sous-question à un agent à mémoire fraîche (anti-dégradation de contexte) ; (3) digest PM auto chaque lundi. Le data analyst perd sa chasse gardée SQL mais devient **garant de la fiabilité et du contexte**. Enjeu non résolu : la gouvernance des agents proliférants et la **reconstruction des chemins de décision** des LLM.
**Concepts clés** : "la prochaine hype = le context engineering" · "notre livrable, c'est la fiabilité, pas les dashboards" · "la confiance est un problème d'engineering" · "l'agent a zappé ma librairie sans m'expliquer ses décisions".
**Évolutions AIAD/SDD** :
- **Annotation `@decision-log`** générée par l'agent à chaque choix structurant (dépendance, pattern, alternative écartée), vérifiée au drift-check → traçabilité du *raisonnement*.
- **"Régression intentionnelle" dans `/sdd validate`** : N questions métier en langage naturel (liées aux critères EARS) rejouées à chaque PR.
- **Registre d'agents dans `/aiad health`** : scan `.claude/skills/` + MCP de `settings.json` → `agents-registry.md` (SPEC, accès, dernière exécution) ; alerte si accès > périmètre SPEC.
- **Context Engineering Budget étendu au contexte organisationnel** (AGENT-GUIDE à jour, conventions stables) auditer dans `/aiad standup`/`health`.

### Why your team is hitting targets by building the wrong thing — Büşra Coşkuner
**Résumé** : Des équipes atteignent leurs KPIs en dégradant le produit (marketplace qui liste chaque vis pour gonfler son compteur d'items). Trois mécanismes : loi de **Goodhart** (une mesure-cible cesse d'être bonne), loi de Campbell (toute mesure à enjeu est manipulée), chemin de moindre résistance. Conséquences macro : Nike, Kodak, Skype. Proposition : **outcome-first measurement** via le framework Google **GSM** (Goal → Signals → Metrics) : définir le comportement observé en cas de succès (signal), puis la métrique, puis le seuil — jamais l'inverse.
**Concepts clés** : "when a measure becomes a target, it ceases to be a good measure" · "behavior change is how markets work" · "any metric without intent and context means nothing" · framework GSM.
**Évolutions AIAD/SDD** :
- **Triade GSM obligatoire dans `/sdd intent`** (`Signal / Metric / Threshold`) ; absente → décote SQS 2.
- **Anti-pattern "Goodhart trap" dans SQS 5** : si la SPEC cite un KPI business brut sans signal comportemental → cap à 0, label `[GOODHART-RISK]`.
- **Champ "Behavior Delta" dans `/sdd validate` et `/sdd fact`** (comportement post-livraison vs signal GSM) ; absent → drift non fermable.
- **"Integrity Check" dans `/aiad dora`/`flow`** : rappeler le signal sous-jacent de chaque métrique (`[CAMPBELL-RISK]` si sans ancrage outcome).

### Comment on devient une orga produit AI-native — Table ronde (orgas de 70, 200, 6 000 pers.)
**Résumé** : Devenir AI-native est un changement opérationnel **progressif et asymétrique**, qui demande de l'intentionnalisme. L'adoption part des power users (engineering), puis exige une phase "scale" avec un operating system commun. Gains élevés en individuel (20-30 % delivery, jusqu'à 80 % du code par agents) mais **faibles voire nuls au niveau orga** : le goulot se déplace. Recherche Stanford citée : 15-20x individuel → 4-5x équipe → plat/négatif en entreprise. Risque : la Discovery automatisée **déresponsabilise le PM de sa vision**. L'"AI Team" centralisée ne marche pas ; une équipe plateforme/enablement oui. Conseil : être intentionnaliste, déployer un workflow à fond avant d'explorer le suivant.
**Concepts clés** : "80 % du code par agents mais +20-30 % de prod seulement — on déplace les goulots" · "si ta discovery t'est servie sur un plateau, tu n'incarnes plus ta vision" · "15-20x → 4-5x → plat/négatif" · "soyez intentionnalistes".
**Évolutions AIAD/SDD** :
- **Garde-fou "incarnation de la vision" dans `human-authorship-check`** : l'Intent émerge-t-il d'une conviction humaine ou d'un rapport IA ? → flag `authorship: ai-assisted` + validation humaine.
- **Métrique "Bottleneck Role" dans `/aiad flow`** (où s'accumule le WIP par rôle) affichée au dashboard.
- **Champ `Scope gelé: oui/non` en entête de SPEC** lié à SQS 3 (anti "prototype sans fin").
- **Section `[OS IA]` dans `/aiad retro`** : workflows IA actifs / figés / à déprécier, versionnés dans l'AGENT-GUIDE.

### Scale : How Anthropic is helping start-ups grow — Aiden Blake (Anthropic) & Amandine Durr (Back Market)
**Résumé** : Trois stades de maturité : moteur de recherche → collaborateur itératif → workflow agentique. Les gagnants **re-designent leurs process** plutôt que d'accélérer l'existant ("pas un process en 12 étapes 20 % plus vite"). Le **"80/20 cliff"** : l'IA livre 80 % vite, les 20 % restants exigent jugement, domaine, goût. La **confiance** est le différenciateur d'Anthropic ("on avait un département trust & safety avant d'avoir un produit"). Roadmap : mémoire long-terme ("dreaming"), orchestres ~20 agents.
**Concepts clés** : "rewriting the process, not doing it 20 % faster" · "the 80/20 cliff" · "be intentional about what good looks like — document the end state or you fall into a hole" · "trust & safety before product".
**Évolutions AIAD/SDD** :
- **Verdict "Human Completion Required" dans `/sdd validate`** : lister explicitement les critères non machine-vérifiables (UX, jugement légal, archi irréversible) restant à l'humain.
- **Champ "End State Observable" dans `/sdd intent`** linté par `ears-validator` ; absent/non testable → Gate bloquée.
- **Indicateur "Agentic Maturity Level (1/2/3)" dans `/aiad health`**.
- **"AI Safety Baseline Checklist" en `/sdd init`** (niveau de risque EU AI Act documenté dès le cadrage) — "trust before product".

### Club Med : deux ans de transformation IA — Amina (VP Exp. Client Digitale) & Jérémy (Principal Engineer)
**Résumé** : 2 Md€ de CA, 60+ villages, ~100 devs. Bascule : 3 M€ réalloués à budget constant pour une équipe data/IA. **Software Factory** autour de 3 artefacts versionnés — **PRD + DRD + Data Contract** — alimentant des agents orchestrateurs qui génèrent des Epics prêtes à coder. **Spec-as-code** explicitement cité (inspiration BMAD, AgentOS) mais framework maison adapté à 100 devs. Cas prod : indexation photo (8 h → minutes), chatbot WhatsApp (50 % de 1,4 M contacts/an, cible 80 %). Comité éthique trimestriel → suppression de l'historique d'un algo RH (biais de genre). ~20 000 €/mois de tokens. **Glossaire métier** partagé = game changer.
**Concepts clés** : "réfléchir le plus possible en amont sur l'intention" · "spec-as-code : versionner toutes les specs dans le code" · "se concentrer sur le workflow/orchestration, pas les modèles" · "parler la même langue entre humains, IA et features = game changer".
**Évolutions AIAD/SDD** :
- **Section `## Data Contract` dans le template SPEC** (sources, schémas, ownership, PII) → déclenche `regulatory-veto` RGPD ; renforce SQS 4.
- **Fichier `.aiad/GLOSSARY.md`** injecté comme contexte permanent par `/sdd exec` (coût calculé par `context-budget`).
- **Comité éthique tracé via `/sdd fact`** : flag `@governance: AIAD-AI-ACT,AIAD-RGPD` sur les algos à données historiques/RH → "vérifier biais par proxy (JNSP si non documenté)".
- **Section `## Modèles IA` dans ARCHITECTURE.md** (principal, fallback, politique de MAJ) ; swap de modèle traité comme décision archi (Intent + Gate).

### From analytics to action: data products for agents — Andriy Mandyev (ex-Decathlon)
**Résumé** : Les agents sont un **3e type d'utilisateur** de la donnée : ils acceptent n'importe quelle entrée mais décident avec une confiance absolue, même sur des données fausses. La donnée propriétaire bien structurée pour les agents devient le différenciateur. Cas : facturation à tort d'un client ayant annulé — l'agent a agi logiquement sur une donnée désynchronisée là où un humain aurait su tacitement de vérifier ailleurs. Solution : traiter le **contexte agent comme un produit, pas un projet**, via un **data contract** (YAML versionné dans Git : schéma, limitations, règles business, instructions d'usage = "prompt engineering embarqué dans la donnée"). La CICD détecte le drift donnée↔contrat. Bonus : contrats précis → moins de tokens, plus de fiabilité.
**Concepts clés** : "la façon d'alimenter le contexte avec vos données impacte plus que le modèle" · "le contexte agent doit être un produit, pas un projet" · "on fait du prompt engineering dans le contrat" · "commencer petit, une source critique".
**Évolutions AIAD/SDD** :
- **Section `## Data Contracts` dans la SPEC** (owner, SLA fraîcheur, limitations, escalade) ; `ears-validator` exige `data-source-contract` si donnée externe.
- **Drift Lock étendu au drift données↔contrat** dans `/sdd drift-check` (gap `INCONNU` si lien absent).
- **Indicateur M6 "Data contract coverage" dans `/sdd context`** (signal de context rot proactif).
- **Passe "data readiness" dans `/sdd research`** : sans contrat sur une source critique → `CONDITIONAL GO`.

### Quand le code rencontre la musique — DJ Dave *(JNSP — hors-sujet AIAD)*
**Résumé** : Sarah (DJ Dave), issue de la mode et sans code jusqu'à 20 ans, fait du **live coding musical** (outil Strudel, web/gratuit) : elle écrit et modifie du code en direct devant le public pour construire un morceau (filtres, arpégiateurs, basses, percussions). Thèse : la techno peut être un medium artistique fluide, pas qu'un outil pro. Invitation aux PM à voir le code comme un espace de jeu.
**Concepts clés** : "music plus code equals algorave" · "I was introduced to technology as an artist" · "you can steal all my code" (open source) · créativité sous contrainte, erreur assumée en temps réel.
**Évolutions AIAD/SDD** : **JNSP — connexion AIAD peu défendable.** Performance artistique sans cycle de validation, SQS, gouvernance ni artefacts persistants. Deux analogies seulement, pas davantage : (1) **Human Authorship** — l'artiste choisit chaque note, l'outil exécute (l'intention reste humaine) ; (2) **observabilité radicale** — performer écran visible de tous fait écho à la traçabilité/Drift Lock (honnêteté, empirisme). Forcer plus serait inventer.

### Discovery from 0 to 1 : vitesse et qualité — Jordana (RATP Smart Systems) & Bilendi X
**Résumé** : User researcher seule à temps plein, Jordana absorbe 13+ projets de recherche/an en structurant la pratique. REX initial : tests trop évaluatifs (rassurer le designer), pas de tests modérés, insights oubliés faute de repository. Réponse : meilleur outillage (outils spécialisés combinés) + **process en 5 étapes** : plan de recherche (atelier de cadrage), préparation (IA pour neutralité des consignes), recrutement externalisé, terrain (présentiel + grille d'observation live impliquant PO/designer), analyse+reco (IA pour retranscriptions, atelier de priorisation), partage en repository commun. Vélocité par chevauchement des études dans les creux, pas par raccourcis.
**Concepts clés** : "un cadre simple et réplicable" · "on perd du temps mais on en gagne pour la suite" (tests modérés) · "les enseignements tombaient dans l'oubli" → repository · grille d'observation live.
**Évolutions AIAD/SDD** :
- **"Research Kickoff" obligatoire avant `/sdd research`** : checklist 5 champs (périmètre, questions, planning, sources existantes, stakeholders), prérequis vérifié par `discovery-gate.js`.
- **Convention `.aiad/insights/`** : `/sdd research` y dépose un livrable structuré, consulté par `context-budget` avant tout nouvel Intent.
- **Grille d'observation partagée en entrée de `drift-detection`** : PE + dev remplissent attendu vs observé lors de `/sdd validate`.
- **Mode `/sdd exec --coached`** pour les SPECs à faible risque (SQS 5/5, sans `@governance`) : l'agent produit un guide pas-à-pas pour un dev junior, PE = validateur final.

---

## 3. Conférences à pertinence faible / nulle pour AIAD

- **RCS & appels in-app** : domaine communication B2C ; seulement des analogies structurelles (confiance/vérification, métriques d'engagement).
- **Quand le code rencontre la musique (DJ Dave)** : performance artistique ; verdict **JNSP** assumé, 2 analogies de valeurs uniquement.

Toutes les autres conférences sont directement exploitables pour AIAD/SDD Mode.

