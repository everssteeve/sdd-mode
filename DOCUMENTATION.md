<!-- DO NOT EDIT — regenerate via aiad-sdd docs -->
---
title: aiad-sdd — Documentation utilisateur
generated-by: aiad-sdd docs
version: 1.17.0
source-hash: 52c86353fdb58694
---

# aiad-sdd — Documentation utilisateur (v1.17.0)

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
aiad-sdd v1.17.0 — Spec Driven Development pour Claude Code
  https://aiad.ovh

  Commandes :
    new <template> [<dir>] Bootstrap un projet clés-en-main (--list pour voir la liste)
    import [--from src]   Importe Spec Kit / Kiro vers .aiad/ (auto-détection sinon)
    score <intent|spec> <id>  Score local via Ollama (souverain, AIAD_OLLAMA_URL)
    template <domain>     Génère une SPEC depuis bibliothèque (auth-oidc, payment-pci, rag-llm, gdpr-data-export)
    review <branch>       Diff Intent/SPEC vs branche cible (rapport Markdown commentable en PR)
    suggest-annotations <fichier>  Ollama local suggère @spec/@governance/@verified-by (Human Authorship préservé)
    export <sub>          Génère artefacts externes : openapi (OpenAPI 3.1) | confluence (publish pages)
    storybook             Storybook HTML zero-dep des 30 commandes slash (recherche + filtres)
    cert <sub>            Programme certification Product Engineer AIAD (matrix|exam|badge|verify)
    marketplace <sub>     Catalogue packs verticaux premium (list|info <id>) — santé/auto/aero/industriel
    audit <sub>           Audit trail crypto-signé append-only (log|verify|append) — AI Act/RGPD/CRA
    provenance <sub>      Attestation SLSA Provenance v1.0 signée HMAC (generate|verify|sigstore)
    hook-stats            Métriques santé du hook pre-commit (latence p50/p95, timeouts, fuites)
    dinum <sub>           Kit DINUM FR (publiccode|franceconnect|check) — soumission code.gouv.fr
    sovereignty           Score EU Sovereignty composite (5 dimensions, niveau Bronze→Platinum)
    adrs [--json]         Liste les Architecture Decision Records extraits de .aiad/ARCHITECTURE.md
    dora --record         Enregistre un déploiement DORA (status, cycle, lead, release, commit, date)
    dora --import-git     Importe les déploiements depuis les tags Git (--since YYYY-MM-DD)
    self-update [--json]  Vérifie une mise à jour npm (opt-in, jamais silencieux)
    standup --lens <role> Imprime l'URL Kanban focus-mode du rituel standup (lens=pm|pe|ae|qa|tl|all, --open, --all, --regen, --serve, --port, --json, --markdown)
    brief [--json|--markdown|--strict=N|--strict-tests=N|--diff=<file>|--quiet] Résumé one-pager projet · --strict=N exit 1 si santé<N · --strict-tests=N exit 1 si tests<N · --markdown Slack/Notion · --diff delta · --quiet silent en CI si pass
    badge [--out PATH]    Génère SVG badge (style shields.io) pour README · --type=sante|maturite|violations · --all (3 badges) · --shields-endpoint (JSON pour gist+shields.io) · --dry-run --label "Custom" --json
    gitlab <sub>          Connecteur GitLab (review --mr|issue --intent|wiki --intent|--spec)
    azure <sub>           Connecteur Azure DevOps (pr --id|work-item --intent|wiki --intent|--spec)
    webhooks <sub>        Webhooks AIAD signés HMAC (list|test --type <event>|emit --type <event>)
    reflect [--since|--jours]   Rétrospective sprint via Ollama local — 3-5 axes d'amélioration
    negotiate <A> <B>     Médiation entre 2 Intents via Ollama : conflits + Intent commun + arbitrages
    refactor-spec <id>    Détection SPEC > 200 LOC ou > 7 critères + découpage proposé (--all|--ai)
    spec-version <sub>    Versioning sémantique SPEC (check <id>|bump <id> <kind>) — détecte breaking
    archive <id>          Archive Intent/SPEC (--reason|--list|--restore <id>|--dry-run) → audit + webhook
    sla <sub>             Matrice SLA support/sécurité (show|check|update) — injecte dans SECURITY.md
    completion <shell>    Auto-complétion CLI (bash|zsh|fish) — script à sourcer dans le shell
    tour                  Guided tour interactif (Intent→SPEC→Gate→Trace) — onboarding pédagogique
    pii-scan [<file>]     Détecte PII (IBAN/NIR/cartes/tokens/email/tel) — pre-commit RGPD (--staged|--json)
    offline <sub>         Mode air-gapped (status|log) — bloque tout HTTP non-local (AIAD_OFFLINE=1)
    bitbucket <sub>       Connecteur Bitbucket (pr --id|issue --intent) — Cloud + Server REST
    ci-template <forge>   Installe template CI/CD (github|gitlab|jenkins|drone|bitbucket|azure) — --list pour le détail · #233/#235/#236
    github-app <sub>      Installe workflow/manifest GitHub (install workflow|install manifest|setup)
    anonymize --input <p> Anonymise un JSON (hash PII / généralisation / k-anonymity / Laplace DP)
    plugin <sub>          Système de plugins AIAD (list|info|install <dir>|uninstall <id>)
    hooks-init            Crée .aiad/hooks/aiad-hooks.js (template ESM beforeCommand/afterCommand)
    schema [--format]     Génère OpenAPI 3.1 des sorties --json (yaml|json, --out, --dry-run)
    org <sub>             Configuration org-level (show|init|check) — politiques cross-projets
    rbac <sub>            RBAC léger sur artefacts (whoami|init|check) — owner+reviewers frontmatter
    tutorial <id>         Tutoriel domaine (auth-oidc|payment-pci|rag-llm|gdpr-data-export) — --list
    backup [--out path]   Archive cryptée AES-256-GCM de .aiad/ (--password|--key-file) — RGPD/CRA
    restore --archive <p> Restaure une archive .aiad-backup (--password|--key-file|--force|--dry-run)
    init [options]        Initialise SDD Mode dans le projet courant
    update [options]      Met à jour un projet existant (commandes + gouvernance)
    gouvernance           Ajoute/met à jour les agents de gouvernance
    gouvernance lint      Détecte les contradictions TOUJOURS/JAMAIS inter-agents Tier 1
    hooks [options]       Installe / désinstalle le hook Git pre-commit (Drift Lock)
    status [--json|--markdown] Affiche l'état SDD du projet · --markdown pour paste PR/Slack/Notion
    doctor [--json|--markdown|--quiet|--fix|--supplementaire|--strict-sante=N] Diagnostic + score santé #218 · --markdown PR/Slack · --quiet silent en CI si pass · --strict-sante=N exit 1 si <N
    skills validate       Vérifie le frontmatter des skills (.claude/skills/)
    repl                  REPL interactif (atelier intent/spec/trace/doctor sans quitter le terminal)
    migrate [--force]     Détecte les versions installées < courante et applique les migrations structurelles
    migrate-v2 [--apply]  Squelette migration v1 → v2 (dry-run par défaut, --json, --rollback-on-error, --keep-backups N)
    obsidian [--out=DIR]  Exporte .aiad/ vers un Obsidian Vault (wiki-links + MOC + README, défaut : obsidian-vault/)
    workspace <sub>       Mode multi-projet (doctor|trace|analytics) — agrège cross-org
    ai-act audit          Pré-remplit la documentation Annexe IV du Règlement (UE) 2024/1689
    sbom [options]        Génère un SBOM CycloneDX v1.5 (Cyber Resilience Act EU 2024/2847)
    dpia [options]        Pré-remplit l'AIPD Article 35 RGPD (méthode CNIL, 9 sections)
    verify-reproducibility  Calcule le content hash déterministe du tarball (CRA, SLSA, NIST SSDF)
    docs [--check]        Régénère DOCUMENTATION.md depuis les sources (CI parity)
    telemetry <sub>       Télémétrie opt-in (opt-in / opt-out / status [--json])
    feedback [<sub>]      Feedback qualitatif (opt-in / opt-out / status) — invitation auto toutes les 15 sessions
    uninstall [options]   Retire aiad-sdd du projet (mode aperçu sauf --force)
    bench [compare]       Mesure cold-start ; --persist log historique ; compare --since N --threshold T
    research <id>         Gate Research GO/NO-GO déterministe (§3.5) — verdict gradué ancré Discovery (exit 0/1/2)
    discovery-check [id]   Prérequis Discovery (§3.5) — Research liée prête pour /sdd spec|exec (exit 0/1/2)
    mini-gate <spec>       Mini-gate par tranche (§3.6) — --phase N (ou --all) → PASS|CONDITIONAL|FAIL|JNSP (exit 0/1/2)
    exec-status <spec>     Avancement d'un plan d'exécution phasé (§3.6) — marqueurs [ ][~][x][!][-] (--json)
    trace [options]       Génère la matrice Intent ↔ SPEC ↔ Code ↔ Tests
    dashboard [options]   Génère le dashboard HTML multi-pages dans dashboard/
    emit-rules [options]  Régénère AGENTS.md, CLAUDE.md, .cursor/rules/, .codex/, GEMINI.md
    help                  Affiche cette aide

  Options init :
    -i, --interactive     TUI interactive en français (4 questions, zero-dep)
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
    --watch               Régénère la matrice à chaque changement (intent/spec/code)
    --suggest             Crée un squelette EARS pour chaque SPEC orpheline (référencée
                          par le code mais absente de .aiad/specs/). À combiner avec --dry-run
                          pour aperçu, ou exécution directe pour générer les squelettes.

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
    --public-url <url>    URL absolue publique (GitHub Pages, etc.) pour og:url/og:image/sitemap
                          (ou variable env AIAD_PUBLIC_URL — requis pour preview Slack/Teams)
    --check               Mode CI : valide la génération sans écrire les fichiers (exit 1 si erreur)
    --full                Inclut TOUTES les gaps dans data.json (défaut tronqué à 100 entrées par liste,
                          réduit ~860 KB → ~80 KB pour les consumers CI)
    --source-base <url>   URL préfixant les liens vers les fichiers .md sources
                          (ex: GitHub Pages → blob/main/). Valeur 'auto' pour
                          détecter depuis git remote.origin.url
                          (github/gitlab/bitbucket reconnus). Forme
                          'auto:main' pour cibler une branche précise au lieu
                          de HEAD (utile : dev/master/develop).
                          (ou variable env AIAD_SOURCE_BASE — utile en CI/CD)

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

  Exit codes :
    0  succès / verdict PASS
    1  échec, erreur ou verdict FAIL
    2  verdict JNSP (Je Ne Sais Pas) — décision humaine requise, ce n'est
       pas une erreur. Émis par les commandes qui détectent une situation
       non décidable (intent flou, critère non testable, gouvernance
       ambiguë, fichier illisible). Voir AGENTS.md section « INCERTITUDE ».

  Framework AIAD — Artificial Intelligence Agent Development — Open Source
