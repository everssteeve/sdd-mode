# AIAD SDD Mode — v1.6

**Spec Driven Development — Guide opérationnel pour Product Engineers AIAD**

*Framework AIAD — aiad.ovh — Open Source*

---

## Installation en 1 minute

```bash
npx aiad-sdd init
```

Installe dans votre projet : structure `.aiad/`, 4 agents de gouvernance Tier 1, 27 commandes slash Claude Code, `CLAUDE.md` configuré.

```bash
# Options utiles
npx aiad-sdd init --sans-gouvernance   # sans les agents de gouvernance
npx aiad-sdd update                    # met à jour commandes + gouvernance, préserve vos fichiers
npx aiad-sdd status                    # vérifie la maturité SDD (score 0-5)
```

Puis dans Claude Code :

```
/sdd-init
```

---

## Les 3 principes fondateurs

### Principle #1 — Spec as Living Invariant

La SPEC n'est pas un document de passage. Elle reste la source de vérité entre l'intention humaine et le code agent — avant, pendant et après l'implémentation. AIAD se positionne au niveau **spec-anchored** : la spec n'est ni abandonnée après la tâche (spec-first), ni générateur du code (spec-as-source). Elle est synchronisée avec le code à chaque PR via le Drift Lock.

### Principle #2 — Drift = Échec de Processus

Le spec drift — code qui évolue sans que les artefacts suivent — est traité comme un **échec de processus**, pas une erreur d'agent. La mise à jour des artefacts fait partie de la Definition of Done. Une tâche dont le code est mergé mais la SPEC désynchronisée n'est pas terminée.

### Principle #3 — Context Engineering Budget

Le Product Engineer est responsable du budget de contexte de chaque session agent. Règle pratique : une session = un objectif, durée < 35 min, contexte = AGENT-GUIDE + ARCHITECTURE condensée (500 tokens) + SPEC active. Le PRD complet n'est injecté qu'en phase de cadrage. Au-delà de 35 min, lancer `/compact` et relancer une session propre.

**Seuil opérationnel recommandé (v1.6) :** utiliser 60-70 % du contexte disponible comme maximum effectif (ex. : 200k tokens disponibles → budget max = 130k). Au-delà, les symptômes de dégradation (context rot) apparaissent avant la limite théorique : réponses moins précises, oublis de contraintes de spec, comportements répétitifs. **Règle de placement :** toujours placer l'Intent Statement et la SPEC active en tête de contexte pour contrer le "lost in the middle effect".

**Référence modèles (v1.6) :** Opus 4.7 (1M tokens effectifs — multiplicateur 2.2x vs Opus 3.5) ; Sonnet 4.6 (200k tokens) ; Haiku 4.5 (200k tokens). La fenêtre disponible ne change pas le seuil opérationnel de 60-70 % — elle le déplace vers le haut.

**Argument économique :** une session spec-anchored consomme en moyenne 41,7 % de tokens en moins qu'une session sans spécification (R2Code, arXiv avril 2026). Sur des projets intensifs en génération de code, l'économie est mesurable. AIAD étant model-agnostic, cet avantage s'applique quelle que soit la plateforme — contrairement aux limites de tokens des outils propriétaires à abonnement fixe. La commande `/sdd-context` fournit une estimation du coût évité par session.

---

## Workflow SDD Mode

```
┌─────────────────────────────────────────────────────────┐
│                  PROCESSUS AIAD SDD MODE                 │
│           npx aiad-sdd init → commandes slash            │
└─────────────────────────────────────────────────────────┘

 0. INITIALISATION          1. INTENT CAPTURE        2. SPEC WRITING
 ─────────────────          ─────────────────        ───────────────
 npx aiad-sdd init          /sdd-intent        ───▶  /sdd-spec
 /sdd-init                  Intent Statement          SPEC draft
 PRD+ARCHI+GUIDE            archivé                   + /sdd-split si besoin
        
        
 3. EXECUTION GATE          4. DÉVELOPPEMENT         5. VALIDATION
 ─────────────────          ────────────────         ────────────
 /sdd-gate            ───▶  /sdd-exec          ───▶  /sdd-validate
 SQS ≥ 4/5 ?                /sdd-resume               Tech+Fonc+Métier
 Context Eng. Budget         Code + tests              +Gouvernance
        
        
 6. DRIFT LOCK              7. DÉPLOIEMENT           8. CONSOLIDATION
 ─────────────              ──────────────           ───────────────
 /sdd-drift-check     ───▶  Staging → Prod     ───▶  /aiad-retro
 Code + SPEC                Monitoring                /aiad-intention
 dans même PR               Rollback si besoin        /aiad-status

                ↩ Nouvelle itération à partir de 1
```

