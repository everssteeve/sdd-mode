# Agents de rôle, sous-agents et skills

> Référence de l'équipe d'agents livrée par `aiad-sdd` (v2.0). Source unique : `lib/agents-registry.js` — `npx aiad-sdd agents list` affiche la même chose depuis un projet installé.

## Le modèle

```
            Humain PM      Humain PE      Humain AE      Humain QA      Humain Tech Lead
               │              │              │              │              │        ← l'intention et les décisions
            aiad-pm        aiad-pe        aiad-ae        aiad-qa      aiad-tech-lead ← 5 agents de rôle (assistants)
               │              │              │              │              │
            pm-*  (3)      pe-*  (5)      ae-*  (4)      qa-*  (4)      tl-*  (5)    ← 21 sous-agents, un seul gestionnaire chacun

            AIAD-AI-ACT · AIAD-RGPD · AIAD-RGAA · AIAD-RGESN                        ← gouvernance Tier 1 : veto,
                                                                                       consultable par tous, administrée par aiad-ae
```

1. **Un assistant par responsabilité.** L'agent de rôle travaille avec l'humain qui porte la responsabilité. Une personne qui en porte plusieurs change d'assistant selon ce qu'elle fait.
2. **Un seul gestionnaire par sous-agent.** Un sous-agent n'est lancé que par son agent de rôle. Les sous-agents ne délèguent pas.
3. **L'humain décide.** Chaque agent de rôle s'arrête sur une liste de décisions qu'il ne prend jamais.
4. **Le veto prévaut.** Les agents de gouvernance Tier 1 sont consultables par les cinq rôles ; leur veto ne dépend d'aucun d'eux.
5. **Entre rôles, un relais.** Un agent de rôle n'agit pas dans le périmètre d'un autre : il écrit une note dans `.aiad/handoffs/` (skill `role-handoff`).

## Utiliser son assistant

```bash
claude --agent aiad-pe          # session dédiée
npx aiad-sdd agents use pe      # assistant par défaut (clé "agent" de .claude/settings.local.json, réglage personnel)
npx aiad-sdd agents use none    # retirer ce réglage
npx aiad-sdd agents list        # l'équipe
npx aiad-sdd agents validate    # conformité de .claude/agents/ au registre — exit 0 / 1
```

Dans une session déjà ouverte : `/aiad agents` présente l'équipe, `/aiad agents <rôle>` fait adopter le rôle à la session en cours.

## Ce qui est appliqué, ce qui est déclaratif

| Règle | Nature | Par quoi |
|-------|--------|----------|
| Un agent de rôle ne délègue qu'à ses sous-agents et à la gouvernance | **appliquée** en session `claude --agent` | liste `tools: Agent(...)` du fichier d'agent |
| Un sous-agent ne délègue pas | **appliquée** | champ `tools` sans `Agent` |
| Un sous-agent d'analyse n'écrit pas | **appliquée** | `tools` sans `Edit`/`Write`, `disallowedTools` |
| L'équipe installée correspond au registre | **appliquée** quand on la lance | `aiad-sdd agents validate` (à brancher en CI) |
| Décisions réservées à l'humain | **déclarative** | consignes de l'agent de rôle |
| Écriture limitée à un répertoire (`pe-spec-writer`, `qa-test-author`, `pe-doc-writer`) | **déclarative** | consignes du sous-agent |
| Limite de délégation quand le rôle est adopté en cours de session | **déclarative** | consignes |

## Les cinq agents de rôle

### `aiad-pm` — assistant du Product Manager

*« Construit-on les bonnes choses ? »*

- **Décisions réservées à l'humain** : rédiger l'Intent Statement, prioriser, prononcer la validation métier, modifier la vision du PRD.
- **Skills du rôle** : `human-authorship-check`, `discovery-synthesis`, `backlog-health`, `outcome-review`, `role-handoff`.
- **Commandes pilotées** : `/sdd prd`, `/sdd intent`, `/aiad sync-strat`, `/aiad demo`, `/aiad intention`, `/aiad dashboard-html`.