```

## 2. Commandes slash SDD

Disponibles via `/sdd <sub>` dans Claude Code après `aiad-sdd init`.

| Commande | Description |
|----------|-------------|
| `/sdd arch` ([`arch.md`](./templates/.claude/sdd/arch.md)) | Assistant ARCHITECTURE — discovery technique guidé par un architecte expérimenté pour renseigner .aiad/ARCHITECTURE.md |
| `/sdd audit` ([`audit.md`](./templates/.claude/sdd/audit.md)) | Audit qualité du code (conformité SPEC, dette technique, cohérence AGENT-GUIDE) |
| `/sdd context` ([`context.md`](./templates/.claude/sdd/context.md)) | Auditer le Context Engineering Budget d'une session agent (estimation vs. réel) avec métriques de santé |
| `/sdd drift-check` ([`drift-check.md`](./templates/.claude/sdd/drift-check.md)) | Vérifier la synchronisation artefacts/code (Drift Lock) |
| `/sdd exec` ([`exec.md`](./templates/.claude/sdd/exec.md)) | Lancer l'exécution agent avec une SPEC validée (post-Gate) |
| `/sdd fact` ([`fact.md`](./templates/.claude/sdd/fact.md)) | Capturer et qualifier un écart livré/désiré (patch, dette, intent ou spec update) |
| `/sdd gate` ([`gate.md`](./templates/.claude/sdd/gate.md)) | Valider une SPEC via l'Execution Gate (SQS >= 4/5) |
| `/sdd init` ([`init.md`](./templates/.claude/sdd/init.md)) | Cadrage initial d'un projet SDD Mode (PRD + ARCHITECTURE + AGENT-GUIDE) |
| `/sdd intent` ([`intent.md`](./templates/.claude/sdd/intent.md)) | Capturer une intention humaine sous forme d'Intent Statement |
| `/sdd prd` ([`prd.md`](./templates/.claude/sdd/prd.md)) | Assistant PRD — discovery produit guidé par un PM expérimenté pour renseigner .aiad/PRD.md |
| `/sdd research` ([`research.md`](./templates/.claude/sdd/research.md)) | Phase Research — Discovery codebase + gate GO/NO-GO avant la SPEC |
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
| `/aiad gouvernance` | Vérifier la conformité d'un livrable aux 5 agents de gouvernance Tier 1 |
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
| **grill-me** | Use when a human gate must be interactive (« grill me ») rather than a static form — one question at a time, the agent proposes its recommended answer, the human validates or corrects. Triggered by /sdd gate --guided and /sdd research --guided. Prese |
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
| **AIAD-CRA** |  | Règlement (UE) 2024/2847 — Cyber Resilience Act (CRA) — Entré en vigueur le 10 décembre 2024 — Application générale : 11 décembre 2027 (obligation de signalement des vulnérabilités exploitées : 11 septembre 2026). |
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

*Document régénéré automatiquement — source-hash `52c86353fdb58694`, package v1.17.0.*