---

## Workflow SDD Mode — Détail par étape

| Étape | Acteur | Entrées | Sorties | Durée | Dépendances | Commande |
|-------|--------|---------|---------|-------|-------------|---------|
| **1. Initialisation** | PM, Tech Lead, AE | Décision de démarrer, Node.js 18+ | PRD.md, ARCHITECTURE.md, AGENT-GUIDE.md, structure .aiad/ | 3-7 jours | Aucune | `npx aiad-sdd init` puis `/sdd-init` |
| **2. Intent Capture** | PE + PM | PRD.md validé, user stories priorisées | Intent Statement validé et archivé dans `.aiad/intents/` | 15-30 min | Étape 1 complète | `/sdd-intent` |
| **3. Spec Writing** | PE | Intent Statement validé, ARCHITECTURE condensé, AGENT-GUIDE | SPEC draft committée dans `.aiad/specs/` | 30-60 min | Intent Statement validé | `/sdd-spec`, `/sdd-split` |
| **4. Execution Gate** | PE | SPEC draft | SPEC validée (SQS ≥ 4/5), Context Engineering Budget préparé | 15-30 min | SPEC draft générée | `/sdd-gate` |
| **5. Développement agent** | PE | SPEC validée et committée | Code + tests prêts pour validation | 2h - 3 jours | Gate passée | `/sdd-exec`, `/sdd-resume` |
| **6. Validation** | PE, QA, PM | Code implémenté, tests passants, SPEC | Rapports tech + fonc + métier + gouvernance | 1h - 4h | Implémentation complète | `/sdd-validate` |
| **7. Drift Lock** | PE | Code validé, SPEC de référence | SPEC synchronisée, PR mergeable | 10 min | Validations passées | `/sdd-drift-check` |
| **8. Déploiement** | PE | PR validée et mergée | Application en production, artefacts synchronisés | 30 min - 2h | Drift Lock effectué | — |
| **9. Consolidation & Rituels** | Tous | Fin d'itération | AGENT-GUIDE mis à jour, métriques, plan d'amélioration | Variable | ≥ 1 itération complète | `/aiad-retro`, `/aiad-intention`, `/aiad-status` |

---

## Index des commandes

| Commande | Phase | Rôle principal |
|----------|-------|----------------|
| `/sdd-init` | Initialisation | PE / Tech Lead |
| `/sdd-intent` | Intent Capture | PE |
| `/sdd-spec` | Spec Writing | PE |
| `/sdd-gate` | Execution Gate | PE |
| `/sdd-exec` | Développement | PE |
| `/sdd-resume` | Développement | PE |
| `/sdd-split` | Spec Writing / support | PE |
| `/sdd-context` | Support transversal | PE |
| `/sdd-validate` | Validation | PE / QA |
| `/sdd-drift-check` | Drift Lock | PE |
| `/sdd-fact` | Correction transverse | PE |
| `/sdd-security` | Audit sécurité | PE / AE |
| `/sdd-audit` | Audit qualité | PE / QA |
| `/aiad-init` | Bootstrap | PE / AE |
| `/aiad-onboard` | Onboarding | PE |
| `/aiad-gouvernance` | Conformité | PE / AE |
| `/aiad-health` | Diagnostic | PE |
| `/aiad-status` | Monitoring | Tous |
| `/aiad-retro` | Rétrospective | PE |
| `/aiad-intention` | Atelier d'Intention | PM / PE |
| `/aiad-sync-strat` | Alignement stratégique | PM / PE / AE / Tech Lead |
| `/aiad-demo` | Demo bi-hebdomadaire | Tous |
| `/aiad-tech-review` | Revue technique | Tech Lead / PE |
| `/aiad-standup` | Standup quotidien | Tous |
| `/aiad-dashboard` | Métriques générales | Tous |
| `/aiad-dora` | DORA metrics | Tech Lead / PE |
| `/aiad-flow` | Flow metrics | PE / PM |