| Sous-agent | Mission | Accès | Modèle | Skills |
|------------|---------|-------|--------|--------|
| `pm-discovery-analyst` | Synthèse de discovery : retours utilisateurs, hypothèses, signaux marché | lecture seule | sonnet | `discovery-synthesis` |
| `pm-backlog-curator` | Santé du backlog : intents zombies, orphelins, doublons, cohérence PRD | lecture + exécution | haiku | `backlog-health` |
| `pm-outcome-analyst` | Outcomes et validation métier : critère de drift, métriques, préparation de démo | lecture + exécution | sonnet | `outcome-review` |

### `aiad-pe` — assistant du Product Engineer

*« L'intention est-elle réalisée sans être trahie ? »*

- **Décisions réservées à l'humain** : formuler l'intention, trancher la Research, ouvrir la Gate sous le seuil, accepter un écart à la SPEC, merger, pousser.
- **Skills du rôle** : `human-authorship-check`, `sqs-scoring`, `context-budget`, `grill-me`, `exec-orchestration`, `role-handoff`.
- **Commandes pilotées** : `/sdd intent`, `/sdd research`, `/sdd spec`, `/sdd gate`, `/sdd exec`, `/sdd validate`, `/sdd drift-check`, `/sdd trace`, `/sdd split`, `/sdd resume`, `/sdd fact`.

| Sous-agent | Mission | Accès | Modèle | Skills |
|------------|---------|-------|--------|--------|
| `pe-spec-writer` | Brouillon de SPEC atomique depuis un Intent validé par l'humain | écriture | inherit | `spec-authoring`, `ears-validator`, `reasons-canvas` |
| `pe-implementer` | Implémentation d'UNE SPEC dont l'Execution Gate est ouverte | écriture | inherit | `traceability` |
| `pe-code-reviewer` | Revue de code adossée à la SPEC : conformité, défauts, lisibilité | lecture + exécution | inherit | `code-review`, `drift-detection` |
| `pe-drift-sentinel` | Drift Lock : synchronisation SPEC ↔ code ↔ tests, matrice de traçabilité | lecture + exécution | haiku | `drift-detection`, `traceability` |
| `pe-doc-writer` | Documentation synchronisée avec le code livré : README, changelog, guides | écriture | sonnet | — |

### `aiad-ae` — assistant du Agents Engineer

*« L'écosystème d'agents est-il optimal ? »*

- **Décisions réservées à l'humain** : valider un changement de ce qu'un agent charge, élargir une permission, ajouter ou retirer un agent, toucher à la gouvernance.
- **Skills du rôle** : `context-budget`, `regulatory-veto`, `agent-authoring`, `agent-monitoring`, `permissions-audit`, `role-handoff`.
- **Commandes pilotées** : `/sdd context`, `/aiad emit-rules`, `/aiad gouvernance`, `/aiad health`, `/aiad agents`, `/aiad retro`.

| Sous-agent | Mission | Accès | Modèle | Skills |
|------------|---------|-------|--------|--------|
| `ae-agent-configurator` | Création et maintenance d'agents, de skills et de l'AGENT-GUIDE | écriture | inherit | `agent-authoring` |
| `ae-context-auditor` | Audit du budget de contexte : estimation vs réel, usage des skills, mémoire | lecture + exécution | haiku | `context-budget`, `agent-monitoring` |
| `ae-agent-evaluator` | Évaluation des agents : canaris, taux de correction, faux positifs | lecture + exécution | sonnet | `agent-monitoring` |
| `ae-permissions-auditor` | Moindre privilège : permissions, approbations persistées, outillage autorisé | lecture seule | sonnet | `permissions-audit` |

### `aiad-qa` — assistant du QA Engineer

*« La qualité est-elle intégrée dès le départ ? »*

- **Décisions réservées à l'humain** : prononcer le sign-off, accepter un risque résiduel, requalifier un défaut.
- **Skills du rôle** : `ears-validator`, `test-strategy`, `acceptance-verification`, `exploratory-charter`, `role-handoff`.
- **Commandes pilotées** : `/sdd validate`, `/sdd audit`, `/sdd fact`, `/aiad gouvernance`, `/aiad demo`.

