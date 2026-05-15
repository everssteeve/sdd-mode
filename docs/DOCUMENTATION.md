<!-- DO NOT EDIT — regenerate via aiad-sdd docs -->
---
title: aiad-sdd — Documentation utilisateur
generated-by: aiad-sdd docs
version: 1.14.0
source-hash: b41ce3e96a380f8a
---

# aiad-sdd — Documentation utilisateur (v1.14.0)

> Cette documentation est **régénérée à chaque changement** des sources de vérité (CLI, commandes slash, skills, gouvernance, conventions d'annotations). Toute édition manuelle sera écrasée. Pour modifier le contenu : édite la source puis relance `npx aiad-sdd docs`. Le mode `npx aiad-sdd docs --check` est utilisable en CI pour bloquer les PR qui désynchronisent la doc.

## Sommaire

1. [Interface en ligne de commande](#1-interface-en-ligne-de-commande)
2. [Commandes slash SDD](#2-commandes-slash-sdd)
3. [Commandes slash AIAD](#3-commandes-slash-aiad)
4. [Skills auto-déclenchées](#4-skills-auto-déclenchées)
5. [Gouvernance Tier 1](#5-gouvernance-tier-1)
6. [Annotations machine-vérifiables](#6-annotations-machine-vérifiables)

## 1. Interface en ligne de commande

Sortie de `aiad-sdd help` (extraite du bin pour rester à jour) :

```
aiad-sdd v1.14.0 — Spec Driven Development pour Claude Code
  https://aiad.ovh

  Commandes :
    init [options]        Initialise SDD Mode dans le projet courant
    update [options]      Met à jour un projet existant (commandes + gouvernance)
    gouvernance           Ajoute/met à jour les agents de gouvernance
    hooks [options]       Installe / désinstalle le hook Git pre-commit (Drift Lock)
    status                Affiche l'état SDD du projet
    doctor [--json]       Diagnostic unifié (structure, gouvernance, hooks, parité)
    skills validate       Vérifie le frontmatter des skills (.claude/skills/)
    docs [--check]        Régénère DOCUMENTATION.md depuis les sources (CI parity)
    uninstall [options]   Retire aiad-sdd du projet (mode aperçu sauf --force)
    bench                 Mesure le poids des frontmatters de commandes (cold-start)
    trace [options]       Génère la matrice Intent ↔ SPEC ↔ Code ↔ Tests
    dashboard [options]   Génère le dashboard HTML multi-pages dans dashboard/
    emit-rules [options]  Régénère AGENTS.md, CLAUDE.md, .cursor/rules/, .codex/, GEMINI.md
    help                  Affiche cette aide

  Options init :
    --minimal             Profil AIAD-Lean : 4 commandes (intent/spec/gate/drift-check)
    --upgrade <module>    Ajoute un module (rituals|metrics|gouvernance|all)
    --runtime <list>      Cible IA — claude-code|cursor|codex|copilot|gemini|all
                          (séparés par virgule, défaut : claude-code)
    --sans-gouvernance    Initialise sans les agents de gouvernance
    --with-git-hooks      Installe le hook pre-commit (Drift Lock)
    --force               Écrase les fichiers existants
    --dry-run             Aperçu — affiche ce qui serait écrit sans rien écrire

  Options update :
    --sans-gouvernance    Met à jour sans toucher la gouvernance
    --check               Mode CI — exit 1 si divergence avec le package
    --dry-run             Aperçu — affiche ce qui serait écrit sans rien écrire

  Options hooks :
    --uninstall           Désinstalle le hook pre-commit
    --force               Écrase un hook pre-commit utilisateur existant

  Options uninstall :
    (sans flag)           Mode aperçu — affiche les actions, n'écrit rien
    --force               Exécute la désinstallation framework
    --purge --force       Supprime aussi .aiad/ (artefacts métier — irréversible)

  Options trace :
    --format <list>       Formats produits (md,json,html,sarif — défaut: tous)
    --out <dir>           Dossier de sortie (défaut: .aiad/metrics/traceability)
    --json                Imprime la matrice JSON sur stdout (CI)
    --fail-on-gap         Exit 1 si gap bloquant détecté (CI)
    --quiet               Pas de résumé console

  Options emit-rules :
    --runtime <list>      Runtimes ciblés — claude-code|cursor|codex|copilot|gemini|all
                          (séparés par virgule, défaut : all)
    --check               Mode CI — exit 1 si divergence avec AGENT-GUIDE

  Options dashboard :
    --out <dir>           Dossier de sortie (défaut : dashboard)
    --quiet               Pas de résumé console
    --serve               Lance un serveur HTTP local après génération
    --watch               Re-génère le dashboard à chaque changement dans .aiad/
                          (à combiner avec --serve)
    --port <n>            Port du serveur --serve (défaut : 8765)
    --source-base <url>   URL préfixant les liens vers les fichiers .md sources
                          (ex: GitHub Pages → blob/main/)

  Exemples :
    npx aiad-sdd init                       Initialisation complète
    npx aiad-sdd init --minimal             Profil minimal (4 commandes, ≤ 1k tokens)
    npx aiad-sdd init --upgrade rituals     Ajoute les rituels au profil minimal
    npx aiad-sdd init --upgrade gouvernance Ajoute les agents Tier 1 (AI-ACT, RGPD, …)
    npx aiad-sdd init --upgrade metrics     Ajoute dashboards & métriques DORA/flow
    npx aiad-sdd init --upgrade all         Bascule minimal → profil complet
    npx aiad-sdd init --with-git-hooks      Init + Drift Lock pre-commit
    npx aiad-sdd update                     Mise à jour (préserve vos fichiers)
    npx aiad-sdd init --force               Réinitialisation (écrase tout)
    npx aiad-sdd gouvernance                Met à jour les agents de gouvernance
    npx aiad-sdd hooks                      Installe le hook pre-commit
    npx aiad-sdd hooks --uninstall          Désinstalle le hook pre-commit
    npx aiad-sdd status                     État du projet SDD
    npx aiad-sdd trace                      Génère la matrice de traçabilité (md+json+html)
    npx aiad-sdd trace --fail-on-gap        Échoue si gap bloquant (usage CI)
    npx aiad-sdd dashboard                  Génère le dashboard HTML dans dashboard/
    npx aiad-sdd dashboard --serve          Génère puis sert sur http://127.0.0.1:8765
    npx aiad-sdd dashboard --out docs/dash  Dashboard dans un dossier custom
    npx aiad-sdd emit-rules                 Régénère AGENTS.md + Cursor + Codex + Gemini
    npx aiad-sdd emit-rules --runtime cursor  Cible un runtime unique
    npx aiad-sdd emit-rules --check         Vérifie la parité (usage CI)

  Framework AIAD — Artificial Intelligence Agent Development — Open Source
```

## 2. Commandes slash SDD

Disponibles via `/sdd <sub>` dans Claude Code après `aiad-sdd init`.

| Commande | Description |
|----------|-------------|
| `/sdd audit` ([`audit.md`](./templates/.claude/sdd/audit.md)) | Audit qualité du code (conformité SPEC, dette technique, cohérence AGENT-GUIDE) |
| `/sdd context` ([`context.md`](./templates/.claude/sdd/context.md)) | Auditer le Context Engineering Budget d'une session agent (estimation vs. réel) avec métriques de santé |
| `/sdd drift-check` ([`drift-check.md`](./templates/.claude/sdd/drift-check.md)) | Vérifier la synchronisation artefacts/code (Drift Lock) |
| `/sdd exec` ([`exec.md`](./templates/.claude/sdd/exec.md)) | Lancer l'exécution agent avec une SPEC validée (post-Gate) |
| `/sdd fact` ([`fact.md`](./templates/.claude/sdd/fact.md)) | Capturer et qualifier un écart livré/désiré (patch, dette, intent ou spec update) |
| `/sdd gate` ([`gate.md`](./templates/.claude/sdd/gate.md)) | Valider une SPEC via l'Execution Gate (SQS >= 4/5) |
| `/sdd init` ([`init.md`](./templates/.claude/sdd/init.md)) | Cadrage initial d'un projet SDD Mode (PRD + ARCHITECTURE + AGENT-GUIDE) |
| `/sdd intent` ([`intent.md`](./templates/.claude/sdd/intent.md)) | Capturer une intention humaine sous forme d'Intent Statement |
| `/sdd resume` ([`resume.md`](./templates/.claude/sdd/resume.md)) | Reprendre une session agent interrompue sans perdre le travail déjà fait |
| `/sdd security` ([`security.md`](./templates/.claude/sdd/security.md)) | Audit sécurité du code (OWASP Top 10, secrets, permissions agents, conformité réglementaire) |
| `/sdd spec` ([`spec.md`](./templates/.claude/sdd/spec.md)) | Rédiger une SPEC technique depuis un Intent Statement |
| `/sdd split` ([`split.md`](./templates/.claude/sdd/split.md)) | Découper une SPEC trop volumineuse en sous-SPECs atomiques |
| `/sdd trace` ([`trace.md`](./templates/.claude/sdd/trace.md)) | Générer la matrice de traçabilité Intent ↔ SPEC ↔ Code ↔ Tests (annotations machine-vérifiables) |
| `/sdd validate` ([`validate.md`](./templates/.claude/sdd/validate.md)) | Valider le code produit par un agent IA (technique + fonctionnel + gouvernance) |

## 3. Commandes slash AIAD

Disponibles via `/aiad <sub>` (rituels, métriques, multi-runtime).

| Commande | Description |
|----------|-------------|
| `/aiad dashboard-html` | Générer le dashboard HTML multi-pages du projet SDD Mode (dossier dashboard/) |
| `/aiad dashboard` | Générer le dashboard AIAD hebdomadaire ou mensuel depuis les données métriques persistées |
| `/aiad demo` | Faciliter la démo & feedback et persister les données métriques |
| `/aiad dora` | Calculer et analyser les 4 métriques DORA depuis les données persistées du projet |
| `/aiad emit-rules` | Régénère AGENTS.md, CLAUDE.md, .cursor/rules/, .codex/, GEMINI.md depuis AGENT-GUIDE |
| `/aiad flow` | Calculer et analyser les métriques de flux depuis les données persistées du projet |
| `/aiad gouvernance` | Vérifier la conformité d'un livrable aux 4 agents de gouvernance Tier 1 |
| `/aiad health` | Diagnostiquer la santé des artefacts AIAD (obsolescence, orphelins, incohérences) |
| `/aiad init` | Bootstrapper AIAD sur un projet existant (adoption progressive) |
| `/aiad intention` | Faciliter l'Atelier d'Intention — rituel mensuel d'alignement |
| `/aiad onboard` | Générer un briefing d'onboarding pour un nouveau membre du projet |
| `/aiad retro` | Conduire une rétrospective de fin d'itération (Lessons Learned + Human Learnings) |
| `/aiad standup` | Animer le standup quotidien (sync ou async) et persister les données métriques |
| `/aiad status` | État des lieux complet du projet en mode SDD |
| `/aiad sync-strat` | Faciliter la synchronisation alignement stratégique et persister les données métriques |
| `/aiad tech-review` | Faciliter la tech review, tracer les décisions architecturales et persister les données métriques |

## 4. Skills auto-déclenchées

Claude Code charge dynamiquement ces skills selon leur `description`. Validable via `aiad-sdd skills validate`.

| Skill | Déclencheur (description frontmatter) |
|-------|----------------------------------------|
| **context-budget** | Use when estimating or auditing a Context Engineering Budget. Computes the 5 health metrics (M1-M5), produces a health score 0–5/5 and actionable recommendations. Triggered by /sdd context, /sdd exec budget check, /sdd resume. |
| **drift-detection** | Use when checking that code changes are synchronised with their SPEC (Drift Lock). Cross-references modified files against active SPECs and emits an OK/DRIFT verdict. Triggered by /sdd drift-check, /sdd validate, /sdd audit, pre-commit hook. |
| **ears-validator** | Use when linting requirements or acceptance criteria for EARS syntax (Easy Approach to Requirements Syntax). Detects forbidden vague words (should, might, fast, user-friendly, intuitive…), multiple SHALL in a single requirement, missing trigger keywo |
| **human-authorship-check** | Use when validating that an Intent Statement, decision or strategic artefact has explicit human authorship — ensures the POURQUOI is not generated, paraphrased or invented by the agent. Triggered by /sdd intent, /sdd spec, /aiad intention. |
| **reasons-canvas** | Use when structuring a SPEC via the REASONS Canvas (SPDD — Kevlin Henney). Facilitates the capture of intent justification before the standard AIAD SPEC format. Triggered by /sdd spec when the Intent is complex/ambiguous, or on explicit user request. |
| **regulatory-veto** | Use when validating code, a SPEC or an Intent against the 4 Tier 1 governance agents (AI-ACT, RGPD, RGAA, RGESN). Emits PASS / WARN / VETO with structured remediation. Triggered by /sdd validate, /sdd security, /sdd exec, /aiad gouvernance. |
| **sqs-scoring** | Use when evaluating a SPEC's quality (Spec Quality Score). Scores the 5 SQS criteria + Test de l'Étranger and decides whether the Execution Gate opens (SQS ≥ 4/5). Triggered by /sdd gate, /sdd split, /sdd exec prerequisite check. |
| **traceability** | Use when generating, auditing or repairing the machine-verifiable traceability matrix Intent ↔ SPEC ↔ Code ↔ Tests. Reads code annotations (@intent, @spec, @verified-by, @governance), cross-references with .aiad/intents/ and .aiad/specs/, and emits o |

## 5. Gouvernance Tier 1

Pack par défaut : `eu-baseline`. Autres packs disponibles via `aiad-sdd gouvernance --pack <id>` (`us-baseline`, `uk-baseline`).

| Agent | Périmètre | Référentiel |
|-------|-----------|-------------|
| **AIAD-AI-ACT** |  | Règlement (UE) 2024/1689 — AI Act — Entré en vigueur le 1er août 2024 |
| **AIAD-RGAA** |  | RGAA 4.1.2 — Arrêté du 20 septembre 2024 (106 critères, ~257 tests) |
| **AIAD-RGESN** |  | RGESN v2 (Référentiel Général d'Écoconception de Services Numériques), publié mai 2024 par ARCEP / ARCOM / ADEME / DINUM. |
| **AIAD-RGPD** |  | Règlement Général sur la Protection des Données (UE) 2016/679 |

## 6. Annotations machine-vérifiables

Conventions reconnues par `aiad-sdd trace` (regex stables exportées par `lib/sdd-trace.js#ANNOTATION_REGEX`).

| Tag | Description |
|-----|-------------|
| `@intent` | Lien vers un Intent Statement (`INTENT-NNN`). Cardinalité 0..1. |
| `@spec` | Lien vers une SPEC (`SPEC-NNN-N-slug`). Cardinalité **1..n** sur tout code applicatif. |
| `@verified-by` | Chemin relatif vers un test qui couvre ce fichier. Cardinalité 0..n. |
| `@governance` | Liste d'agents Tier 1 invoqués (`AIAD-RGPD,AIAD-AI-ACT`, …). Cardinalité 0..1. |

---

*Document régénéré automatiquement — source-hash `b41ce3e96a380f8a`, package v1.14.0.*