---

## Commandes SDD (10)

### /sdd-init

**Quand** : Au démarrage d'un projet, après `npx aiad-sdd init`.
**Ce que ça fait** : En première étape, affiche le message suivant : *"Pour charger toutes les 27 commandes AIAD dans cette session, il est recommandé de relancer l'agent maintenant avec `/exit` puis de relancer la commande. Souhaitez-vous continuer sans redémarrage ?"* Si l'utilisateur continue sans redémarrage, note en contexte que certaines skills pourraient ne pas être disponibles. Guide ensuite la rédaction interactive de PRD.md, ARCHITECTURE.md et AGENT-GUIDE.md. Pose les questions de cadrage, génère les documents, vérifie leur complétude.
**Sortie** : 3 artefacts fondamentaux complétés et prêts à être committés dans `.aiad/`.

---

### /sdd-intent

**Quand** : Avant de rédiger une SPEC, pour chaque user story à implémenter.
**Ce que ça fait** : Guide la rédaction de l'Intent Statement en 5 champs (POURQUOI MAINTENANT, POUR QUI, OBJECTIF, CONTRAINTES, CRITÈRE DE DRIFT). Vérifie la complétude et crée le fichier dans `.aiad/intents/`. Le champ *Auteur humain* est obligatoire — principe Human Authorship.
**Pattern Interrogatory LLM (Fowler, 2026)** : `/sdd-intent` construit le contexte par questions ciblées plutôt que passivement — l'agent interroge l'humain pour révéler l'intention, il ne la devine pas.
**Sortie** : Fichier `INTENT-XXX-[nom].md` dans `.aiad/intents/` + mise à jour `_index.md`.

---

### /sdd-spec

**Quand** : Une fois l'Intent Statement validé par le PM.
**Ce que ça fait** : Vérifie qu'un Intent Statement parent existe, propose la décomposition en tâches atomiques, rédige la SPEC au format standardisé (scope, objectif, fichiers impactés, interface, comportement, cas limites, tests, critère de drift). Met à jour les index. **Option REASONS Canvas (v1.6) :** si l'utilisateur le souhaite, propose d'utiliser le REASONS Canvas (SPDD — Kevlin Henney) comme approche de structuration de la SPEC avant de passer au format standard — les deux sont compatibles, le REASONS Canvas enrichit la justification de l'intention sans remplacer le format de SPEC AIAD.
**Sortie** : Fichier `SPEC-XXX-[nom].md` dans `.aiad/specs/` + mise à jour `_index.md`.

---

### /sdd-gate

**Quand** : Avant tout lancement d'agent de code, pour valider la SPEC.
**Ce que ça fait** : Évalue les 5 critères SQS (atomicité, précision, testabilité, non-ambiguïté, scope défini) + le Critère 6 non-scorable "Test de l'Étranger". Score ≥ 4/5 : gate ouverte. Score < 4/5 : retour en révision. Si gate ouverte, prépare le Context Engineering Budget.
**Sortie** : Score SQS + décision gate ouverte/fermée + contexte d'injection préparé.
**Révision graduée outillée** : l'outil `/code-review` de Claude Code (niveaux d'effort `low`/`medium`/`high`) peut servir de révision alignée sur le SQS — SQS 3/5 → `low`, 4/5 → `medium`, 5/5 → `high`. C'est un outillage **compatible et externe** au framework : il n'ajoute aucun critère au SQS, qui reste à 5 critères + le Critère 6.
**Validation empirique externe** : l'Execution Gate répond au biais d'action de 35-65 % mesuré sur les agents SOTA — synthèse des preuves dans `docs/legitimation/execution-gate-evidence.md`.