| Sous-agent | Mission | Accès | Modèle | Skills |
|------------|---------|-------|--------|--------|
| `qa-test-strategist` | Stratégie de test dès la SPEC : plan dérivé des critères d'acceptation | lecture seule | sonnet | `test-strategy`, `ears-validator` |
| `qa-test-author` | Écriture des tests automatisés, dans les répertoires de tests uniquement | écriture | inherit | `test-strategy`, `traceability` |
| `qa-functional-validator` | Validation fonctionnelle : chaque critère d'acceptation, preuve à l'appui | lecture + exécution | sonnet | `acceptance-verification` |
| `qa-exploratory-tester` | Test exploratoire par chartes : cas limites, parcours non spécifiés | lecture + exécution | sonnet | `exploratory-charter` |

### `aiad-tech-lead` — assistant du Tech Lead

*« L'ensemble reste-t-il techniquement cohérent ? »*

- **Décisions réservées à l'humain** : prendre une décision d'architecture, accepter une dette ou un risque de sécurité, publier.
- **Skills du rôle** : `architecture-review`, `security-audit`, `release-readiness`, `role-handoff`.
- **Commandes pilotées** : `/sdd arch`, `/sdd security`, `/sdd audit`, `/aiad tech-review`, `/aiad dora`, `/aiad flow`.

| Sous-agent | Mission | Accès | Modèle | Skills |
|------------|---------|-------|--------|--------|
| `tl-architecture-reviewer` | Cohérence avec ARCHITECTURE.md : patterns, couplage, brouillons d'ADR | lecture + exécution | inherit | `architecture-review` |
| `tl-security-auditor` | Audit sécurité : OWASP, secrets, dépendances, authentification | lecture + exécution | inherit | `security-audit` |
| `tl-performance-analyst` | Performance et sobriété : budgets, régressions, requêtes, poids | lecture + exécution | sonnet | `architecture-review` |
| `tl-debt-analyst` | Dette technique : inventaire, classement, plans de refactoring et de migration | lecture + exécution | sonnet | `architecture-review` |
| `tl-release-engineer` | Préparation de release : contrôles, changelog, version — sans publier | écriture | sonnet | `release-readiness` |


## Skills

### Skills introduites avec les agents de rôle (16)

Les sous-agents reçoivent leurs skills à leur lancement. Un agent de rôle en session principale les invoque à la demande (voir Limites connues).

| Skill | Rôle | Utilisée par |
|-------|------|----------------|
| `role-handoff` | Relais inter-rôles : une note dans `.aiad/handoffs/` plutôt qu'une action hors de son rôle | `aiad-pm`, `aiad-pe`, `aiad-ae`, `aiad-qa`, `aiad-tech-lead` |
| `discovery-synthesis` | Synthèse de discovery : constats sourcés, interprétations à part, hypothèses ouvertes | `aiad-pm`, `pm-discovery-analyst` |
| `backlog-health` | Santé du backlog : intents zombies, orphelins, brouillons oubliés, doublons | `aiad-pm`, `pm-backlog-curator` |
| `outcome-review` | Revue d'outcome : objectif atteint ? critère de drift déclenché ? | `aiad-pm`, `pm-outcome-analyst` |
| `code-review` | Revue de code adossée à la SPEC : conformité d'abord, défauts vérifiés ensuite | `pe-code-reviewer` |
| `spec-authoring` | Rédaction de SPEC : périmètre atomique, critères testables, rien que l'Intent ne porte | `pe-spec-writer` |
| `exec-orchestration` | Orchestration : briefer, séquencer ou paralléliser les sous-agents, vérifier ce qui revient | `aiad-pe` |
| `agent-authoring` | Création d'agents et de skills : besoin validé, gestionnaire unique, moindre privilège | `aiad-ae`, `ae-agent-configurator` |
| `agent-monitoring` | Suivi de l'écosystème : usage, taux de correction, faux positifs — garder, recalibrer, retirer | `aiad-ae`, `ae-context-auditor`, `ae-agent-evaluator` |
| `permissions-audit` | Audit des permissions : outils par agent, approbations persistées, outillage hors liste blanche | `aiad-ae`, `ae-permissions-auditor` |
| `test-strategy` | Stratégie de test : une vérification au moins par critère d'acceptation, dès la SPEC | `aiad-qa`, `qa-test-strategist`, `qa-test-author` |
| `acceptance-verification` | Vérification des critères d'acceptation : une preuve par critère, ou « non vérifié » | `aiad-qa`, `qa-functional-validator` |
| `exploratory-charter` | Test exploratoire par chartes : mission, périmètre, durée, constats reproductibles | `aiad-qa`, `qa-exploratory-tester` |
| `architecture-review` | Revue d'architecture : standards, couplage, dépendances, budgets, brouillons d'ADR | `aiad-tech-lead`, `tl-architecture-reviewer`, `tl-performance-analyst`, `tl-debt-analyst` |
| `security-audit` | Audit sécurité : OWASP, secrets, dépendances, chemin de la donnée vérifié | `aiad-tech-lead`, `tl-security-auditor` |
| `release-readiness` | Préparation de release : contrôles, changelog, version — sans publier | `aiad-tech-lead`, `tl-release-engineer` |

