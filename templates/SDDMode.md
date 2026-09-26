# AIAD SDD Mode — v1.20

**Spec Driven Development — Guide opérationnel pour Product Engineers AIAD**

*Framework AIAD — aiad.ovh — Open Source*

> **Deux cycles de versionnage.** `v1.20` désigne la version du **logiciel** SDD Mode (le package `aiad-sdd` : CLI, commandes slash, skills, dashboards). La **doctrine** du framework AIAD (valeurs, responsabilités, principes) suit son propre rythme — le cycle mensuel d'évolution du framework — et n'avance pas au même tempo. Ce guide documente le logiciel ; la doctrine est portée par `intention.md` (document publié avec le framework AIAD) et la Constitution.

---

## Nouveautés depuis la v1.6

| Version | Apport principal |
|---------|------------------|
| **v1.7** | Namespacing des commandes en 3 routers (`/sdd`, `/aiad`, `/aiad-help`) — −94 % de frontmatter chargé à froid |
| **v1.8** | Profil `--minimal` + chemin d'upgrade incrémental depuis une v1.x |
| **v1.9** | 7 skills réutilisables auto-déclenchées (`.claude/skills/`) |
| **v1.10** | Traçabilité machine-vérifiable : `/sdd trace`, 4 annotations code, GitHub Action `--fail-on-gap` |
| **v1.11** | Variante EARS optionnelle (`/sdd spec --ears`) + lint strict à la Gate |
| **v1.12** | `emit-rules` multi-runtime : un seul AGENT-GUIDE → Claude / Cursor / Codex / Gemini |
| **v1.13** | Dashboard HTML multi-pages + publication GitHub Pages |
| **v1.14** | Version stratégique : 46 items, 323 tests, packs gouvernance par juridiction, écosystème (GitHub Action, VS Code, CI multi-forges), zero-dep préservé |
| **v1.15 → v1.17** | Dashboard PM Cockpit (131 sections, 47 boucles d'audit), assistants `/sdd prd` et `/sdd arch`, `/aiad guide`, commande `feedback`, recommandations de modèle sur les 30 commandes, légitimation empirique (Batch A/B/C/D) |
| **v1.18** | « Advisory → enforced » : verdicts déterministes (exit 0/1/2 + JSON validé), veto de gouvernance Tier 1 fail-closed par hooks, phase Research gradée (`GO / CONDITIONAL GO / DEFER / NO-GO`), exécution phasée avec mini-gates, suite canary, revue croisée multi-modèles (`/sdd validate --cross-model`) |
| **v1.19** | Runtime Kiro dans `emit-rules`, comparatif public, archivage automatique des artefacts livrés (`archive done`), empreinte tokens par artefact dans `/sdd context`, squelettes de tests depuis EARS (`suggest-tests`), collecte DORA automatisée en CI, dashboard enrichi |
| **v1.20** | Doctrine AIAD v1.9 livrée et verrouillée (agents AI-ACT et RGPD à jour, guides, contrôle de drift en CI et à la release), pré-contrôle déterministe de la Gate (`gate-precheck`), sections de SPEC « Points d'arrêt de l'agent » et « Périmètre d'exécution de l'agent », contexte hérité dans `/sdd context`, `update` qui sauvegarde les agents de gouvernance modifiés localement, parité des commandes livrées |

> **Compatibilité.** Les anciens alias plats (`/sdd-spec`, `/aiad-status`…) restent fonctionnels jusqu'à la v2 avec message de migration. Les Intent / SPEC d'une v1.x sont migrés sans repartir de zéro (`aiad-sdd migrate`). Le runtime reste **zero-dependency**.

---

## Installation en 1 minute

```bash
npx aiad-sdd init
```

Installe dans votre projet : structure `.aiad/`, 4 agents de gouvernance Tier 1, ~30 commandes slash Claude Code regroupées en 3 routers, 7 skills réutilisables, `CLAUDE.md` configuré.

```bash
# Options utiles
npx aiad-sdd init --minimal            # squelette obligatoire seul, sans gouvernance ni templates optionnels
npx aiad-sdd init --sans-gouvernance   # sans les agents de gouvernance
npx aiad-sdd update                    # met à jour commandes + gouvernance + skills, préserve vos fichiers
npx aiad-sdd update --check            # exit 1 si commandes / gouvernance / hooks divergent du package npm
npx aiad-sdd migrate                   # détecte une version < courante et applique les migrations idempotentes
npx aiad-sdd status                    # vérifie la maturité SDD (score 0-5)
npx aiad-sdd doctor                    # diagnostic unifié 7 catégories (--json disponible)
```

Puis dans Claude Code :

```
/sdd init
```

> **i18n.** Les sorties CLI sont disponibles en FR/EN (`--lang` → `AIAD_LANG` → `LANG`). Un flag global `--dry-run` protège les commandes destructives.

---

## Les 3 principes fondateurs

### Principle #1 — Spec as Living Invariant

La SPEC n'est pas un document de passage. Elle reste la source de vérité entre l'intention humaine et le code agent — avant, pendant et après l'implémentation. AIAD se positionne au niveau **spec-anchored** : la spec n'est ni abandonnée après la tâche (spec-first), ni générateur du code (spec-as-source). Elle est synchronisée avec le code à chaque PR via le Drift Lock, et désormais **machine-vérifiable** via les annotations de traçabilité (`/sdd trace`, v1.10).

### Principle #2 — Drift = Échec de Processus

Le spec drift — code qui évolue sans que les artefacts suivent — est traité comme un **échec de processus**, pas une erreur d'agent. La mise à jour des artefacts fait partie de la Definition of Done. Une tâche dont le code est mergé mais la SPEC désynchronisée n'est pas terminée. Depuis v1.10, un gap de traçabilité non annoté peut faire échouer la pipeline CI (`--fail-on-gap`).

### Principle #3 — Context Engineering Budget

Le Product Engineer est responsable du budget de contexte de chaque session agent. Règle pratique : une session = un objectif, durée < 35 min, contexte = AGENT-GUIDE + ARCHITECTURE condensée (500 tokens) + SPEC active. Le PRD complet n'est injecté qu'en phase de cadrage. Au-delà de 35 min, lancer `/compact` et relancer une session propre.

**Seuil opérationnel recommandé :** utiliser 60-70 % du contexte disponible comme maximum effectif (ex. : 200k tokens disponibles → budget max = 130k). Au-delà, les symptômes de dégradation (context rot) apparaissent avant la limite théorique : réponses moins précises, oublis de contraintes de spec, comportements répétitifs. **Règle de placement :** toujours placer l'Intent Statement et la SPEC active en tête de contexte pour contrer le "lost in the middle effect".

**Délégation à des sub-agents (doctrine — cycle d'évolution de septembre 2026) :** le coût d'une délégation dépend du mécanisme du harness, et la règle s'énonce ainsi. **Si le sub-agent hérite de la conversation parente** — comportement par défaut de Claude Code depuis août 2026 —, alors son coût vaut *contexte parent au moment du fork + travail propre*, et non un coût marginal. Conséquences : (1) déléguer **tôt**, quand le contexte parent est encore léger ; (2) le point de fork est un poste de coût explicite du Context Audit ; (3) si l'héritage est désactivé, le sub-agent part d'un contexte vierge et doit recevoir explicitement l'Intent Statement et la SPEC active. La messagerie entre sessions d'agents ne dispense pas de la traçabilité : toute décision prise entre agents qui modifie un comportement est reportée dans la SPEC (Drift Lock).

**Compaction et boucles (doctrine — cycle d'évolution de septembre 2026) :** deux pratiques issues du terrain complètent le budget. L'**intentional compaction** (Dex Horthy, HumanLayer) consiste à compacter délibérément l'historique en un état écrit — décisions prises, fichiers touchés, prochaines étapes — plutôt que de subir la compaction automatique. Le **loop engineering** consiste à structurer chaque boucle agentique autour d'un objectif, d'un critère de sortie et d'une vérification. Ce vocabulaire date de 2026 et n'est pas stabilisé ; il est adopté comme description de pratiques, pas comme norme.

**Référence modèles (au 25 septembre 2026 — à revalider à chaque cycle mensuel d'évolution du framework) :** les fenêtres natives de 1M tokens se sont généralisées sur les modèles frontières — Claude Sonnet 5, par exemple, a été diffusé fin juin 2026 dans Claude Code, Kiro et GitHub Copilot avec une fenêtre native de 1M. Les modèles rapides peuvent rester à 200k. La fenêtre disponible ne change pas le seuil opérationnel de 60-70 % — elle le déplace vers le haut ; elle ne dispense pas du découpage en sessions à objectif unique.

**Règle de datation (doctrine — cycle d'évolution de septembre 2026) :** toute hypothèse de capacité citée dans un artefact AIAD — taille de fenêtre, prix, limite d'usage — est **datée** et revalidée à chaque cycle mensuel d'évolution du framework. Un tarif promotionnel ne sert jamais de base de calcul d'un budget : en 2026, un budget calibré sur le tarif de lancement d'un modèle est devenu faux à l'expiration de la promotion. Depuis v1.15, **chacune des 30 commandes porte une recommandation de modèle** (frontier pour audit/sécurité, modèle rapide pour les tâches mécaniques).

**Argument économique :** une session spec-anchored consomme en moyenne 41,7 % de tokens en moins qu'une session sans spécification (R2Code, arXiv avril 2026). Une seconde mesure converge : les approches *intent-based* réduisent jusqu'à 96 % les tokens consommés sur des tâches d'agents (AWS Strands, 2026). L'Intent Statement n'est donc pas seulement un artefact organisationnel — c'est une **décision technique d'optimisation mesurable** du Context Engineering Budget : une intention claire en tête de contexte réduit l'exploration de l'agent, donc la consommation. AIAD étant model-agnostic, cet avantage s'applique quelle que soit la plateforme — contrairement aux limites de tokens des outils propriétaires à abonnement fixe. La commande `/sdd context` fournit une estimation du coût évité par session. *(La convergence terminologique « intent-based » (AWS Strands) / « Intent Statement » (AIAD) positionne AIAD comme précurseur empiriquement validé — Valeur 5, Empirisme sans Concession.)*

---

## Namespacing des commandes (v1.7)

Les ~30 commandes plates sont regroupées en **3 routers** afin de réduire de **94 %** le frontmatter chargé à froid dans Claude Code.

| Router | Périmètre |
|--------|-----------|
| `/sdd <sub>` | Cycle SDD : `init`, `intent`, `prd`, `arch`, `spec`, `gate`, `exec`, `validate`, `drift-check`, `trace`, `fact`, `security`, `audit`, `context`, `resume`, `split` |
| `/aiad <sub>` | Rituels & métriques : `init`, `onboard`, `status`, `health`, `gouvernance`, `standup`, `demo`, `retro`, `intention`, `sync-strat`, `dora`, `flow`, `dashboard`, `dashboard-html`, `guide` |
| `/aiad-help [sub]` | Aide contextuelle |

Les anciens alias plats (`/sdd-spec`, `/aiad-status`…) restent fonctionnels **jusqu'à la v2** et affichent un message de migration. Dans ce guide, la forme router (`/sdd spec`) est canonique.

---

## Workflow SDD Mode

Le cycle se lit de haut en bas. Deux points de décision (◇) peuvent renvoyer en arrière ; la fin d'itération reboucle sur l'étape 1.

```text
  PROCESSUS AIAD · SDD MODE        npx aiad-sdd init → itérations
  ════════════════════════════════════════════════════════════

  ┌ 0 · INITIALISATION                 npx aiad-sdd init · /sdd init
  │     → PRD · ARCHITECTURE · AGENT-GUIDE · structure .aiad/
  ▼
  ┌ 1 · INTENT CAPTURE                              /sdd intent
  │     → Intent Statement archivé  (Human Authorship)
  ▼
  ┌ 2 · SPEC WRITING            /sdd spec [--ears] · /sdd split
  │     → SPEC draft  ·  Context Engineering Budget préparé
  ▼
  ◇ 3 · EXECUTION GATE                                /sdd gate
  │     SQS ≥ 4/5 ?
  │       ├─ non   →  retour à l'étape 2 (SPEC WRITING)
  │       └─ oui   ↓
  ▼
  ┌ 4 · DÉVELOPPEMENT AGENT             /sdd exec · /sdd resume
  │     → Code + tests + annotations (@intent/@spec/@verified-by/@governance)
  ▼
  ◇ 5 · VALIDATION                                /sdd validate
  │     Tech · Fonctionnel · Métier · Gouvernance
  │       ├─ CORRECTIONS / REJET  →  retour à l'étape 4
  │       └─ VALIDÉ   ↓
  ▼
  ┌ 6 · DRIFT LOCK                /sdd drift-check · /sdd trace
  │     → Code + SPEC dans le même PR · matrice de traçabilité à jour
  ▼
  ┌ 7 · DÉPLOIEMENT
  │     → Staging → Prod · Monitoring · Rollback si besoin
  ▼
  ┌ 8 · CONSOLIDATION & RITUELS
  │     → /aiad retro · /aiad intention · /aiad status · /aiad dashboard-html
  │
  └──▶  ↩ nouvelle itération  (retour à l'étape 1)
```

---

## Workflow SDD Mode — Détail par étape

| Étape | Acteur | Entrées | Sorties | Durée | Dépendances | Commande |
|-------|--------|---------|---------|-------|-------------|---------|
| **1. Initialisation** | PM, Tech Lead, AE | Décision de démarrer, Node.js 18+ | PRD.md, ARCHITECTURE.md, AGENT-GUIDE.md, structure .aiad/ | 3-7 jours | Aucune | `npx aiad-sdd init` puis `/sdd init` |
| **2. Intent Capture** | PE + PM | PRD.md validé, user stories priorisées | Intent Statement validé et archivé dans `.aiad/intents/` | 15-30 min | Étape 1 complète | `/sdd intent` |
| **3. Spec Writing** | PE | Intent Statement validé, ARCHITECTURE condensé, AGENT-GUIDE | SPEC draft committée dans `.aiad/specs/` | 30-60 min | Intent Statement validé | `/sdd spec [--ears]`, `/sdd split` |
| **4. Execution Gate** | PE | SPEC draft | SPEC validée (SQS ≥ 4/5), Context Engineering Budget préparé | 15-30 min | SPEC draft générée | `/sdd gate` |
| **5. Développement agent** | PE | SPEC validée et committée | Code + tests + annotations de traçabilité | 2h - 3 jours | Gate passée | `/sdd exec`, `/sdd resume` |
| **6. Validation** | PE, QA, PM | Code implémenté, tests passants, SPEC | Rapports tech + fonc + métier + gouvernance | 1h - 4h | Implémentation complète | `/sdd validate` |
| **7. Drift Lock** | PE | Code validé, SPEC de référence | SPEC synchronisée, matrice de traçabilité, PR mergeable | 10 min | Validations passées | `/sdd drift-check`, `/sdd trace` |
| **8. Déploiement** | PE | PR validée et mergée | Application en production, artefacts synchronisés | 30 min - 2h | Drift Lock effectué | — |
| **9. Consolidation & Rituels** | Tous | Fin d'itération | AGENT-GUIDE mis à jour, métriques, dashboard, plan d'amélioration | Variable | ≥ 1 itération complète | `/aiad retro`, `/aiad intention`, `/aiad status`, `/aiad dashboard-html` |

---

## Index des commandes

### Cycle SDD — `/sdd <sub>`

| Commande | Phase | Rôle principal |
|----------|-------|----------------|
| `/sdd init` | Initialisation | PE / Tech Lead |
| `/sdd intent` | Intent Capture | PE |
| `/sdd prd` | Cadrage produit *(v1.15)* | PM / PE |
| `/sdd arch` | Cadrage architecture *(v1.15)* | Tech Lead / PE |
| `/sdd spec` | Spec Writing | PE |
| `/sdd gate` | Execution Gate | PE |
| `/sdd exec` | Développement | PE |
| `/sdd resume` | Développement | PE |
| `/sdd split` | Spec Writing / support | PE |
| `/sdd context` | Support transversal | PE |
| `/sdd validate` | Validation | PE / QA |
| `/sdd drift-check` | Drift Lock | PE |
| `/sdd trace` | Traçabilité *(v1.10)* | PE / QA |
| `/sdd fact` | Correction transverse | PE |
| `/sdd security` | Audit sécurité | PE / AE |
| `/sdd audit` | Audit qualité | PE / QA |

### Rituels & métriques — `/aiad <sub>`

| Commande | Phase | Rôle principal |
|----------|-------|----------------|
| `/aiad init` | Bootstrap | PE / AE |
| `/aiad onboard` | Onboarding | PE |
| `/aiad gouvernance` | Conformité | PE / AE |
| `/aiad health` | Diagnostic | PE |
| `/aiad status` | Monitoring | Tous |
| `/aiad retro` | Rétrospective | PE |
| `/aiad intention` | Atelier d'Intention | PM / PE |
| `/aiad sync-strat` | Alignement stratégique | PM / PE / AE / Tech Lead |
| `/aiad demo` | Demo bi-hebdomadaire | Tous |
| `/aiad tech-review` | Revue technique | Tech Lead / PE |
| `/aiad standup` | Standup quotidien | Tous |
| `/aiad dashboard` | Métriques générales | Tous |
| `/aiad dashboard-html` | Dashboard HTML / PM Cockpit *(v1.13+)* | PM / PE |
| `/aiad dora` | DORA metrics | Tech Lead / PE |
| `/aiad flow` | Flow metrics | PE / PM |
| `/aiad guide` | Guide pratique + backlog health *(v1.15)* | PM / PE |

### Aide & feedback

| Commande | Rôle |
|----------|------|
| `/aiad-help [sub]` | Aide contextuelle sur une commande ou un router |
| `feedback` | Collecte qualitative opt-in (invitations périodiques) |

---

## Commandes du cycle SDD

### /sdd init

**Quand** : Au démarrage d'un projet, après `npx aiad-sdd init`.
**Ce que ça fait** : En première étape, affiche le message suivant : *"Pour charger toutes les commandes AIAD dans cette session, il est recommandé de relancer l'agent maintenant avec `/exit` puis de relancer la commande. Souhaitez-vous continuer sans redémarrage ?"* Si l'utilisateur continue sans redémarrage, note en contexte que certaines skills pourraient ne pas être disponibles. Guide ensuite la rédaction interactive de PRD.md, ARCHITECTURE.md et AGENT-GUIDE.md. Pose les questions de cadrage, génère les documents, vérifie leur complétude.
**Sortie** : 3 artefacts fondamentaux complétés et prêts à être committés dans `.aiad/`.

---

### /sdd intent

**Quand** : Avant de rédiger une SPEC, pour chaque user story à implémenter.
**Ce que ça fait** : Guide la rédaction de l'Intent Statement en 5 champs (POURQUOI MAINTENANT, POUR QUI, OBJECTIF, CONTRAINTES, CRITÈRE DE DRIFT). Vérifie la complétude et crée le fichier dans `.aiad/intents/`. Le champ *Auteur humain* est obligatoire — principe Human Authorship.
**Note** : la commande implémente le pattern *Interrogatory LLM* (Fowler, 2026) — l'agent construit le contexte en interrogeant l'humain par questions ciblées plutôt qu'en recevant passivement un prompt. C'est aussi une optimisation technique : une intention claire en début de contexte réduit l'exploration de l'agent et la consommation de tokens (approches *intent-based* : jusqu'à −96 % de tokens, AWS Strands 2026). Voir le Context Engineering Budget (Principe #3).
**Anti-patterns à prévenir** : Tang et al. (arXiv 2605.29442, 2026) ont identifié 7 formes récurrentes de désalignement sur 20 574 sessions terrain — 91,49 % nécessitent une correction humaine. Un Intent Statement précis est la première défense contre les 4 formes les plus documentées : mauvaise interprétation de l'intent (→ qualifier POURQUOI MAINTENANT et OBJECTIF sans ambiguïté), scope creep non sollicité (→ renseigner CONTRAINTES et périmètre explicitement), solutions hors-spec (→ le champ CONTRAINTES doit inclure les choix d'implémentation structurants), hallucinations d'exigences (→ le champ CRITÈRE DE DRIFT limite l'espace de solution de l'agent). Un Intent Statement vague déplace le problème de gouvernance vers l'Execution Gate — mieux vaut le résoudre ici.
**Sortie** : Fichier `INTENT-NNN-[slug].md` dans `.aiad/intents/` + mise à jour `_index.md`.

---

### /sdd prd  *(v1.15)*

**Quand** : En cadrage produit, en amont ou en complément de `/sdd init`.
**Ce que ça fait** : Assistant PRD guidé. Pose des questions PM orientées discovery (problème, utilisateurs, outcomes attendus, hypothèses, risques) et structure les réponses dans un PRD exploitable par le cycle SDD. Alimente l'attribution Outcomes ↔ Intents du dashboard PM.
**Sortie** : PRD.md (ou section PRD) structuré, prêt pour la capture d'Intents.

---

### /sdd arch  *(v1.15)*

**Quand** : En cadrage technique, en amont ou en complément de `/sdd init`.
**Ce que ça fait** : Assistant ARCHITECTURE guidé. Pose des questions d'architecte (contraintes, choix de stack, frontières de modules, décisions structurantes, ADR à tracer) et produit un ARCHITECTURE.md cohérent avec le PRD.
**Sortie** : ARCHITECTURE.md structuré + amorces d'ADR.

---

### /sdd spec

**Quand** : Une fois l'Intent Statement validé par le PM.
**Ce que ça fait** : Vérifie qu'un Intent Statement parent existe, propose la décomposition en tâches atomiques, rédige la SPEC au format standardisé (scope, objectif, fichiers impactés, interface, comportement, cas limites, tests, critère de drift). Met à jour les index. **Option REASONS Canvas :** propose, si souhaité, le REASONS Canvas (SPDD — Kevlin Henney) comme approche de structuration avant le format standard — les deux sont compatibles. **Option EARS (`--ears`, v1.11) :** génère une SPEC au format EARS (Easy Approach to Requirements Syntax) avec le template `spec-ears-template.md`. La cohabitation prose / EARS est totale, sans migration imposée.
**Sortie** : Fichier `SPEC-NNN-N-[slug].md` dans `.aiad/specs/` + mise à jour `_index.md`.

---

### /sdd gate

**Quand** : Avant tout lancement d'agent de code, pour valider la SPEC.
**Ce que ça fait** : Évalue les 5 critères SQS (atomicité, précision, testabilité, non-ambiguïté, scope défini) + le Critère 6 non-scorable "Test de l'Étranger". Score ≥ 4/5 : gate ouverte. Score < 4/5 : retour en révision. Si gate ouverte, prépare le Context Engineering Budget. **Lint EARS (v1.11)** : sur une SPEC `--ears`, le skill `ears-validator` passe en mode strict (règles R1–R7 : mots interdits, multi-SHALL, déclencheurs WHEN/WHILE/IF/WHERE, sujet explicite, verbes observables, quantification, conjonctions) — +1 sur le critère 2 SQS si 0 violation ; critère 2 forcé à 0 si ≥ 1 violation (la Gate se ferme).
**Légitimation empirique** : l'Execution Gate n'est pas une précaution philosophique — c'est une réponse à un biais d'action mesuré de 35 à 65 % sur les agents de pointe (FixedBench, arXiv mai 2026) et au constat que l'autorité de fusion reste « presque exclusivement humaine » (29 585 PRs analysés). Dossier de preuves : `https://github.com/everssteeve/sdd-mode/blob/main/docs/legitimation/execution-gate-evidence.md`.
**Effets irréversibles** : si l'exécution implique des effets financiers ou opérationnels irréversibles (agent à autonomie financière, déploiement automatique, achat), la Gate doit en outre valider les **plafonds d'autonomie** et les points de contrôle (plafond documenté, journal d'audit, procédure de rollback). Voir `https://github.com/everssteeve/sdd-mode/blob/main/templates/.aiad/gouvernance/AIAD-AI-ACT.md`.
**Mapping SQS ↔ révision graduée** : la révision du code produit peut être outillée via `/code-review` de Claude Code, dont les niveaux d'effort se mappent sur le SQS — SQS 3/5 → effort `low`, SQS 4/5 → `medium`, SQS 5/5 → `high`. Plus l'intention a été spécifiée finement, plus la révision peut être ciblée. C'est une implémentation outillée de la « programmation agentique sérieuse » (Fowler) — l'humain valide, il ne délègue pas.
**Sortie** : Score SQS + décision gate ouverte/fermée + contexte d'injection préparé.

---

### /sdd exec

**Quand** : Gate ouverte, SPEC committée, contexte préparé.
**Ce que ça fait** : Structure le prompt de lancement avec le bon contexte (AGENT-GUIDE + ARCHITECTURE condensée + SPEC active uniquement). Exige un plan d'implémentation avant le code. Maintient l'agent dans le scope de la SPEC et exige les 4 annotations de traçabilité (`@intent`, `@spec`, `@verified-by`, `@governance`) dans le code produit.
**Sortie** : Plan d'implémentation validé puis code + tests + annotations conformes à la SPEC.

---

### /sdd resume

**Quand** : Session agent interrompue (timeout, erreur, limite de contexte).
**Ce que ça fait** : Reconstruit un contexte propre depuis le résumé de la session précédente. Évite de réinjecter tout le contexte depuis zéro. Reprend à l'étape exacte où la session s'est arrêtée.
**Sortie** : Nouvelle session agent opérationnelle avec contexte minimal et précis.

---

### /sdd split

**Quand** : SPEC trop volumineuse pour une session, ou échec d'atomicité à la Gate.
**Ce que ça fait** : Guide la décomposition d'une SPEC en sous-SPECs atomiques selon les patterns Vertical (par couche), Flux (happy path / edge cases / errors) ou Contrat (interface d'abord). Maintient la traçabilité vers l'Intent parent. Le signal de découpe est aussi remonté par le module *scope T-shirt* du dashboard PM.
**Sortie** : 2 à N nouvelles SPECs atomiques avec dépendances explicites, SPEC originale archivée.

---

### /sdd context

**Quand** : Après une session agent, pour améliorer le Context Engineering Budget.
**Ce que ça fait** : Boucle de feedback post-session. Compare l'estimation de contexte avec la réalité (tokens consommés, dégradation observée, durée effective). S'appuie sur le skill `context-budget` (calcul M1–M5). Produit des recommandations pour la prochaine session.
**Sortie** : Rapport d'audit contexte avec recommandations d'optimisation pour le PE.

---

### /sdd validate

**Quand** : À la fin de chaque session d'implémentation, avant le Drift Lock.
**Ce que ça fait** : Validation sur 3 axes — technique (lint, types, tests, build), fonctionnel (conformité aux cas de test de la SPEC), gouvernance (4 agents Tier 1 : AI-ACT, RGPD, RGAA, RGESN). Compose les skills `drift-detection`, `regulatory-veto` et `sqs-scoring` sans dupliquer leur logique. Produit un rapport actionnable.
**Sortie** : Rapport VALIDÉ / CORRECTIONS / REJET avec liste des non-conformités.

---

### /sdd drift-check

**Quand** : Avant chaque PR, et en rituel de fin d'itération (Anti-Drift Check).
**Ce que ça fait** : Scanne les fichiers modifiés, compare chaque SPEC active avec le code (skill `drift-detection`), détecte les drifts, vérifie le CRITÈRE DE DRIFT de l'Intent Statement d'origine. Propose les mises à jour nécessaires.
**Sortie** : Liste des SPECs synchronisées / en drift + mises à jour proposées + commit Drift Lock prêt.

---

### /sdd trace  *(v1.10)*

**Quand** : Avant une PR, en CI, ou pour auditer la couverture Intent ↔ SPEC ↔ Code ↔ Tests.
**Ce que ça fait** : Génère la **matrice de traçabilité** (Markdown + JSON + HTML) à partir des 4 annotations obligatoires (`@intent`, `@spec`, `@verified-by`, `@governance`). Scan via `git ls-files` (respecte `.gitignore` ; bench 100k fichiers ≈ 1,8 s). Annotations multi-langages : TS/JS, Python, Rust, Go, Java, Kotlin, C#, Ruby, PHP, Swift, Scala, Elixir.
**Options (v1.14)** : `--watch` (re-génération sur changement, debounce 200 ms) ; `--suggest` (squelette EARS auto-généré pour SPECs orphelines) ; `--format sarif` (sortie SARIF v2.1.0 compatible GitHub Code Scanning / GitLab / SonarQube) ; `--fail-on-gap` (un gap non annoté fait échouer la pipeline) ; `--json` stable.
**Intégration CI** : `.github/workflows/sdd-trace.yml`. Stockage : `.aiad/metrics/traceability/`.
**Sortie** : Matrice de traçabilité + rapport de gaps + (optionnel) SARIF.

---

### /sdd fact

**Quand** : Un écart est constaté entre le comportement livré et le comportement désiré, sans justifier un nouveau cycle Intent complet (bug mineur, comportement inattendu, drift partiel).
**Ce que ça fait** : (1) Capture le fait technique — description précise de l'écart : livré vs. désiré. (2) Qualifie l'impact : fonctionnel / sécurité / performance / conformité spec. (3) Décide de l'action corrective parmi quatre options : patch immédiat / nouveau Intent Statement / ajustement SPEC existante / documentation comme dette technique connue. (4) Trace dans `.aiad/facts/FACT-NNN.md` avec lien vers la SPEC concernée — contribue au Drift Lock.
**Sortie** : Fichier `FACT-NNN.md` dans `.aiad/facts/` avec décision tracée et lien SPEC.

---

### /sdd security

**Quand** : Après implémentation d'une fonctionnalité impliquant des accès, des données utilisateur, des secrets, ou un composant IA. Recommandé avant toute PR critique.
**Ce que ça fait** : (1) Recommande explicitement un modèle frontier (Opus 4.7 ou équivalent) pour cet audit. (2) Parcourt le code sur les axes OWASP Top 10, gestion des secrets, permissions des agents (Harness Engineering — minimal necessary permissions), exposition des données. (3) Vérifie la conformité avec AIAD-AI-ACT et AIAD-RGPD si le contexte le justifie. (4) Produit un rapport structuré : risques critiques / moyens / bonnes pratiques confirmées. (5) Persiste dans `.aiad/metrics/security/`.
**Sortie** : Rapport sécurité structuré persisté dans `.aiad/metrics/security/YYYY-MM-DD-SPEC-NNN.md`.

---

### /sdd audit

**Quand** : Après implémentation, avant ou pendant la validation — notamment pour les fonctionnalités à fort enjeu technique ou après plusieurs itérations d'un même composant.
**Ce que ça fait** : (1) Recommande un modèle performant pour l'analyse (Opus 4.7 ou Sonnet 4.6). (2) Vérifie la conformité code ↔ SPEC : couverture des critères d'acceptance, drift détecté. (3) Évalue la dette technique introduite : complexité, couplage, lisibilité. (4) Vérifie la cohérence avec les conventions du projet (AGENT-GUIDE). (5) Produit un rapport : conformité SPEC / qualité / dette / recommandations. (6) Persiste dans `.aiad/metrics/audit/`.
**Sortie** : Rapport audit structuré persisté dans `.aiad/metrics/audit/YYYY-MM-DD-SPEC-NNN.md`.

---

## Commandes — Rituels & synchronisations

### /aiad init

**Quand** : Adoption d'AIAD sur un projet existant qui a déjà du code.
**Ce que ça fait** : En première étape, affiche le message de redémarrage (identique à `/sdd init`). Bootstrap progressif de la structure AIAD sans disruption. Analyse le codebase existant, génère des artefacts initiaux depuis le code réel. Évite de repartir de zéro.
**Sortie** : Structure `.aiad/` initialisée depuis l'état réel du projet.

---

### /aiad onboard

**Quand** : Un nouveau membre rejoint le projet.
**Ce que ça fait** : Génère un briefing contextualisé depuis les artefacts du projet (PRD, ARCHITECTURE, AGENT-GUIDE, SPECs actives, Lessons Learned). Pose les questions clés pour compléter les lacunes.
**Sortie** : Document d'onboarding personnalisé + liste de lecture priorisée pour le nouveau membre.

---

### /aiad gouvernance

**Quand** : Avant le merge d'une PR ou la validation d'une SPEC impactant des aspects réglementaires.
**Ce que ça fait** : Déclenche les 4 agents de gouvernance Tier 1 (skill `regulatory-veto`) sur le code ou la SPEC soumis. Chaque agent dispose d'un droit de veto. Le référentiel appliqué dépend du **pack juridiction** installé (eu / us / uk — voir section dédiée). Produit une checklist de conformité actionnable.
**Sortie** : Rapport de conformité par référentiel avec statut CONFORME / ALERTES / BLOQUANT.

---

### /aiad health

**Quand** : Fin d'itération ou quand un signal d'alarme apparaît (agent incohérent, drifts fréquents).
**Ce que ça fait** : Diagnostique la santé des artefacts AIAD — cohérence PRD/SPEC/code, fraîcheur de l'AGENT-GUIDE, taux de synchronisation des SPECs, score de maturité SDD (0-5). Le flag `--persist` alimente la sparkline timeline du dashboard. Identifie les incohérences latentes.
**Sortie** : Rapport de santé avec score de maturité et liste priorisée d'actions correctives.

---

### /aiad status

**Quand** : En standup, en début de session, ou pour un état du projet à la demande.
**Ce que ça fait** : Affiche l'état complet du projet — artefacts (statut, fraîcheur), SPECs actives (statut, SQS), gouvernance (agents activés), maturité globale, recommandations immédiates. Sortie `--json` stable.
**Sortie** : Dashboard texte lisible du projet avec recommandations pour le PE.

---

### /aiad retro

**Quand** : En fin d'itération, pour la rétrospective SDD Mode.
**Ce que ça fait** : Collecte les Lessons Learned (erreurs récurrentes de l'agent) et les Human Learnings (écarts entre intention humaine et livraison). Calcule les métriques d'itération (SQS moyen, drifts détectés, first-time success rate). Propose des actions concrètes.
**Sortie** : Entrées Lessons Learned + Human Learnings prêtes pour l'AGENT-GUIDE + métriques d'itération.

---

### /aiad intention

**Quand** : En préparation de l'Atelier d'Intention mensuel (jamais pendant l'atelier — espace humain pur, pas d'IA).
**Ce que ça fait** : Compile les Intent Statements du mois, les métriques d'alignement (CRITÈRE DE DRIFT respecté ?), les Human Learnings et les écarts intention/livraison. Prépare les données pour les 4 temps de l'atelier.
**Sortie** : Dossier de préparation de l'Atelier d'Intention avec données et questions directrices.

---

### /aiad sync-strat

**Quand** : Mensuel — synchronisation stratégique PM / PE / AE / Tech Lead.
**Ce que ça fait** : Aligne l'équipe sur la stratégie produit et les Intents actifs. Vérifie la validité du PRD, révise les Outcome Criteria si nécessaire, ajuste les priorités du backlog en fonction des métriques DORA et Flow.
**Sortie** : Compte-rendu de synchronisation avec décisions documentées et Intents mis à jour.

---

### /aiad demo

**Quand** : Bi-hebdomadaire — démonstration des fonctionnalités livrées.
**Ce que ça fait** : Prépare la démo depuis les SPECs terminées de la période. Structure la présentation autour des Intent Statements d'origine (pourquoi) puis de la livraison (quoi). Vérifie l'alignement intention/livraison. Un agenda auto (3 min/SPEC, budget temps configurable) est aussi disponible dans le dashboard PM.
**Sortie** : Structure de démo avec questions de validation pour le PM.

---

### /aiad tech-review

**Quand** : Bi-hebdomadaire — revue de cohérence technique.
**Ce que ça fait** : Vérifie que l'ARCHITECTURE.md est toujours cohérente avec le code réel. Identifie les dérives de patterns, les nouvelles dépendances non documentées, les ADR à rédiger.
**Sortie** : Liste des incohérences architecture/code avec propositions de mise à jour des artefacts.

---

### /aiad standup

**Quand** : Quotidien — standup SDD Mode (15 min max).
**Ce que ça fait** : Structure le standup autour de 3 questions SDD : Quelle SPEC aujourd'hui ? Quel Context Engineering Budget ? Y a-t-il un drift à signaler ? Affiche l'état des SPECs actives et les blockers. Un script de standup auto (bouton « Copier ») est aussi généré dans le dashboard PM.
**Sortie** : Synthèse standup avec SPEC du jour, budget contexte préparé, actions immédiates.

---

### /aiad guide  *(v1.15)*

**Quand** : À la demande, pour un guide pratique d'usage du SDD Mode ou pour évaluer la santé du backlog.
**Ce que ça fait** : Fournit un guide pratique contextualisé (quelle commande quand, quels artefacts) et un **module backlog health score** : drafts vieillissants, Intents actifs sans SPEC, doublons (Jaccard), pyramide d'âge.
**Sortie** : Guide pratique + score de santé du backlog avec actions recommandées.

---

## Commandes — Métriques & dashboards

### /aiad dashboard

**Quand** : À la demande, pour une vue d'ensemble des métriques du projet (sortie texte / Markdown).
**Ce que ça fait** : Agrège et affiche les métriques SDD (SQS moyen, taux de drift, first-time success rate, alignement intention/livraison) et les métriques DORA et Flow depuis `.aiad/metrics/`.
**Sortie** : Dashboard métriques persisté dans `.aiad/metrics/dashboard.md`.

---

### /aiad dashboard-html  *(v1.13 → PM Cockpit v1.15-1.17)*

**Quand** : À la demande, pour un cockpit visuel (PE et surtout PM).
**Ce que ça fait** : Génère un **dashboard HTML multi-pages** dans `dashboard/`. Mode `--serve` : serveur local avec rechargement. La page `pm.html` est un **PM Cockpit** (131 sections h2) couvrant 6 grands thèmes : vision & alignement (goal-tree, OKR, roadmap Gantt-light SVG), intelligence PM (notification center, SQS readiness, velocity forecast OLS, cost-of-delay), qualité SPEC (score composite, AC extractor, annotation coverage, scope T-shirt), flow & vélocité (cycle time, throughput, SLA, scorecard PM), gestion sponsor (trackers, scorecard 5D, decision velocity), hygiène backlog (doublons Jaccard, auto-archive, pyramide, maturité Intent /100). Ergonomie : 5 onglets cockpit, 3 thèmes, export Markdown, conformité EU AI Act (heuristique + frontmatter `ai_risk:`), « what's new » diff anti-XSS. Publication automatique via le workflow GitHub Pages `docs-deploy.yml`.
**Sortie** : Dashboard HTML statique dans `dashboard/` (publiable sur GitHub Pages).

---

### /aiad dora

**Quand** : En rétrospective ou en revue de performance livraison.
**Ce que ça fait** : Calcule les 4 indicateurs DORA — Deployment Frequency, Lead Time for Changes, Change Failure Rate, MTTR — depuis les données de déploiement et les SPECs. Compare aux benchmarks industrie.
**Sortie** : Rapport DORA avec positionnement Elite / High / Medium / Low et recommandations.

---

### /aiad flow

**Quand** : En analyse de flux ou pour détecter les goulots d'étranglement du cycle SDD.
**Ce que ça fait** : Calcule les 5 indicateurs Flow — Cycle Time, Lead Time, Throughput, WIP, Flow Efficiency — depuis les Intent Statements et les SPECs. Identifie les étapes qui ralentissent la livraison.
**Sortie** : Rapport Flow avec visualisation du cycle et recommandations d'optimisation du WIP.

---

## Skills réutilisables (v1.9)

La logique répétée des commandes est extraite en **7 skills auto-déclenchées** dans `.claude/skills/<name>/SKILL.md`. Les commandes complexes (`/sdd validate`, `/sdd exec`, `/sdd gate`) les composent sans dupliquer leur logique.

| Skill | Rôle |
|-------|------|
| `human-authorship-check` | Vérifie la paternité humaine de l'Intent |
| `regulatory-veto` | Applique les 4 agents Tier 1 (AI-ACT / RGPD / RGAA / RGESN) |
| `drift-detection` | Détecte le drift code ↔ SPEC sur un diff |
| `sqs-scoring` | Score les 5 critères SQS + Test de l'Étranger |
| `context-budget` | Calcule M1–M5 du budget de contexte |
| `reasons-canvas` | Facilite la structuration SPDD (Kevlin Henney) |
| `ears-validator` | Lint EARS strict / indicatif sur les critères d'acceptation |

Le frontmatter des skills est vérifiable via `aiad-sdd skills validate`.

---

## Traçabilité machine-vérifiable (v1.10)

La SPEC devient **vérifiable par la machine**, pas seulement par revue humaine.

- **4 annotations obligatoires** dans le code : `@intent`, `@spec`, `@verified-by`, `@governance`.
- **`/sdd trace`** génère la matrice Intent ↔ SPEC ↔ Code ↔ Tests (Markdown + JSON + HTML), avec options `--watch`, `--suggest`, `--format sarif`, `--fail-on-gap`.
- **GitHub Action** `.github/workflows/sdd-trace.yml` — en mode `--fail-on-gap`, un gap non annoté fait échouer la pipeline.
- **Multi-langages** : TS/JS, Python, Rust, Go, Java, Kotlin, C#, Ruby, PHP, Swift, Scala, Elixir.
- **Stockage** : `.aiad/metrics/traceability/`.

---

## Variante EARS (v1.11)

EARS (Easy Approach to Requirements Syntax) est proposé **en option**, sans migration imposée — prose et EARS cohabitent.

- `/sdd spec --ears` génère une SPEC au format EARS via `spec-ears-template.md`.
- À la Gate, le skill `ears-validator` passe en **mode strict** (règles R1–R7 : mots interdits, multi-SHALL, déclencheurs WHEN/WHILE/IF/WHERE, sujet explicite, verbes observables, quantification, conjonctions).
- Effet SQS : **+1 sur le critère 2** si 0 violation ; **critère 2 forcé à 0** si ≥ 1 violation (la Gate se ferme).

---

## Multi-runtime — emit-rules (v1.12)

`aiad-sdd emit-rules` génère simultanément, depuis le **même `AGENT-GUIDE.md` source**, les fichiers de règles de chaque runtime :

- `AGENTS.md` (Claude Code)
- `.cursor/rules/*.mdc` (Cursor)
- `.codex/AGENT.md` (Codex)
- `GEMINI.md` (Gemini)

Le workflow CI `aiad-emit-rules-check.yml` **bloque toute PR** qui diverge entre les runtimes — un seul AGENT-GUIDE reste la source de vérité, model-agnostic.

---

## Packs gouvernance par juridiction (v1.14)

Les 4 agents de gouvernance Tier 1 sont fournis par **pack juridictionnel** sélectionnable. Un marketplace de packs communautaires est validé cryptographiquement (`aiad-sdd gouvernance --pack-from <dir>`, SHA-256).

| Pack | Référentiels |
|------|--------------|
| `eu-baseline` *(défaut)* | EU AI Act, RGPD, RGAA, RGESN |
| `us-baseline` | SOC 2, HIPAA, ADA, NIST AI RMF |
| `uk-baseline` | UK DPA 2018, Equality Act, UK AI 5 principes, SECR-TCFD |

La commande `aiad-sdd ai-act audit` pré-remplit la documentation Annexe IV du Règlement (UE) 2024/1689 (8 sections requises).

---

## Outillage CLI `aiad-sdd` (v1.14)

Le runtime reste **zero-dependency** (parser migré vers `node:util.parseArgs` natif : flags `--flag=value`, short flags `-h`/`-v`).

| Commande | Description |
|----------|-------------|
| `aiad-sdd ai-act audit` | Pré-remplit la documentation Annexe IV (UE) 2024/1689 |
| `aiad-sdd workspace [doctor\|trace]` | Mode multi-projet (ESN, grands groupes) — agrège santé / Intents / SPECs / gaps sur N projets |
| `aiad-sdd gouvernance --pack-from <dir>` | Installe un pack gouvernance communautaire (validation SHA-256) |
| `aiad-sdd repl` | REPL interactif — 6 commandes, auto-incrément `INTENT-NNN` / `SPEC-NNN-N-slug` |
| `aiad-sdd migrate` | Détecte les versions < courante, applique 5 migrations idempotentes |
| `aiad-sdd telemetry` | Télémétrie opt-in RGPD-compliant (UUID anonyme, jamais d'IP) |
| `aiad-sdd doctor` | Diagnostic unifié 7 catégories (`--json`) |
| `aiad-sdd uninstall` | Désinstallation propre (aperçu par défaut, `--force` pour exécuter) |
| `aiad-sdd skills validate` | Vérifie le frontmatter des skills Claude Code |
| `aiad-sdd docs [--check]` | Documentation auto-générée depuis 5 sources de vérité |
| `aiad-sdd update --check` | Exit 1 si commandes / gouvernance / hooks divergent du package npm |

Métriques de leadership EU/FR exposées dans `doctor --json` : `humanAuthorshipRatio`, `governanceCoverage`, `traceCompleteness`, `langueArtefacts`. Sorties `--json` stables sur `status`, `bench`, `doctor`, `trace`, `skills validate`. Frontmatter YAML sur Intent / SPEC (mini-parser zero-dep, compatibilité ascendante 100 %).

---

## Écosystème (v1.14)

- **GitHub Action officielle** `aiad-sdd-action` (composite, 6 modes, upload SARIF natif).
- **CI multi-forges** : templates GitLab CI, Bitbucket Pipelines, Drone CI.
- **Extension VS Code** : sidebar Intents / SPECs, CodeLens `@spec` (9 langages), validation du frontmatter à la sauvegarde.
- **Site documentation** GitHub Pages + page de comparaison vs Spec Kit / Kiro / Cursor Memory Bank.
- **+43 routes OpenAPI** (discovery-info, types-catalog, multi-forge stacks).

---

## Glossaire

| Terme | Définition |
|-------|------------|
| **Intent Statement** | Artefact de premier ordre : 5 champs (POURQUOI MAINTENANT, POUR QUI, OBJECTIF, CONTRAINTES, CRITÈRE DE DRIFT). Archivé dans `.aiad/intents/`. |
| **SPEC** | Spécification technique détaillée pour une tâche atomique. Activation par tâche uniquement. Format prose ou EARS. |
| **SQS** | Spec Quality Score — 5 critères scorables + Critère 6 "Test de l'Étranger" (non-scorable). Score ≥ 4/5 requis pour passer la Gate. |
| **Execution Gate** | Point de contrôle entre SPEC validée et lancement agent. Aucun code avant Gate ouverte. |
| **Drift Lock** | Politique de PR : code et SPEC synchronisés dans le même commit. |
| **Anti-Drift Check** | Rituel de fin d'itération vérifiant la synchronisation artefacts / code. Commande : `/sdd drift-check`. |
| **Spec Drift** | Écart entre l'état d'une SPEC et l'état réel du code. Traité comme échec de processus. |
| **Spec-Anchored** | La spec est maintenue comme ancre permanente, synchronisée avec le code à chaque PR. Distinct de spec-first et spec-as-source. |
| **Traçabilité machine-vérifiable** | Matrice Intent ↔ SPEC ↔ Code ↔ Tests générée par `/sdd trace` depuis 4 annotations code. Gap non annoté = échec CI possible. |
| **Annotations de traçabilité** | `@intent`, `@spec`, `@verified-by`, `@governance` — obligatoires dans le code depuis v1.10. |
| **EARS** | Easy Approach to Requirements Syntax — format de SPEC optionnel (`/sdd spec --ears`), validé strictement à la Gate (skill `ears-validator`). |
| **emit-rules** | Génération multi-runtime (Claude / Cursor / Codex / Gemini) depuis un seul AGENT-GUIDE. CI bloque les divergences. |
| **Pack gouvernance** | Jeu d'agents Tier 1 par juridiction : `eu-baseline` (défaut), `us-baseline`, `uk-baseline`. Marketplace validé SHA-256. |
| **PM Cockpit** | Dashboard HTML `pm.html` (131 sections) généré par `/aiad dashboard-html` — vision, intelligence PM, qualité SPEC, flow, sponsors, hygiène backlog. |
| **Context Engineering Budget** | Capacité d'absorption de contexte d'un agent IA. Règle : session unique, < 35 min, contexte minimal. Responsabilité du PE. |
| **Context Rot** | Dégradation de la qualité LLM avant la limite théorique de contexte. Justifie la SPEC comme anchor point stable. |
| **Human Authorship** | La paternité de l'intention ne se délègue pas. Tout Intent Statement est rédigé par un humain identifiable. Skill `human-authorship-check`. |
| **Human Learnings** | Section AGENT-GUIDE documentant les écarts entre intention humaine et livraison (≠ Lessons Learned qui documentent les erreurs de l'agent). |
| **Lessons Learned** | Section AGENT-GUIDE documentant les erreurs récurrentes de l'agent (≥ 2 occurrences sur des tâches différentes). |
| **Atelier d'Intention** | Rituel mensuel (60 min max, humain pur, pas d'IA) : "Construisons-nous toujours ce que nous voulions ?". |
| **PRD** | Product Requirement Document — source de vérité produit. Injecté uniquement en cadrage. Assistant `/sdd prd`. |
| **ARCHITECTURE** | Document des standards techniques — injecté condensé (500 tokens) dans chaque session agent. Assistant `/sdd arch`. |
| **AGENT-GUIDE** | Contexte permanent agent : règles absolues, conventions, Lessons Learned, Human Learnings, gouvernance. Source unique de `emit-rules`. |
| **AGENT-GUIDE Gouvernance** | 4 guides réglementaires Tier 1 avec droit de veto, selon le pack juridiction installé. |
| **DORA Metrics** | 4 indicateurs livraison : Deployment Frequency, Lead Time, Change Failure Rate, MTTR. |
| **Flow Metrics** | 5 indicateurs de flux : Cycle Time, Lead Time, Throughput, WIP, Flow Efficiency. |
| **Product Engineer (PE)** | Gardien de l'intention tout au long du cycle, en orchestrant des agents IA pour la réaliser sans la trahir. |
| **DoOD** | Definition of Output Done — critères de complétion d'une tâche, définis dans la SPEC. |
| **Harness Engineering** | Pratique centrale de l'AE : configuration, supervision et gouvernance des agents selon le principe de minimal necessary permissions. |
| **REASONS Canvas** | Outil SPDD (Kevlin Henney) optionnel pour structurer la justification d'une SPEC — skill `reasons-canvas`, utilisable en entrée de `/sdd spec`. |
| **Fact Technique** | Artefact de `/sdd fact` : capture d'un écart constaté avec qualification d'impact et décision d'action corrective. |
| **Vibe Coding** | (Fowler/Karpathy, 2026) Délégation du code à l'agent sans validation humaine. Ce que Human Authorship prévient. Opposé à la « programmation agentique sérieuse ». |
| **Cognitive Debt** | (Fowler/Joshi, 2026) Accumulation de code dont on accepte l'implémentation sans comprendre le modèle conceptuel. SDD Mode (spec-first + Human Learnings) l'évite. |
| **Interrogatory LLM** | (Fowler, 2026) Pattern où l'agent construit le contexte par questions ciblées plutôt que passivement. Implémenté par `/sdd intent`. |
| **Agent à autonomie financière** | Agent autorisé à engager des effets financiers/opérationnels irréversibles. Requiert validation des plafonds à l'Execution Gate. Voir AIAD-AI-ACT. |

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
| Traçabilité (`/sdd trace`) | I | R/A | C | C | C |
| Drift Lock (PR) | I | R/A | I | C | C |
| Anti-Drift Check | I | R/A | C | I | C |
| Lessons Learned | I | R | C | I | I |
| Mise à jour AGENT-GUIDE | I | C | R/A | I | C |
| Pilotage backlog / PM Cockpit | R/A | C | I | I | I |

---

## Structure du projet

```
.aiad/                              ← Créé par npx aiad-sdd init
├── PRD.md                          ← Vision produit et user stories
├── ARCHITECTURE.md                 ← Décisions techniques et patterns
├── AGENT-GUIDE.md                  ← Contexte permanent + Lessons Learned + Human Learnings (source emit-rules)
├── gouvernance/                    ← Agents de gouvernance Tier 1 (selon pack juridiction)
│   ├── _index.md
│   ├── AIAD-AI-ACT.md
│   ├── AIAD-RGPD.md
│   ├── AIAD-RGAA.md
│   └── AIAD-RGESN.md
├── intents/                        ← Intent Statements archivés (frontmatter YAML)
│   ├── _index.md
│   ├── INTENT-001-[slug].md
│   └── archive/
├── specs/
│   ├── _index.md
│   ├── SPEC-001-1-[slug].md         ← Une SPEC par tâche atomique (prose ou EARS)
│   └── archive/
├── facts/                          ← Traces /sdd fact
│   └── FACT-NNN.md
├── metrics/                        ← Persistance des données métriques
│   ├── security/                   ← Rapports /sdd security
│   ├── audit/                      ← Rapports /sdd audit
│   ├── traceability/               ← Matrices /sdd trace (v1.10)
│   └── dashboard.md
└── CHANGELOG-ARTEFACTS.md

.claude/
├── commands/                       ← Commandes slash (routers /sdd, /aiad + alias rétro-compatibles)
└── skills/                         ← 7 skills réutilisables (v1.9)
    ├── human-authorship-check/SKILL.md
    ├── regulatory-veto/SKILL.md
    ├── drift-detection/SKILL.md
    ├── sqs-scoring/SKILL.md
    ├── context-budget/SKILL.md
    ├── reasons-canvas/SKILL.md
    └── ears-validator/SKILL.md

dashboard/                          ← Dashboard HTML / PM Cockpit (v1.13+, /aiad dashboard-html)
AGENTS.md                           ← Règles Claude Code (généré par emit-rules)
.cursor/rules/*.mdc                 ← Règles Cursor (généré par emit-rules)
.codex/AGENT.md                     ← Règles Codex (généré par emit-rules)
GEMINI.md                           ← Règles Gemini (généré par emit-rules)
.github/workflows/
├── sdd-trace.yml                   ← Traçabilité --fail-on-gap (v1.10)
├── aiad-emit-rules-check.yml       ← Bloque les divergences multi-runtime (v1.12)
└── docs-deploy.yml                 ← Publication GitHub Pages (v1.13)
CLAUDE.md                           ← Configuré par npx aiad-sdd init
```

---

*AIAD SDD Mode v1.20 — aiad.ovh — Open Source — Steeve Evers*