---

### /sdd-exec

**Quand** : Gate ouverte, SPEC committée, contexte préparé.
**Ce que ça fait** : Structure le prompt de lancement avec le bon contexte (AGENT-GUIDE + ARCHITECTURE condensée + SPEC active uniquement). Exige un plan d'implémentation avant le code. Maintient l'agent dans le scope de la SPEC.
**Sortie** : Plan d'implémentation validé puis code + tests conformes à la SPEC.
**Légitimation** : l'autorité de lancement et de fusion reste humaine — pratique observée sur 29 585 PR (voir `docs/legitimation/execution-gate-evidence.md`).

---

### /sdd-resume

**Quand** : Session agent interrompue (timeout, erreur, limite de contexte).
**Ce que ça fait** : Reconstruit un contexte propre depuis le résumé de la session précédente. Évite de réinjecter tout le contexte depuis zéro. Reprend à l'étape exacte où la session s'est arrêtée.
**Sortie** : Nouvelle session agent opérationnelle avec contexte minimal et précis.

---

### /sdd-split

**Quand** : SPEC trop volumineuse pour une session, ou échec d'atomicité à la Gate.
**Ce que ça fait** : Guide la décomposition d'une SPEC en sous-SPECs atomiques selon les patterns Vertical (par couche), Flux (happy path / edge cases / errors) ou Contrat (interface d'abord). Maintient la traçabilité vers l'Intent parent.
**Sortie** : 2 à N nouvelles SPECs atomiques avec dépendances explicites, SPEC originale archivée.

---

### /sdd-context

**Quand** : Après une session agent, pour améliorer le Context Engineering Budget.
**Ce que ça fait** : Boucle de feedback post-session. Compare l'estimation de contexte avec la réalité (tokens consommés, dégradation observée, durée effective). Produit des recommandations pour la prochaine session.
**Argument économique étendu** : deux données convergentes valident l'intent-based design comme optimisation technique mesurable — R2Code (arXiv, avril 2026) : −41,7 % de tokens sur code spec-anchored ; AWS Strands (2026) : −96 % de tokens sur workflows intent-based. L'Intent Statement n'est pas seulement un artefact organisationnel — c'est une décision d'optimisation de coût mesurable.
**Sortie** : Rapport d'audit contexte avec recommandations d'optimisation pour le PE.

---

### /sdd-validate

**Quand** : À la fin de chaque session d'implémentation, avant le Drift Lock.
**Ce que ça fait** : Validation sur 3 axes — technique (lint, types, tests, build), fonctionnel (conformité aux cas de test de la SPEC), gouvernance (4 agents Tier 1 : AI-ACT, RGPD, RGAA, RGESN). Produit un rapport actionnable.
**Sortie** : Rapport VALIDÉ / CORRECTIONS / REJET avec liste des non-conformités.

---

### /sdd-drift-check

**Quand** : Avant chaque PR, et en rituel de fin d'itération (Anti-Drift Check).
**Ce que ça fait** : Scanne les fichiers modifiés, compare chaque SPEC active avec le code, détecte les drifts, vérifie le CRITÈRE DE DRIFT de l'Intent Statement d'origine. Propose les mises à jour nécessaires.
**Sortie** : Liste des SPECs synchronisées / en drift + mises à jour proposées + commit Drift Lock prêt.

---

### /sdd-fact

**Quand** : Un écart est constaté entre le comportement livré et le comportement désiré, sans justifier un nouveau cycle Intent complet (bug mineur, comportement inattendu, drift partiel).
**Ce que ça fait** : (1) Capture le fait technique — description précise de l'écart : livré vs. désiré. (2) Qualifie l'impact : fonctionnel / sécurité / performance / conformité spec. (3) Décide de l'action corrective parmi quatre options : patch immédiat / nouveau Intent Statement / ajustement SPEC existante / documentation comme dette technique connue. (4) Trace dans `.aiad/facts/FACT-NNN.md` avec lien vers la SPEC concernée — contribue au Drift Lock.
**Sortie** : Fichier `FACT-NNN.md` dans `.aiad/facts/` avec décision tracée et lien SPEC.

