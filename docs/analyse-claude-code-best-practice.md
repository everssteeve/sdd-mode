# Analyse approfondie — `claude-code-best-practice` → Roadmap d'évolution SDD Mode

> **Source analysée** : [github.com/shanraisshan/claude-code-best-practice](https://github.com/shanraisshan/claude-code-best-practice) (56 9k★, dernière maj 2026-06-08)
> **Méthode** : exploration exhaustive en 5 clusters parallèles (best-practices core, 12 rapports techniques, workflows RPI/orchestration, tips Boris/Thariq/Karpathy/Dex/Matt + transcripts vidéo, config réelle hooks/skills/agents), croisée avec l'état du SDD Mode v1.17.0.
> **Date** : 2026-06-08
> **Cible Claude Code de référence** : v2.1.168 · Opus 4.8 · effort `low→max`

---

## Table des matières

1. [Le constat structurant : advisory → enforced](#1-le-constat-structurant--advisory--enforced)
2. [Analyse profonde par cluster](#2-analyse-profonde-par-cluster)
   - 2.1 [Primitives Claude Code (commands / skills / subagents / settings / hooks)](#21-primitives-claude-code)
   - 2.2 [Rapports techniques (harness, mémoire, dégradation, tool use)](#22-rapports-techniques)
   - 2.3 [Workflow RPI vs cycle SDD](#23-workflow-rpi-vs-cycle-sdd)
   - 2.4 [Tips & talks (Boris, Thariq, Karpathy, Dex, Matt)](#24-tips--talks)
   - 2.5 [Configuration & infrastructure réelle](#25-configuration--infrastructure-réelle)
3. [Roadmap priorisée P0 → P3](#3-roadmap-priorisée)
4. [Garde-fous de conception](#4-garde-fous-de-conception)
5. [Ce que SDD fait déjà mieux](#5-ce-que-sdd-fait-déjà-mieux)
6. [Annexes : inventaire des primitives](#6-annexes--inventaire-des-primitives)

---

## 1. Le constat structurant : advisory → enforced

Le rapport `why-harness-is-important.md` pose la distinction qui réorganise toute la roadmap :

> **Une règle écrite dans CLAUDE.md / AGENT-GUIDE est *advisory* — le modèle peut l'ignorer. Seules les primitives du harness (hooks, `deny` rules, agents isolés, lazy-load `paths:`) sont *enforced* — le modèle ne peut pas les contourner.**

Au niveau inférence, le modèle ne voit que des tokens, donc « tout est prompt » est vrai. **Mais à toute autre couche, la réduction s'effondre.** Le harness est un système de *construction de prompt + exécution déterministe + architecture de contexte*. Équivocation du mot « prompt » : (a) ce que l'utilisateur tape (~6-60 tokens) vs (b) ce que le modèle voit à l'inférence (~5K-50K tokens assemblés par le harness). **La qualité = f(b), pas f(a).**

**10 capacités que le prompt ne peut PAS répliquer** : context isolation (subagents) · tool restrictions harness-enforced (`deny`) · lazy-loaded rules/memory (`paths:`) · hooks déterministes (peuvent bloquer un tool call) · model routing · parallelism · cross-session persistence (memory) · modular system prompt (110+ fragments) · skill preloading · permission classification (mode `auto`).

### Application à SDD Mode

Aujourd'hui, **~90 % de la gouvernance SDD est documentaire** : le cycle, les vetos Tier 1, le Drift Lock, le Context Budget vivent dans des `.md` injectés. Le seul mécanisme réellement *enforced* est `.aiad/hooks/pre-commit.sh` (blocage `TODO-JNSP:`).

**L'axe d'évolution n°1 est donc : migrer chaque règle critique de « texte » vers « primitive harness ».** C'est ce qui transforme « le modèle *devrait* respecter le veto » en « le modèle *ne peut pas* le contourner ». Tout le reste de cette roadmap se range autour de cet axe.

### Priorisation d'ensemble (impact × effort)

| Prio | Thème | Impact | Effort |
|------|-------|--------|--------|
| **P0** | Gouvernance advisory → enforced (harness) | 🔴 Critique | Moyen |
| **P0** | Verdicts machine-vérifiables (CLI / JSON / exit codes) | 🔴 Critique | Faible |
| **P1** | Combler les 2 trous du cycle (Research/GO-NO-GO + Discovery) | 🟠 Fort | Moyen |
| **P1** | Context budget : push → pull, progressive disclosure | 🟠 Fort | Faible |
| **P2** | Memory native + Tasks comme graphe du cycle | 🟡 Moyen | Moyen |
| **P2** | Canary suite + alignement modèles (anti-bruit ±14 %) | 🟡 Moyen | Faible |
| **P3** | Observabilité OTel, cross-model, distribution plugin | 🟢 Confort | Variable |

---

## 2. Analyse profonde par cluster

### 2.1 Primitives Claude Code

#### Slash commands — frontmatter (16 champs)
`description` + `when_to_use` (auto-découverte, comptent dans le **cap 1 536 caractères**) · `argument-hint`, `arguments` (substitution `$name`) · `disable-model-invocation: true` (empêche l'auto-invocation — ex. espace humain pur) · `user-invocable: false` (commande = savoir d'arrière-plan, hors menu `/`) · `paths` (globs — **activation auto par fichier**) · `allowed-tools` / `disallowed-tools` · `model`, `effort` (`low…max,xhigh`) · **`context: fork` + `agent`** (exécuter la commande dans un subagent isolé) · `hooks` (scopés à la commande).

**Commandes built-in pertinentes** : `/context` (grille colorée d'usage + suggestions) · `/insights` (analyse de sessions, friction points) · `/team-onboarding` (guide depuis l'historique 30 j) · `/rewind` / `Esc-Esc` (checkpoint code+conversation) · `/goal [condition]` (boucle jusqu'à condition, évaluée par Haiku) · `/fork <directive>` (subagent arrière-plan héritant du contexte) · `/security-review`, `/review`, `/ultrareview` (revue multi-agent cloud) · `/schedule` (cron de routines) · `/compact`, `/clear`, `/branch` · `/effort … ultracode` (raisonnement xhigh + orchestration de workflow auto).

#### Skills — `.claude/skills/<name>/SKILL.md`
Frontmatter identique aux commandes (valide le design DRY « skills invoquées par commandes »). Clés notables : `user-invocable: false` (« background knowledge, agent preloading ») · `paths` (auto-activation par type de fichier) · `context: fork` + `agent` (skill en subagent isolé).

**Progressive disclosure** (point clé) : le `SKILL.md` reste court + table de pointeurs → `references/*.md`, `templates/*.sh`, `examples.md`, `reference.md` chargés **à la demande**. Settings de budget : `maxSkillDescriptionChars` (déf. **1536**) · `skillListingBudgetFraction` (déf. **0.01** = 1 % de fenêtre — au-delà, descriptions réduites au nom) · `skillOverrides` (`on|name-only|user-invocable-only|off`) · `disableSkillShellExecution`.

**Skills bundlées officielles** : `code-review` (`--comment` → commentaires PR inline), `simplify` (4 agents parallèles, ne cherche plus les bugs depuis v2.1.154), `debug`, `batch`, `loop`, `verify`, `run`, `run-skill-generator`, `fewer-permission-prompts`, `claude-api`.

#### Subagents — `.claude/agents/*.md` (16 champs)
`name`, `description` (**`PROACTIVELY`** → auto-invocation) · `tools` (allowlist, supporte `Agent(agent_type)`), `disallowedTools` · `model` (dont `inherit`), `permissionMode`, `maxTurns` · **`skills`** (preload du contenu complet) · `mcpServers` (scopés) · `hooks` · **`memory`** (`user|project|local`) · `background: true`, `effort`, **`isolation: "worktree"`**, `initialPrompt`, `color`.

**Agents built-in** : `general-purpose` (inherit, tous outils) · **`Explore`** (haiku, read-only — recherche de code rapide) · **`Plan`** (inherit, read-only) · `statusline-setup` · `claude-code-guide` (haiku). → `Explore` est le candidat idéal pour les opérations read-only de SDD (drift-detection, scan d'annotations) : rapide et incapable d'écrire.

#### Settings — `settings.json` (80+ settings, 200+ env vars)
**Hiérarchie** (haut→bas) : Managed (org) > CLI args > `settings.local.json` > `settings.json` > `~/.claude/settings.json`. Arrays concaténés + dédupliqués ; **`deny` a la précédence de sécurité absolue.**

**Managed settings = levier de gouvernance d'entreprise** : `managed-settings.d/` (drop-in dir façon systemd, merge ordonné) · `allowManagedPermissionRulesOnly`, `allowManagedHooksOnly`, `allowManagedMcpServersOnly`, **`strictPluginOnlyCustomization`** · `forceRemoteSettingsRefresh` (**fail-closed**) · `requiredMinimumVersion`, `policyHelper`, `parentSettingsBehavior: merge` · `claudeMd` (managed-only, instructions non-désactivables).

**Permissions** : modes `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, **`auto`** (classifier + safety check arrière-plan), `plan` (read-only garanti). `autoMode` prose-based : `environment`, `allow`, `soft_deny`, **`hard_deny`** (inviolable, **non lu depuis settings projet partagés** → anti-injection). Syntaxe : `Bash(npm run *)`, `Read(.env)`, `Skill(weather *)`, `Agent(name)`, `mcp__server__tool`.

**Effort & modèles** : `effortLevel` persistant, `fallbackModel` (jusqu'à 3), **`${CLAUDE_EFFORT}`** injecté dans skills/Bash/hooks, `ANTHROPIC_MODEL`, `CLAUDE_CODE_SUBAGENT_MODEL`, `MAX_THINKING_TOKENS`, **`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`** (compaction plus tôt), `CLAUDE_CODE_MAX_CONTEXT_TOKENS`.

**Sandbox** : `sandbox.enabled`, `failIfUnavailable`, `allowUnsandboxedCommands: false`, `network.allowedDomains/deniedDomains`, `filesystem.allowWrite/denyWrite/denyRead`.

**Observabilité** : OpenTelemetry (`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_METRICS_EXPORTER`, `OTEL_RESOURCE_ATTRIBUTES`) · `statusLine.command` (JSON stdin : `cost.total_cost_usd`, `context_window.used_percentage`, `rate_limits.*`, `effort.level`, `github`).

**CLI startup flags utiles** : `--print`/`--output-format json|stream-json` · **`--json-schema`** (sortie validée) · `--max-budget-usd`, `--max-turns` · `--append-system-prompt-file` · `--permission-mode`, `--allowedTools`, `--disallowedTools` · `--worktree` (`-w`) · `--strict-mcp-config` · `--from-pr` · `--init`/`--maintenance` (hooks de cycle de vie process).

#### MCP
`.mcp.json` (projet committé) vs `~/.claude.json` (user). Précédence **Subagent > Project > User**. Secrets via `${MCP_API_TOKEN}`. Permissions `mcp__<server>__<tool>` (wildcards `mcp__*`). **Leçon de sobriété** : « 15 serveurs MCP = trop, 4 utilisés au quotidien » (aligné « Sobriété Intentionnelle »). Trop de MCP = trop d'**instructions** en contexte → adhérence dégradée.

#### Memory / CLAUDE.md
Chargement : **ancestors (UP)** chargés au démarrage · **descendants (DOWN)** lazy (à la lecture d'un fichier du sous-répertoire) · **siblings** jamais. Settings liés : `claudeMdExcludes`, `claudeMd` (managed-only), `CLAUDE_CODE_DISABLE_CLAUDE_MDS`. ⚠️ **Les skills NE remontent PAS l'arbre** (≠ CLAUDE.md) : découverte descendante à la demande.

---

### 2.2 Rapports techniques

#### Advanced tool use (GA 18 fév. 2026)
- **Programmatic Tool Calling (PTC)** : Claude écrit du Python sandboxé qui appelle les outils ; résultats intermédiaires vont **au code, pas au contexte** ; seul le `stdout` final entre en contexte. ~37 % tokens économisés. → **modèle conceptuel exact de `aiad-sdd trace`** : calcul déterministe hors-modèle, seul le verdict injecté. À ériger en principe « computation off-context ».
- **Tool Use Examples** (`input_examples`) : 72→90 % précision params. → transposable aux **templates de SPEC** (exemples min/partiel/complet).
- **Tool Search Tool** (`defer_loading`) : ~85 % tokens économisés. → tes 27 commandes en 3 routers réinventent déjà ce pattern.

#### Agent vs Command vs Skill
| | Agent | Command | Skill |
|---|---|---|---|
| Contexte | Process séparé isolé | Inline | Inline (sauf `context: fork`) |
| Auto-invocable | Oui | **Non** (toujours `/`) | Oui |
| Mémoire | `memory:` | — | — |
| Preload skills | `skills:` | — | — |

Ordre de résolution : **Skill (inline) > Agent (contexte séparé) > Command (jamais auto)**. Pattern d'orchestration : `User → /command (orchestration) → Agent (isolé) → Skill préloadée (domaine) → Skill (inline, output)`.

#### Agent memory (v2.1.33)
`memory:` frontmatter → store markdown persistant par agent. `user` (`~/.claude/agent-memory/`), `project` (`.claude/agent-memory/`, **versionné + partagé**), `local` (gitignored). Au démarrage : **200 premières lignes de `MEMORY.md`** injectées ; si >200 lignes, l'agent éclate en fichiers par thème (auto-curation). → migre `AGENT-GUIDE` (Lessons Learned) et `.aiad/facts/` vers ce mécanisme.

#### SDK vs CLI system prompts
CLI = modulaire (~269 tokens base + 110+ fragments conditionnels). SDK = minimal (`systemPrompt: { type: "preset", preset: "claude_code" }` + `settingSources: ["project"]` sinon CLAUDE.md non chargé). **Finding critique : AUCUN déterminisme garanti** (pas de `seed` ; variance floating-point + routing MoE + batching). → les verdicts SQS/gate doivent venir d'un **script CLI déterministe**, jamais du jugement libre du modèle.

#### Global vs project settings
`deny` non-overridable = **mécanisme exact du droit de veto Tier 1**. **Tasks** (v2.1.16, remplace TodoWrite) : `~/.claude/tasks/`, filesystem, **auditable + versionnable + crash-recoverable**, graphe de dépendances (`addBlockedBy/addBlocks`), multi-session (`CLAUDE_CODE_TASK_LIST_ID`).

#### Skills pour monorepos
CLAUDE.md remonte l'arbre ; **les skills NON** (découverte descendante à la demande). Descriptions toujours en contexte (budget 15 000 car) ; contenu complet à l'invocation. Priorité noms identiques : Enterprise > Personal > Project. → **architecture de gouvernance par package** : RGPD strict sur `packages/payments/.claude/skills/`, découvert automatiquement sans polluer les autres packages = context budget engineering par zone de risque.

#### Dégradation jour-le-jour
**Frozen weights ≠ frozen behavior.** Variance mesurée **±8-14 %**. Causes : bugs infra (postmortem Anthropic sept. 2025, jusqu'à 16 % des requêtes, miscompilation XLA:TPU) · routing MoE (composition du batch) · post-training silencieux · **context pollution = cause #1 du « Claude got dumber » intra-session**. Guidance : **pin les snapshots**, canary suite quotidienne, séparer « qualité modèle » de « fiabilité serving », reset/compact des sessions longues. → **justification empirique du seuil 60-70 %** et de « UNE SPEC à la fois ».

#### Browser automation
Playwright MCP (13.7K tokens, accessibility-tree, isolé) > Claude in Chrome (15.4K, **23.6 % attack success sans mitigations**) > Chrome DevTools MCP (19K). → le 23.6 % est un cas d'école pour le veto AI-ACT/sécurité ; Playwright préférable pour les tests `@verified-by`.

---

### 2.3 Workflow RPI vs cycle SDD

**RPI = Research → Plan → Implement**, précédé de « Describe ». Tout vit dans `rpi/{feature-slug}/` :

```
rpi/{feature-slug}/
├── REQUEST.md              # Describe (humain)
├── research/RESEARCH.md    # verdict GO/NO-GO
├── plan/{pm,ux,eng}.md + PLAN.md   # 3-5 phases
└── implement/IMPLEMENT.md  # verdicts par phase
```

| Commande | Agents orchestrés (séquentiels) |
|----------|--------------------------------|
| `/rpi:research` | requirement-parser → product-manager → **Explore** → senior-software-engineer → technical-cto-advisor → documentation-analyst-writer |
| `/rpi:plan` | senior-eng (archi) → pm + ux + eng (**parallèle**) → doc-writer |
| `/rpi:implement` | Explore → senior-eng → self-validation → code-reviewer → **User Gate** → doc |

**Gates** : GO/NO-GO (fin Research : `GO | NO-GO | CONDITIONAL GO | DEFER` + confidence) · User Validation Gate (chaque phase : `PASS | CONDITIONAL PASS | FAIL`, **STOP obligatoire**) · Per-Phase + Final Quality Gate.

**`constitutional-validator`** (analogue des agents Tier 1, mais structurellement différent) : 1 agent opus, **5 dimensions scorées 0-10** + statut `Aligned/Partial/Misaligned` + **evidence citée** ; 4 verdicts gradués `APPROVED | WITH CONDITIONS | NEEDS REVISION | REJECTED` ; détecte des **anti-patterns nommés** (scope creep, over-engineering). Agit **en amont** (stade roadmap).

| Aspect | constitutional-validator | Agents Tier 1 SDD |
|--------|--------------------------|-------------------|
| Granularité | 1 agent, 5 dims 0-10 | 4 agents spécialisés |
| Domaine | Cohérence interne | Conformité **réglementaire externe** |
| Verdict | 4 niveaux + evidence | **Veto binaire fail-closed** (UNKNOWN=VETO) |
| Quand | Amont (roadmap) | validate/exec/security/fact |

**Cross-model workflow** (Claude + Codex, 2 terminaux) : PLAN (Claude Opus, Plan Mode) → QA REVIEW (Codex review contre le vrai codebase, insère « Phase 2.5 / Codex Finding » **sans réécrire** — additive only) → IMPLEMENT (Claude) → VERIFY (Codex). Séparation auteur/reviewer entre modèles + préservation de paternité.

**Mapping RPI ↔ SDD** :

| RPI | SDD Mode |
|-----|----------|
| REQUEST.md | Intent Statement |
| RESEARCH.md + GO/NO-GO | **(pas d'équivalent)** |
| plan/ (pm+ux+eng) | SPEC |
| constitutional-validator | Agents Tier 1 + regulatory-veto |
| User Gate par phase | Execution Gate (une seule fois) |
| /compact post-phase | context-budget skill |

**À emprunter (priorisé)** : 1. phase Research + gate GO/NO-GO ; 2. Explore/Discovery obligatoire ancrée dans le code ; 3. exécution phasée + mini-gates répétés + statut visuel ; 4. scoring 0-10 par dimension avec evidence ; 5. verdict `CONDITIONAL PASS` (3e état) ; 6. Out of Scope + hand-off nommé dans les skills ; 7. `/compact` rituel post-phase ; 8. cross-model auteur/reviewer additive-only.

---

### 2.4 Tips & talks

#### Planning / Spec
- **Boris** : « Mets toute ton énergie dans le plan pour one-shot l'implémentation. » 5 onglets terminal, plan mode systématique, un 2e Claude review le plan « en tant que staff engineer » (uncorrelated context). Dès que ça dérape → **re-planifier, ne pas pousser**.
- **Anthropic en interne** : **ni PRD ni ticketing imposé** (« better send a PR ») ; prototypage 15-20 variantes en 1,5 j plutôt que specs amont. → spec lourde justifiée **seulement** là où l'ambiguïté coûte cher.
- **Dex (« Everything we got wrong about RPI »)** : budget d'instructions **~150-200** max fiable ; « **n'utilisez pas les prompts pour le control flow — utilisez le control flow pour le control flow** » ; recherche en **context frais qui ignore ce qu'on construit** (faits vs opinions) ; RPI → CRISPY (questions→research→design→structure→plan→work→implement→PR, chaque prompt <40 instructions) ; **design doc ~200 lignes > plan ~1000 lignes** ; **tranches verticales testables** (le modèle code horizontalement = 1200 lignes avant de tester).
- **Matt Pocock** : skill **`grill me`** (« interview-moi sans relâche, 1 question à la fois, propose ta réponse recommandée ») = design concept de Brooks ; 2 docs (destination = PRD avec out-of-scope, journey = kanban) ; **ne lit pas le PRD** ; tracer bullets ; issues « independently grabbable » → DAG → parallélisation ; **Sonnet pour implémenter, Opus pour reviewer** ; deep modules (Ousterhout) ; **dock rot** (ne garde pas les PRD livrés). Critique frontale du « specs-to-code » : « **c'est du vibe coding où tu ignores le code… le code est ton champ de bataille.** »
- **Karpathy** : vibe coding (remonte le plancher) ≠ agentic engineering (préserve la barre pro) ; « **you can outsource your thinking but you can't outsource your understanding** » ; spec = docs détaillés, l'humain garde taste/judgment ; **verifiability** = ce que les LLM automatisent vite (RL sur récompense vérifiable).

#### Context engineering (convergence massive)
**Context rot / dumb zone** : Thariq (rot ~300-400k) ; Dex & Matt (**dumb zone dès ~40 % / ~100k tokens**, viser <40 %, wrapper à 60 %) ; Boris (60-70 %). **Les 5 options après chaque tour** (Thariq) : Continue / **Rewind (esc esc)** / Compact / Subagent / Fresh `/clear`. **Rewind > Correcting** (corriger laisse l'échec dans le contexte). **Subagents = garbage collection du contexte.** HumanLayer **n'utilise pas la compaction** (tout va dans des assets statiques markdown). **RAG est mort, agentic search gagne** (glob + grep).

#### Subagents / orchestration
« **use subagents** » = jeter plus de compute. **Uncorrelated context windows = test-time compute** (un agent crée un bug, un autre le trouve). **Code Review Anthropic** : équipe d'agents à l'ouverture de PR, attrape **~80 % des bugs** + agents de **dedup** parallèles (faux positifs). Pattern adversarial / opponent-processor / council of LLM judges. **Swarms** : plugins Claude Code construits par ~100 tâches / centaines d'agents sur un week-end à partir d'**un spec + un board d'issues**.

#### Hooks / automation / verification
« **Donne à Claude un moyen de vérifier son travail** » = tip le plus répété par Boris (**2-3× la qualité**). Skills de vérification = **investir une semaine d'ingénieur**. **Hooks = déterminisme dans un système stochastique** (Cat) : `SessionStart` (charger contexte), `PreToolUse` (logger, mesurer usage skills), `PostToolUse` (auto-format), `Stop` (relancer tant que tests échouent), `PermissionRequest` (router). On-demand hooks dans les skills : `/careful` (bloque rm -rf, DROP TABLE), `/freeze` (bloque edit hors dossier). **TDD red-green-refactor** empêche l'IA de tricher sur les tests. **Ralph Wiggum loop** (PRD + « petit changement qui rapproche » en boucle).

#### Modèles
**Opus + thinking pour tout** (Boris, effort High partout — « au final presque toujours plus rapide »). **Sonnet implémente, Opus review, Haiku slash commands cheap** (Matt). **Le harnais révèle le modèle** (Cat — il faut une tâche assez dure). « **Don't build for the model of today, build for the model 6 months from now** » (Boris) — le scaffolding gagne 10-20 % puis est effacé par le modèle suivant (plan mode sera *unship*).

#### Mémoire / compounding engineering
**CLAUDE.md minimal** (Boris : 2 lignes ; « si tu hits la limite, supprime et repars de zéro »). « **Update your CLAUDE.md so you don't make that mistake again** ». Mémoire **from logs, pas from one transcript** (« make the button pink » ≠ « tous les boutons roses »). Skills (Thariq) : `description` = **déclencheur** pour le modèle ; **section Gotchas = plus haut signal** ; ne pas railroader ; composer par référence ; **9 catégories** ; distribution via **marketplace de plugins** à l'échelle.

---

### 2.5 Configuration & infrastructure réelle

#### `settings.json` (clés réelles du repo)
`permissions {allow, deny, ask}` · `spinnerVerbs`, `spinnerTipsOverride` · `plansDirectory: "./reports"` · `outputStyle: "Explanatory"` · `statusLine` · **`attribution {commit, pr}`** (impose `Co-Authored-By` sans dépendre du modèle) · `respectGitignore` · `env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: "80"` · `enableAllProjectMcpServers: true`. Pattern intéressant : `Bash(*)` globalement `allow`, mais une couche **`ask`** rattrape les destructifs (`Bash(rm *)`, `npm *`, `docker *`, `kubectl *`, `wget *`, `kill *`…).

#### Les 30 hook events (révélés par les dossiers de sons)
`PreToolUse` · `PermissionRequest` · `PostToolUse` · `PostToolUseFailure` · `PostToolBatch` · `UserPromptSubmit` · `UserPromptExpansion` · `Notification` · `MessageDisplay` · `Stop` · `SubagentStart` · `SubagentStop` · `PreCompact` · `PostCompact` · `SessionStart` · `SessionEnd` · `Setup` · `TeammateIdle` · `TaskCreated` · `TaskCompleted` · `ConfigChange` · `WorktreeCreate` · `WorktreeRemove` · `InstructionsLoaded` · `Elicitation` · `ElicitationResult` · `StopFailure` · `CwdChanged` · `FileChanged` · `PermissionDenied`.

**Agent frontmatter hooks = sous-ensemble de 6** : `PreToolUse`, `PostToolUse`, `PermissionRequest`, `PostToolUseFailure`, `Stop`, `SubagentStop`.

**Types de handler** : `command` · `prompt` (éval single-turn → `{"ok": bool, "reason"}`) · **`agent`** (subagent multi-turn Read/Grep/Glob pour vérifier avant de décider — idéal pour `drift-detection`/`regulatory-veto`) · `http` (POST JSON). Options : `timeout`, `async`, `once`, `statusMessage`, `matcher`, `if` (syntaxe permission rule, ex. `if: "Bash(git *)"`), `asyncRewake` (réveille le modèle si exit 2).

**Events les plus utiles pour SDD** : `PreToolUse` matcher `Bash` + `if: "Bash(git commit *)"` + `permissionDecision: "deny"` + exit 2 (= migration TODO-JNSP) · `InstructionsLoaded` (matcher `load_reason: session_start|path_glob_match` — ancre « lire l'AGENT-GUIDE ») · `UserPromptExpansion` (fire quand une slash command s'expand, peut bloquer + injecter `additionalContext`).

#### Structure des fichiers
- **`hooks.py`** : maps en tête, garde anti-directory-traversal, fallback `hooks-config.local.json` → `hooks-config.json`, log JSONL, **toujours `sys.exit(0)`** sauf blocage explicite (exit 2). CLI `--agent=<name>`.
- **`hooks-config.json`** : config plate de booléens `disable<EventName>Hook` + override local (gitignored). Pattern réutilisable pour activer/désactiver skills SDD par environnement.
- **Agent réel `weather-agent.md`** : « **Execution Contract (non-negotiable)** » qui interdit le contournement de la skill + « **Fail-closed guardrail** » + allowlist excluant volontairement les tools réseau → **le contrat est appliqué par construction, pas par instruction** (= même principe que `UNKNOWN=VETO`).
- **`.claude/rules/*.md`** : frontmatter `paths:` (glob) → lazy-loading. Ex. `presentation.md` (`paths: ["presentation/**"]`) = règle de **délégation forcée** vers un agent. Sans `paths`, chargées dans chaque session.
- **`.codex/config.toml`** : `sandbox_mode`, `approval_policy` (clés plates snake_case). **Aucune synchro cross-runtime dans le repo** → ton `emit-rules` est plus avancé.

#### Patterns d'implémentation
- **Scheduled tasks** : `/loop <interval> /<command>`, granularité min 1 min, auto-expiration 3 j, session-scoped.
- **Agent teams** : sessions indépendantes coordonnées par **shared task list + data contract**, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, hooks `TeammateIdle/TaskCreated/TaskCompleted`.
- **Goals** : `/goal <condition>` (évalué par Haiku) maintient l'agent au travail jusqu'à condition remplie.

---

## 3. Roadmap priorisée

### P0 — Fondations : rendre la gouvernance *enforced*

#### 3.1 Vetos Tier 1 → primitives harness, pas du texte
Trois leviers cumulables :
- **`deny` rules / `autoMode.hard_deny`** dans `managed-settings.json` (org) : précédence absolue, non-overridable, `hard_deny` non lu depuis settings projet (anti-injection). Seul mécanisme qui exécute réellement « ne jamais ignorer un veto Tier 1 ».
- **Agents de gouvernance = vrais subagents** `.claude/agents/*.md` : `description: PROACTIVELY` · `disallowedTools` (un agent RGPD ne peut pas écrire) · `memory: project` (jurisprudence versionnée) · `context` isolé · `paths:` ciblés (RGPD sur PII, RGAA sur UI).
- **Hook `PreToolUse`/`Stop` type `agent`** : exécute `regulatory-veto`/`drift-detection` sur le diff et **bloque** (exit 2). Modèle = « Execution Contract + fail-closed + allowlist restrictive » du `weather-agent`.

#### 3.2 Migrer TODO-JNSP vers `PreToolUse` natif
Garder `pre-commit.sh` comme filet ; **ajouter** un hook `PreToolUse` matcher `Bash`, `if: "Bash(git commit *)"`, `hookSpecificOutput.permissionDecision: "deny"`, exit 2. Avantage : s'applique hors-CLI git + module la rigueur via `${CLAUDE_EFFORT}`.

#### 3.3 Drift Lock → hook
`PostToolBatch`/`Stop` (type `agent`) refusant la clôture si `aiad-sdd trace --fail-on-gap` échoue ou SPEC non synchronisée. Rend « merger sans Drift Check » mécaniquement impossible.

#### 3.4 Verdicts machine-vérifiables (principe « computation off-context »)
`/sdd gate`, `/sdd validate`, `/sdd trace`, `/sdd security` en `--print --output-format json --json-schema <schema>` + **exit codes 0/1/2** (PASS/FAIL/JNSP, déjà définis). Justification : **aucun déterminisme LLM garanti** → le verdict final doit venir d'un script CLI déterministe, jamais du jugement libre du modèle.

### P1 — Combler les 2 trous du cycle + alléger le contexte

#### 3.5 Phase Research + gate GO/NO-GO (le plus gros manque)
`/sdd research` **entre Intent et SPEC** : verdict gradué `GO | CONDITIONAL GO | DEFER | NO-GO` + confidence. Aujourd'hui SDD score la *qualité de la SPEC* (SQS) mais jamais la *viabilité de l'intention*. + **Discovery codebase obligatoire** (agent `Explore` haiku read-only) avant `/sdd spec` et `/sdd exec`. ⚠️ **Meilleure défense contre le piège « specs-to-code »** rejeté par Matt/Dex/Karpathy.

#### 3.6 Exécution phasée + mini-gates + 3e verdict
Découper `/sdd exec` en **tranches verticales testables** avec mini-gates répétés + statut visuel `[ ] [~] [x] [!] [-]`. Ajouter **`CONDITIONAL PASS`** comme 3e état. Emprunter le **scoring 0-10 par dimension avec evidence** du constitutional-validator, en gardant `UNKNOWN=VETO`.

#### 3.7 Budget d'instructions : push → pull
~150-200 instructions max fiable. CLAUDE.md (16 KB) + AGENTS.md + 4 Tier 1 + matrices injectés en permanence diluent l'adhérence.
- Migrer en **pull** : `.claude/rules/*.md` avec `paths:` (gouvernance RGPD chargée seulement sur fichiers PII).
- **CLAUDE.md le plus court possible.**
- **Progressive disclosure** sur skills lourdes (`SKILL.md` court + `references/*.md` + `examples.md`).
- Vérifier `skillListingBudgetFraction` (1 %) et `maxSkillDescriptionChars` (1536) pour les 8 skills.
- `context: fork` + agent `Explore` (haiku read-only) pour skills read-only.
- `env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` = levier natif du seuil 60-70 % (justifié empiriquement : context pollution = cause #1 de dégradation).

### P2 — Capitalisation, robustesse, anti-bruit

#### 3.8 Memory native
`AGENT-GUIDE` (Lessons Learned) + `.aiad/facts/` → `memory: project` (auto-curaté <200 lignes, versionné). Mémoire **from logs, pas from one transcript**. Prévoir un **cycle de clôture/archivage** des artefacts livrés (anti dock rot).

#### 3.9 Cycle SDD comme graphe de Tasks
Modéliser Intent→SPEC→Gate→Exec→Validate→Drift Lock en `addBlockedBy/addBlocks` : « ne jamais sauter d'étape » devient exécutoire, `crash-recoverable` répond à `/sdd resume`.

#### 3.10 Canary suite + alignement modèles
Variance ±8-14 % → **set fixe d'Intents/SPECs rejoué quotidiennement** (séparer régression réelle du bruit avant `/aiad retro`). **Pin les snapshots**, séparer « qualité modèle » / « fiabilité serving ». **Aligner les références** : Opus 4.7 → **Opus 4.8, effort `xhigh`/`max`, v2.1.168**.

### P3 — Confort, observabilité, distribution

#### 3.11 Observabilité native
DORA/Flow → **OpenTelemetry** (`OTEL_*`). **`statusLine`** live (SPEC active, état Gate, % contexte). Mesurer l'usage des skills via hook `PreToolUse`. `attribution.commit` pour le `Co-Authored-By`.

#### 3.12 Cross-model auteur/reviewer « additive-only »
`/sdd validate --cross-model` : Codex/Gemini review en mode additif (Findings sans réécrire) = Human Authorship entre IA. Uncorrelated context windows (~80 % des bugs attrapés + dedup).

#### 3.13 Distribution & boucles
Packager SDD comme **plugin/marketplace** (modèle `anthropics/skills`). `/goal` pour « itérer jusqu'à SQS ≥ 4/5 ». Pattern config plate de toggles (`hooks-config.json` + `.local.json`).

---

## 4. Garde-fous de conception

Convergence Karpathy / Dex / Matt / Boris — à inscrire dans la philosophie SDD :

1. **SDD *est* l'« agentic engineering » de Karpathy** formalisé (vibe coding remonte le plancher ; agentic engineering préserve la barre). Positionnement fort.
2. **Garder le code en boucle** (≠ specs-to-code naïf). Discovery obligatoire (§3.5) répond à ça.
3. **Léger par défaut, lourd seulement si l'ambiguïté coûte cher** (Anthropic : ni PRD ni ticketing). La variante EARS optionnelle v1.11 est la bonne direction — pousser « léger par défaut ».
4. **Gate humain = interactif** (grilling 1 question à la fois + recommandation, façon `grill me`), pas un formulaire statique.
5. **Prévoir des règles qui se suppriment** : les best-practices changent à chaque modèle (plan mode sera *unship*). Marquer certaines règles « à retirer quand le modèle n'en a plus besoin ».

---

## 5. Ce que SDD fait déjà mieux

À conserver et valoriser :
- **Conformité réglementaire externe réelle** (EU AI Act fail-closed, RGPD, RGAA, RGESN) — RPI n'a qu'une « constitution » interne, aucune dimension légale.
- **Annotations machine-vérifiables** (`@intent/@spec/@verified-by/@governance`) + matrice `trace --fail-on-gap` en CI — RPI n'a **aucune traçabilité machine** (tout markdown human-readable).
- **Drift Lock** (SPEC + code même PR) — RPI n'a pas de mécanisme anti-divergence post-merge.
- **Protocole JNSP** structuré (exit codes 0/1/2 + hook pre-commit) — RPI dit « ask the user » sans formalisme.
- **SQS quantifié + Test de l'Étranger** + cohabitation EARS — RPI n'a pas de scoring de spec aussi rigoureux.
- **Synchro multi-runtime `emit-rules`** (source unique `.aiad/` → CLAUDE.md/AGENTS.md/.cursor/.codex/GEMINI.md + CI de divergence) — le repo de référence n'a **aucune** synchro cross-runtime.

---

## 6. Annexes : inventaire des primitives

### 6.1 Frontmatter — récapitulatif comparé

| Champ | Command | Skill | Subagent |
|-------|:---:|:---:|:---:|
| `description` / `when_to_use` | ✓ | ✓ | ✓ (`PROACTIVELY`) |
| `argument-hint` / `arguments` | ✓ | ✓ | — |
| `disable-model-invocation` | ✓ | ✓ | — |
| `user-invocable: false` | ✓ | ✓ | — |
| `paths` (globs) | ✓ | ✓ | ✓ |
| `allowed-tools` / `disallowedTools` | ✓ | ✓ | ✓ |
| `model` / `effort` | ✓ | ✓ | ✓ (+`inherit`) |
| `context: fork` + `agent` | ✓ | ✓ | n/a |
| `hooks` | ✓ | ✓ | ✓ |
| `skills` (preload) | — | — | ✓ |
| `memory` (user/project/local) | — | — | ✓ |
| `mcpServers` | — | — | ✓ |
| `permissionMode` / `maxTurns` | — | — | ✓ |
| `isolation: "worktree"` / `background` | — | — | ✓ |

### 6.2 Mapping « règle SDD → primitive harness »

| Règle SDD (advisory aujourd'hui) | Primitive enforced cible |
|----------------------------------|--------------------------|
| Veto Tier 1 | `deny` rule managed + subagent `disallowedTools` + hook `agent` |
| TODO-JNSP non résolu | hook `PreToolUse` `if: "Bash(git commit *)"` exit 2 |
| Drift Lock (SPEC+code même PR) | hook `PostToolBatch`/`Stop` + `trace --fail-on-gap` |
| « lire l'AGENT-GUIDE en début de session » | hook `InstructionsLoaded` / `SessionStart` |
| « ne jamais sauter d'étape » | Tasks graph `addBlockedBy` |
| Gouvernance par zone de risque | `.claude/rules/*.md` `paths:` lazy-load |
| Context budget 60-70 % | `env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` |
| Verdict de gate | CLI `--json-schema` + exit 0/1/2 |
| Agent gouvernance read-only | subagent `Explore` (haiku) ou `disallowedTools` |
| Co-Authored-By commit | `settings.attribution.commit` |

### 6.3 Les 30 hook events (référence)
`PreToolUse` · `PermissionRequest` · `PostToolUse` · `PostToolUseFailure` · `PostToolBatch` · `UserPromptSubmit` · `UserPromptExpansion` · `Notification` · `MessageDisplay` · `Stop` · `SubagentStart` · `SubagentStop` · `PreCompact` · `PostCompact` · `SessionStart` · `SessionEnd` · `Setup` · `TeammateIdle` · `TaskCreated` · `TaskCompleted` · `ConfigChange` · `WorktreeCreate` · `WorktreeRemove` · `InstructionsLoaded` · `Elicitation` · `ElicitationResult` · `StopFailure` · `CwdChanged` · `FileChanged` · `PermissionDenied`.

---

*Document généré le 2026-06-08 à partir de l'analyse exhaustive de `shanraisshan/claude-code-best-practice`. À relire à chaque montée de version majeure de Claude Code (les best-practices changent à chaque modèle).*