### Skills existantes réutilisées

| Skill | Rôle | Utilisée par |
|-------|------|----------------|
| `human-authorship-check` | Paternité humaine d'un Intent ou d'une décision | `aiad-pm`, `aiad-pe` |
| `sqs-scoring` | Spec Quality Score et décision de Gate | `aiad-pe` |
| `context-budget` | Budget de contexte et métriques de santé M1–M5 | `aiad-pe`, `aiad-ae`, `ae-context-auditor` |
| `grill-me` | Gate humain interactif, une question à la fois | `aiad-pe` |
| `regulatory-veto` | Application des agents de gouvernance Tier 1 | `aiad-ae` |
| `ears-validator` | Lint EARS des critères d'acceptation | `aiad-qa`, `pe-spec-writer`, `qa-test-strategist` |
| `reasons-canvas` | Structuration SPDD d'une SPEC | `pe-spec-writer` |
| `drift-detection` | Drift code ↔ SPEC sur un diff | `pe-code-reviewer`, `pe-drift-sentinel` |
| `traceability` | Matrice Intent ↔ SPEC ↔ Code ↔ Tests | `pe-implementer`, `pe-drift-sentinel`, `qa-test-author` |

## Étendre l'équipe

Un sous-agent propre au projet se crée avec l'assistant de l'Agents Engineer (`aiad-ae`, skill `agent-authoring`) :

1. le fichier `.claude/agents/<nom>.md` déclare `aiad-managed-by: aiad-<rôle>` et un champ `tools` sans `Agent` ;
2. son nom est ajouté à la liste `Agent(...)` de l'agent de rôle gestionnaire ;
3. `npx aiad-sdd agents validate` confirme le rattachement ; un gestionnaire inconnu est signalé comme orphelin ;
4. la modification passe par une revue humaine, comme tout ce qu'un agent charge.

### Après une mise à jour

`aiad-sdd update` réécrit les agents livrés par le package, donc aussi la liste `Agent(...)` des agents de rôle : un sous-agent ajouté par le projet reste en place mais n'y figure plus. Il faut l'y réinscrire après chaque `update` ; `aiad-sdd agents validate` échoue tant que ce n'est pas fait et nomme le sous-agent concerné. Les adaptations locales d'un agent livré sont, elles, perdues à la mise à jour.

## Limites connues

- Agents livrés pour **Claude Code** ; ils ne sont pas émis pour Cursor, Codex, Kiro ni Gemini.
- L'équipe est posée **à dire d'expert** : l'utilité de chaque sous-agent reste à mesurer sur des projets réels (skill `agent-monitoring`). Retirer un agent inutilisé fait partie du modèle.
- **Essai en session réelle (15 novembre 2026, un seul projet d'essai)** : lancé par `claude --agent aiad-pe`, l'assistant n'a pu déléguer qu'à ses cinq sous-agents et aux quatre agents de gouvernance ; sa tentative de lancer `qa-test-author` a été refusée par l'outil. Le sous-agent lancé a reçu ses skills préchargées et ne disposait pas de l'outil de délégation. En revanche, **les skills d'un agent de rôle ne sont pas préchargées en session principale** : il les invoque à la demande. Les quatre autres agents de rôle n'ont pas été essayés.