---

### /sdd-security

**Quand** : Après implémentation d'une fonctionnalité impliquant des accès, des données utilisateur, des secrets, ou un composant IA. Recommandé avant toute PR critique.
**Ce que ça fait** : (1) Recommande explicitement d'utiliser un modèle frontier (Opus 4.7 ou équivalent) pour cet audit. (2) Parcourt le code sur les axes OWASP Top 10, gestion des secrets, permissions des agents (Harness Engineering — minimal necessary permissions), exposition des données. (3) Vérifie la conformité avec AIAD-AI-ACT et AIAD-RGPD si le contexte le justifie. (4) Produit un rapport structuré : risques critiques / risques moyens / bonnes pratiques confirmées. (5) Persiste dans `.aiad/metrics/security/`.
**Sortie** : Rapport sécurité structuré persisté dans `.aiad/metrics/security/YYYY-MM-DD-SPEC-NNN.md`.

---

### /sdd-audit

**Quand** : Après implémentation, avant ou pendant la validation — notamment pour les fonctionnalités à fort enjeu technique ou après plusieurs itérations d'un même composant.
**Ce que ça fait** : (1) Recommande un modèle performant pour l'analyse (Opus 4.7 ou Sonnet 4.6). (2) Vérifie la conformité code ↔ SPEC : couverture des critères d'acceptance, drift détecté. (3) Évalue la dette technique introduite : complexité, couplage, lisibilité. (4) Vérifie la cohérence avec les conventions du projet (AGENT-GUIDE). (5) Produit un rapport : conformité SPEC / qualité / dette / recommandations. (6) Persiste dans `.aiad/metrics/audit/`.
**Sortie** : Rapport audit structuré persisté dans `.aiad/metrics/audit/YYYY-MM-DD-SPEC-NNN.md`.

---

## Commandes AIAD — Synchronisations (11)

### /aiad-init

**Quand** : Adoption d'AIAD sur un projet existant qui a déjà du code.
**Ce que ça fait** : En première étape, affiche le message de redémarrage (identique à `/sdd-init`). Bootstrap progressif de la structure AIAD sans disruption. Analyse le codebase existant, génère des artefacts initiaux depuis le code réel. Évite de repartir de zéro.
**Sortie** : Structure `.aiad/` initialisée depuis l'état réel du projet.

---

### /aiad-onboard

**Quand** : Un nouveau membre rejoint le projet.
**Ce que ça fait** : Génère un briefing contextualisé depuis les artefacts du projet (PRD, ARCHITECTURE, AGENT-GUIDE, SPECs actives, Lessons Learned). Pose les questions clés pour compléter les lacunes.
**Sortie** : Document d'onboarding personnalisé + liste de lecture priorisée pour le nouveau membre.

---

### /aiad-gouvernance

**Quand** : Avant le merge d'une PR ou la validation d'une SPEC impactant des aspects réglementaires.
**Ce que ça fait** : Déclenche les 4 agents de gouvernance Tier 1 (AI-ACT, RGPD, RGAA, RGESN) sur le code ou la SPEC soumis. Chaque agent dispose d'un droit de veto. Produit une checklist de conformité actionnable.
**Sortie** : Rapport de conformité par référentiel avec statut CONFORME / ALERTES / BLOQUANT.

---

### /aiad-health

**Quand** : Fin d'itération ou quand un signal d'alarme apparaît (agent incohérent, drifts fréquents).
**Ce que ça fait** : Diagnostique la santé des artefacts AIAD — cohérence PRD/SPEC/code, fraîcheur de l'AGENT-GUIDE, taux de synchronisation des SPECs, score de maturité SDD (0-5). Identifie les incohérences latentes.
**Sortie** : Rapport de santé avec score de maturité et liste priorisée d'actions correctives.

---

### /aiad-status

**Quand** : En standup, en début de session, ou pour un état du projet à la demande.
**Ce que ça fait** : Affiche l'état complet du projet — artefacts (statut, fraîcheur), SPECs actives (statut, SQS), gouvernance (agents activés), maturité globale, recommandations immédiates.
**Sortie** : Dashboard texte lisible du projet avec recommandations pour le PE.

---

### /aiad-retro

**Quand** : En fin d'itération, pour la rétrospective SDD Mode.
**Ce que ça fait** : Collecte les Lessons Learned (erreurs récurrentes de l'agent) et les Human Learnings (écarts entre intention humaine et livraison). Calcule les métriques d'itération (SQS moyen, drifts détectés, first-time success rate). Propose des actions concrètes.
**Sortie** : Entrées Lessons Learned + Human Learnings prêtes pour l'AGENT-GUIDE + métriques d'itération.

---

### /aiad-intention

**Quand** : En préparation de l'Atelier d'Intention mensuel (jamais pendant l'atelier — espace humain pur, pas d'IA).
**Ce que ça fait** : Compile les Intent Statements du mois, les métriques d'alignement (CRITÈRE DE DRIFT respecté ?), les Human Learnings et les écarts intention/livraison. Prépare les données pour les 4 temps de l'atelier.
**Sortie** : Dossier de préparation de l'Atelier d'Intention avec données et questions directrices.

---

### /aiad-sync-strat

**Quand** : Mensuel — synchronisation stratégique PM / PE / AE / Tech Lead.
**Ce que ça fait** : Aligne l'équipe sur la stratégie produit et les Intents actifs. Vérifie la validité du PRD, révise les Outcome Criteria si nécessaire, ajuste les priorités du backlog en fonction des métriques DORA et Flow.
**Sortie** : Compte-rendu de synchronisation avec décisions documentées et Intents mis à jour.

---

### /aiad-demo

**Quand** : Bi-hebdomadaire — démonstration des fonctionnalités livrées.
**Ce que ça fait** : Prépare la démo depuis les SPECs terminées de la période. Structure la présentation autour des Intent Statements d'origine (pourquoi) puis de la livraison (quoi). Vérifie l'alignement intention/livraison.
**Sortie** : Structure de démo avec questions de validation pour le PM.

---

### /aiad-tech-review

**Quand** : Bi-hebdomadaire — revue de cohérence technique.
**Ce que ça fait** : Vérifie que l'ARCHITECTURE.md est toujours cohérente avec le code réel. Identifie les dérives de patterns, les nouvelles dépendances non documentées, les ADR à rédiger.
**Sortie** : Liste des incohérences architecture/code avec propositions de mise à jour des artefacts.

---

### /aiad-standup

**Quand** : Quotidien — standup SDD Mode (15 min max).
**Ce que ça fait** : Structure le standup autour de 3 questions SDD : Quelle SPEC aujourd'hui ? Quel Context Engineering Budget ? Y a-t-il un drift à signaler ? Affiche l'état des SPECs actives et les blockers.
**Sortie** : Synthèse standup avec SPEC du jour, budget contexte préparé, actions immédiates.

---

## Commandes AIAD — Métriques (3)

### /aiad-dashboard

**Quand** : À la demande, pour une vue d'ensemble des métriques du projet.
**Ce que ça fait** : Agrège et affiche les métriques SDD (SQS moyen, taux de drift, first-time success rate, taux d'alignement intention/livraison) et les métriques DORA et Flow depuis `.aiad/metrics/`.
**Sortie** : Dashboard métriques complet persisté dans `.aiad/metrics/dashboard.md`.

---

### /aiad-dora

**Quand** : En rétrospective ou en revue de performance livraison.
**Ce que ça fait** : Calcule les 4 indicateurs DORA — Deployment Frequency, Lead Time for Changes, Change Failure Rate, MTTR — depuis les données de déploiement et les SPECs. Compare aux benchmarks industrie.
**Sortie** : Rapport DORA avec positionnement Elite / High / Medium / Low et recommandations.

---

### /aiad-flow

**Quand** : En analyse de flux ou pour détecter les goulots d'étranglement du cycle SDD.
**Ce que ça fait** : Calcule les 5 indicateurs Flow — Cycle Time, Lead Time, Throughput, WIP, Flow Efficiency — depuis les Intent Statements et les SPECs. Identifie les étapes qui ralentissent la livraison.
**Sortie** : Rapport Flow avec visualisation du cycle et recommandations d'optimisation du WIP.

---

## Glossaire

| Terme | Définition |
|-------|------------|
| **Intent Statement** | Artefact de premier ordre : 5 champs (POURQUOI MAINTENANT, POUR QUI, OBJECTIF, CONTRAINTES, CRITÈRE DE DRIFT). Archivé dans `.aiad/intents/`. |
| **SPEC** | Spécification technique détaillée pour une tâche atomique. Activation par tâche uniquement. |
| **SQS** | Spec Quality Score — 5 critères scorables + Critère 6 "Test de l'Étranger" (non-scorable). Score ≥ 4/5 requis pour passer la Gate. |
| **Execution Gate** | Point de contrôle entre SPEC validée et lancement agent. Aucun code avant Gate ouverte. |
| **Drift Lock** | Politique de PR : code et SPEC synchronisés dans le même commit. |
| **Anti-Drift Check** | Rituel de fin d'itération vérifiant la synchronisation artefacts / code. Commande : `/sdd-drift-check`. |
| **Spec Drift** | Écart entre l'état d'une SPEC et l'état réel du code. Traité comme échec de processus. |
| **Spec-Anchored** | La spec est maintenue comme ancre permanente, synchronisée avec le code à chaque PR. Distinct de spec-first et spec-as-source. |
| **Context Engineering Budget** | Capacité d'absorption de contexte d'un agent IA. Règle : session unique, < 35 min, contexte minimal. Responsabilité du PE. |
| **Context Rot** | Dégradation de la qualité LLM avant la limite théorique de contexte. Justifie la SPEC comme anchor point stable. |
| **Human Authorship** | La paternité de l'intention ne se délègue pas. Tout Intent Statement est rédigé par un humain identifiable. |
| **Human Learnings** | Section AGENT-GUIDE documentant les écarts entre intention humaine et livraison (≠ Lessons Learned qui documentent les erreurs de l'agent). |
| **Lessons Learned** | Section AGENT-GUIDE documentant les erreurs récurrentes de l'agent (≥ 2 occurrences sur des tâches différentes). |
| **Atelier d'Intention** | Rituel mensuel (60 min max, humain pur, pas d'IA) : "Construisons-nous toujours ce que nous voulions ?". |
| **PRD** | Product Requirement Document — source de vérité produit. Injecté uniquement en cadrage. |
| **ARCHITECTURE** | Document des standards techniques — injecté condensé (500 tokens) dans chaque session agent. |
| **AGENT-GUIDE** | Contexte permanent agent : règles absolues, conventions, Lessons Learned, Human Learnings, gouvernance. |
| **AGENT-GUIDE Gouvernance** | 4 guides réglementaires Tier 1 avec droit de veto : AIAD-AI-ACT, AIAD-RGPD, AIAD-RGAA, AIAD-RGESN. |
| **DORA Metrics** | 4 indicateurs livraison : Deployment Frequency, Lead Time, Change Failure Rate, MTTR. |
| **Flow Metrics** | 5 indicateurs de flux : Cycle Time, Lead Time, Throughput, WIP, Flow Efficiency. |
| **Product Engineer (PE)** | Gardien de l'intention tout au long du cycle, en orchestrant des agents IA pour la réaliser sans la trahir. |
| **DoOD** | Definition of Output Done — critères de complétion d'une tâche, définis dans la SPEC. |
| **sdd-fact** | Commande de capture et qualification d'un écart livré/désiré sans cycle Intent complet. Trace dans `.aiad/facts/`. |
| **sdd-security** | Commande d'audit sécurité du code : OWASP Top 10, secrets, permissions agents (Harness Engineering), conformité réglementaire. |
| **sdd-audit** | Commande d'audit qualité du code : conformité SPEC, dette technique, cohérence AGENT-GUIDE. |
| **Harness Engineering** | Pratique centrale de l'AE : configuration, supervision et gouvernance des agents selon le principe de minimal necessary permissions. |
| **REASONS Canvas** | Outil SPDD (Kevlin Henney) optionnel pour structurer la justification d'une SPEC — utilisable en entrée de `/sdd-spec`. |
| **Fact Technique** | Artefact de `/sdd-fact` : capture d'un écart constaté avec qualification d'impact et décision d'action corrective. |

---

## RACI SDD Mode

**R** = Réalise · **A** = Approuve · **C** = Consulté · **I** = Informé

| Activité | PM | PE | AE | QA | TL |
|----------|----|----|----|----|-----|
| Intent Capture | A | R | I | C | I |
| Rédaction SPEC | C | R/A | I | C | C |
| Spec Quality Score | I | R/A | I | C | C |
| Context Engineering Budget | I | R/A | C | I | I |
| Orchestration agent IA | I | R/A | C | I | I |
| Validation technique | I | R/A | I | C | C |
| Validation fonctionnelle | C | I | I | R/A | I |
| Validation métier | R/A | C | I | C | I |
| Drift Lock (PR) | I | R/A | I | C | C |
| Anti-Drift Check | I | R/A | C | I | C |
| Lessons Learned | I | R | C | I | I |
| Mise à jour AGENT-GUIDE | I | C | R/A | I | C |

---

## Structure .aiad/

```
.aiad/                              ← Créé par npx aiad-sdd init
├── PRD.md                          ← Vision produit et user stories
├── ARCHITECTURE.md                 ← Décisions techniques et patterns
├── AGENT-GUIDE.md                  ← Contexte permanent + Lessons Learned + Human Learnings
├── gouvernance/                    ← Agents de gouvernance Tier 1
│   ├── _index.md
│   ├── AIAD-AI-ACT.md             ← Conformité EU AI Act
│   ├── AIAD-RGPD.md               ← Privacy by Design, RGPD
│   ├── AIAD-RGAA.md               ← Accessibilité RGAA 4.1 / WCAG 2.1
│   └── AIAD-RGESN.md              ← Écoconception numérique RGESN v2
├── intents/                        ← Intent Statements archivés
│   ├── _index.md
│   ├── INTENT-001-[nom].md
│   └── archive/
├── specs/
│   ├── _index.md
│   ├── SPEC-001-[nom].md           ← Une SPEC par fonctionnalité
│   └── archive/
├── facts/                          ← Traces /sdd-fact (v1.6)
│   └── FACT-NNN.md
├── metrics/                        ← Persistance des données métriques
│   ├── security/                   ← Rapports /sdd-security (v1.6)
│   └── audit/                      ← Rapports /sdd-audit (v1.6)
└── CHANGELOG-ARTEFACTS.md

.claude/
└── commands/                       ← 24 commandes slash Claude Code
    ├── sdd-init.md
    ├── sdd-intent.md
    ├── sdd-spec.md
    ├── sdd-gate.md
    ├── sdd-exec.md
    ├── sdd-resume.md
    ├── sdd-split.md
    ├── sdd-context.md
    ├── sdd-validate.md
    ├── sdd-drift-check.md
    ├── aiad-init.md
    ├── aiad-onboard.md
    ├── aiad-gouvernance.md
    ├── aiad-health.md
    ├── aiad-status.md
    ├── aiad-retro.md
    ├── aiad-intention.md
    ├── aiad-sync-strat.md
    ├── aiad-demo.md
    ├── aiad-tech-review.md
    ├── aiad-standup.md
    ├── aiad-dashboard.md
    ├── aiad-dora.md
    ├── aiad-flow.md
    ├── sdd-fact.md
    ├── sdd-security.md
    └── sdd-audit.md

CLAUDE.md                           ← Configuré par npx aiad-sdd init
```

---

*AIAD SDD Mode v1.6 — aiad.ovh — Open Source — Steeve Evers*
