# PRD rétro-ingénieré — `aiad-sdd` (AIAD SDD Mode)

> **Nature du document** : PRD reconstruit par rétro-ingénierie de la codebase (v1.19.0) et des 32 Intent Statements de `.aiad/intents/` (actifs + archive + Atelier d'Intention 2026-06).
> Il complète — sans le remplacer — le `PRD.md` humain de `.aiad/` (source de vérité produit, Human Authorship).
> Généré le 2026-07-02. Périmètre observé : `bin/`, `lib/`, `.claude/`, `.aiad/`, `templates/`, `site/`, `dashboard/`, `vscode-extension/`, `scripts/`, `.github/workflows/`, `docs/`, `bench/`, `productbacklog.md`, `argumentaires/`.

---

## 1. Vision et problème

**Problème** : les agents IA génèrent du code avec des effets de bord non maîtrisés — dérive par rapport à l'intention (drift), décisions techniques silencieuses, code hors spec, gouvernance ignorée. Les organisations n'ont ni workflow structuré autour de ces agents, ni traçabilité de qui décide quoi.

**Vision (North Star)** : *« Tu écris une intention, l'agent livre du code traçable, conforme et auditable — sans drift. »* Toute organisation peut adopter un process Spec Driven Development assisté par IA sans friction ; l'intention humaine reste maîtrisée du début à la fin.

**Positionnement stratégique** (productbacklog.md, argumentaires/) : **framework leader européen du développement basé sur l'intention** — français par défaut, gouvernance EU (AI Act, RGPD, RGAA, RGESN, CRA) comme différenciateur central face aux harnesses propriétaires (Kiro, Spec Kit, OpenSpec, BMAD) qui n'ont pas de couche gouvernance. Artefacts model-agnostic (résilience au changement de fournisseur LLM).

**Personas** : Alex (Product Manager — clarté sans réunions de collecte), Sam (Product Engineer — cycle Intent → Spec → Code tracé), Jordan (Tech Lead — zéro décision technique silencieuse), plus les personas dashboard : QA, SRE/Ops, DPO, Legal & Compliance.

---

## 2. Principes produit fondateurs (invariants observés dans le code)

1. **Human Authorship** — la paternité de l'intention ne se délègue pas : `human-authorship-check` bloquant sur `/sdd intent`, `memory promote` refusé sans `--auteur` (exit 2), Atelier d'Intention = espace humain pur.
2. **Verdicts déterministes, jamais du jugement libre du LLM** — toute gate (research, mini-gate, veto, drift, canary) est recalculée par script avec contrat d'exit codes `0 = PASS / 1 = FAIL / 2 = JNSP` et schémas JSON de verdict (`lib/verdict.js`, `.aiad/schema/verdicts/`).
3. **JNSP fail-closed** — « Je Ne Sais Pas » est un signal valide de premier ordre : `UNKNOWN = VETO` en gouvernance, drift `INCONNU ≠ OK`, Gate `INCONNUE`, `// TODO-JNSP:` bloqué au commit. Jamais dégradé en PASS « pour faire avancer ».
4. **Advisory → Enforced** (fil rouge des Intents 002/003/004/008/024/031) — chaque règle critique devient une primitive harness non contournable : hooks PreToolUse/Stop, CI `--fail-on-gap`, veto non-bypassable.
5. **Souveraineté EU/FR** — zero-dépendance npm runtime, français par défaut (i18n EN), IA locale Ollama uniquement, télémétrie/feedback strictement opt-in RGPD, mode air-gapped `AIAD_OFFLINE=1`.
6. **Single source of truth régénérée et vérifiée en CI** — AGENT-GUIDE → emit-rules (6 runtimes), sources → DOCUMENTATION.md, package.json → version-sync, avec `source-hash` SHA-256 et workflows `--check` bloquants.
7. **Sobriété intentionnelle** — registre de commandes core/extended/experimental, dépréciation soft (retrait v2), budget de contexte 60-70 %, gouvernance en pull (`.claude/rules` + `paths:`), mesure d'usage des skills, empreinte CO₂ (EcoLogits).
8. **Empirisme / honnêteté** — claims chiffrés sourcés (`lint:claims`), suite canary contre le bruit de serving LLM, benchmarks à méthodologie assumée (mesuré 🔬 vs documenté 📄), comparatif concurrentiel qui assume les faiblesses.
9. **Dogfooding** — le package est lui-même piloté par ses Intents/SPECs : annotations `@spec` dans `lib/`, dashboard du repo publié, zéro drift entre site/README/package.

---

## 3. Architecture produit — les 6 surfaces

| Surface | Rôle | Distribution |
|---|---|---|
| **CLI `aiad-sdd`** (~90 commandes, zero-dep, Node ≥ 18 / Bun ≥ 1.2) | Moteur : scaffolding, traçabilité, verdicts, conformité, dashboards | npm (`npx aiad-sdd`), provenance signée |
| **Runtime agent** (routers `/sdd`, `/aiad`, `/aiad-help` + 10 skills + 5 agents Tier 1 + 8 hooks) | Le workflow SDD dans Claude Code / Cursor / Codex / Copilot / Gemini / Kiro | `init` + plugin Claude Code |
| **Dashboard HTML** (~20 pages hub + pages détail par Intent/SPEC) | Pilotage multi-personas, publiable GitHub Pages | commande `dashboard` |
| **Extension VS Code** (`aiad-sdd-vscode`) | Vues Intents/SPECs, CodeLens `@spec`, 12 commandes | Marketplace VS Code |
| **Site documentaire** aiad.ovh (bilingue FR/EN, statique) | Doc concepts + commandes + gouvernance + comparatif | gh-pages |
| **Intégrations forges & CI** | GitHub/GitLab/Azure/Bitbucket/Jenkins/Drone + GitHub App + webhooks | templates CI + workflows fournis |

---

## 4. Fonctionnalités — inventaire exhaustif

### 4.1 Cycle SDD (cœur du produit)

Cycle exécutoire, matérialisé en graphe de tâches crash-recoverable (`.aiad/cycle/INTENT-NNN.json`, CLI `cycle init|show|step|next`) :

```
Intent → Research (GO/NO-GO) → SPEC → Execution Gate (SQS ≥ 4/5) → Exécution phasée → Validation → Drift Lock
```

| Étape | Commande(s) | Fonctionnalités |
|---|---|---|
| **Cadrage** | `/sdd prd`, `/sdd arch`, `/sdd init`, `/aiad init` | Assistants discovery guidés (questions PM / architecte) → `.aiad/PRD.md`, `ARCHITECTURE.md` (+ ADRs, résumé ≤ 500 tokens) ; bootstrap table rase ou sur projet existant |
| **Intention** | `/sdd intent` | Intent Statement 5 champs (POURQUOI MAINTENANT / POUR QUI / OBJECTIF mesurable / CONTRAINTES / CRITÈRE DE DRIFT) ; `human-authorship-check` bloquant ; création du graphe de cycle |
| **Research** (v1.18, §3.5) | `/sdd research`, CLI `research`, `discovery-check` | Valide la **viabilité de l'intention** (pas la SPEC) : Discovery codebase obligatoire par agent Explore read-only avec ancrages `chemin:ligne` ; verdict gradué **GO / CONDITIONAL GO / DEFER / NO-GO** tranché par l'humain, durci par scorer déterministe (exit 0/1/2) ; hook `discovery-gate.js` vérifie le prérequis avant spec/exec ; proportionnalité (court-circuit tracé admis pour intention triviale) |
| **Spécification** | `/sdd spec` (`--ears`), `/sdd split`, CLI `refactor-spec`, `spec-version`, `template <domain>` | SPEC atomique (1 SPEC = 1 PR, ≤ 200 lignes), format prose ou **EARS** ; plan de parallélisme en waves si ≥ 2 SPECs ; découpage 4 patterns ; semver de SPEC avec détection de breaking changes ; bibliothèque de 9 SPECs EARS pré-écrites (auth-oidc, payment-pci, rag-llm, gdpr-data-export, multi-tenant, billing, notifications, observability, search) ; REASONS Canvas (SPDD) en option |
| **Gate** | `/sdd gate`, skill `sqs-scoring` | Score SQS 5 critères (Complétude, Testabilité, Atomicité, Non-ambiguïté, Traçabilité) + Test de l'Étranger ; 4 issues : OUVERTE / OUVERTE avec réserve (4/5) / FERMÉE (≤ 3/5, plan de remédiation) / **INCONNUE** (`?/5` fail-closed) ; EARS strict : 0 violation → bonus +1 Testabilité, ≥ 1 → critère forcé à 0 ; mode `grill-me` interactif en guidé |
| **Exécution** (v1.18, §3.6) | `/sdd exec`, CLI `mini-gate`, `exec-status`, `/sdd resume` | 6 prérequis vérifiés (SQS, Intent actif, Discovery, dépendances) ; budget < ≈ 50K tokens ; veto gouvernance pré-lancement ; **plan phasé en tranches verticales testables** avec statuts machine `[ ][~][x][!][-]` et mini-gate par tranche (verdict PASS/CONDITIONAL/FAIL/JNSP) ; contrat JNSP injecté dans le prompt ; reprise de session depuis le graphe de cycle |
| **Validation** | `/sdd validate`, CLI `cross-model`, `spec stamp-validated` | Triple validation (technique, fonctionnelle vs critères, gouvernance) ; **cross-model review** additive-only par un second modèle en contexte frais (findings non résolus → au plus CONDITIONAL) ; badge CO₂ EcoLogits ; verdicts VALIDÉ / CORRECTIONS MINEURES / ÉCHEC / JNSP |
| **Drift Lock** | `/sdd drift-check`, `/sdd trace`, CLI `trace`, hooks `drift-lock.js` + `pre-commit.sh` | Heuristique git (5 types de drift) + mesure machine par matrice de traçabilité ; verdict OK / DRIFT / **INCONNU** ; hook Stop bloque la fin de session tant qu'un gap bloquant subsiste ; CI `--fail-on-gap` sur chaque PR |
| **Correction** | `/sdd fact`, CLI `archive` | FACT = écart livré/désiré qualifié (patch / nouvel Intent / MAJ SPEC / dette) ; proposition de spec-patch non auto-appliquée (> 20 lignes → Intent obligatoire) ; archivage explicite des artefacts done et FACTs résolus (anti dock rot, jamais silencieux) |
| **Audits** | `/sdd security`, `/sdd audit`, `/sdd context` | Sécurité 4 axes (OWASP, secrets, permissions agents, Tier 1) ; qualité 4 dimensions ; audit du Context Budget (métriques M1–M5, score 0-5/5) — rapports persistés sous `.aiad/metrics/` |

### 4.2 Traçabilité machine-vérifiable (v1.10, moteur `lib/sdd-trace.js`)

- 4 annotations code : `@intent` (0..1), `@spec` (1..n, obligatoire sur code applicatif), `@verified-by` (0..n), `@governance` (0..1) — en JSDoc, `//`, `#`, docstrings ; 20+ langages scannés ; exclusion `aiad-trace-ignore`.
- Matrices **Forward + Backward** Intent ↔ SPEC ↔ Code ↔ Tests ; gaps classés (orphelins / non-implémentés / non-tracés), bloquants qualifiés via git.
- Sorties : Markdown, JSON (`_meta` de provenance), HTML interactif, **SARIF 2.1.0** (GitHub Code Scanning, GitLab, SonarQube).
- Modes : `--watch`, `--suggest` (squelette EARS pour SPEC orpheline), `--fail-on-gap` (CI) ; cache incrémental mtime+size, scan parallèle worker_threads > 50 000 fichiers (~42 ms pour 1 000 fichiers).
- Exemption honnête : `traceability: exempt` + raison pour les SPECs sans code applicatif (fail-honest, INTENT-024).
- Dérivation verification-first : `suggest-tests` génère un squelette `node:test` depuis une SPEC EARS (INTENT-019).

### 4.3 Gouvernance réglementaire Tier 1 (différenciateur n°1)

- **5 référentiels** : AI-ACT (EU 2024/1689), RGPD, RGAA 4.1/WCAG 2.1, RGESN, + CRA — sources complètes dans `.aiad/gouvernance/` avec hiérarchie de priorité et politique d'incertitude (`UNKNOWN = VETO`, anti « auto-blanchiment »).
- **3 couches d'application** : ① subagents read-only (Read/Grep/Glob, jamais Edit/Write/Bash) déclenchés proactivement par `paths:`, verdict CONFORME / NON-CONFORME / UNKNOWN avec evidence `fichier:ligne` ; ② règles advisory en pull (`.claude/rules/*.md` scopées par chemins, INTENT-005) ; ③ **enforcement mécanique** : hook `veto.js` (PreToolUse sur `git commit`) refuse tout diff en zone réglementée sans `@governance` — non-bypassable, avec garde anti-régression testée.
- **36 packs de gouvernance** régionaux/sectoriels scaffoldés (fr-anssi, de-bsi, uk/us/latam/apac-baseline, eu-financial DORA/MiCA/PSD2, ISO-42001, HIPAA, SOC2…) + packs signés SHA-256 + marketplace de packs verticaux premium (santé, auto, aéro, industriel) + `gouvernance lint` (contradictions inter-agents).
- **Politique org opposable** : `managed-settings.json` (deny Edit/Write sur la gouvernance, hard_deny `git commit --no-verify` / `push --force`), `org.yml` vérifié par doctor, RBAC léger owner+reviewers.

### 4.4 Garde-fou JNSP (concept produit transverse)

- Forme texte (`JNSP — connu / manque / question à l'humain`), forme code (`// TODO-JNSP:` bloqué au commit par `jnsp-scan.js` + pre-commit), exit code CLI normalisé `2`.
- Déclinaisons : Gate `INCONNUE`, drift `INCONNU`, gouvernance `UNKNOWN = VETO`, budget `?/5`, authorship JNSP (= succès de détection, pas échec).
- Rappelé à chaque session (hook SessionStart ≤ 300 tokens) et dans tous les headers émis multi-runtime.

### 4.5 Rituels et métriques d'équipe (`/aiad`)

- **5 synchronisations** : sync-strat (mensuelle 1h30), demo (hebdo 30-45 min), tech-review (mensuelle 1h), standup (quotidien 15 min, persisté), retro (Lessons Learned agent + Human Learnings humain → AGENT-GUIDE) + **Atelier d'Intention** mensuel (espace humain pur).
- **Métriques** : DORA (4 métriques + niveaux Élite→Faible, enregistrement automatisé post-deploy `dora --record` / `--import-git`), Flow (Cycle/Lead Time, Throughput, WIP, Flow Efficiency, loi de Little), dashboard ASCII (rituel) et HTML (continu), `standup --lens pm|pe|ae|qa|tl` (URLs kanban par rôle).
- **Monitoring** : `/aiad status` (maturité X/5 + 3 prochaines actions), `/aiad health` (obsolescence, orphelins), `/aiad gouvernance` (conformité 5 référentiels), `/aiad onboard` (briefing contextualisé), `brief` (one-pager CI avec seuils stricts), `badge` (SVG shields santé/maturité/violations).

### 4.6 Dashboard HTML multi-personas (~170 modules `lib/dashboard/`)

- Pages hub : Vue d'ensemble, **Aujourd'hui** (radiateur ≤ 4 sections, pattern Linear), **Inbox** (triage facts/drifts), Kanban role-aware, intents, specs, traceability, drifts & facts, graphe de connaissances, ADRs, changelog, governance, metrics, **eco** (EcoLogits).
- Pages personas : cockpit **PM** (~140 widgets : outcomes ↔ Intents, EBM 4 aires, investment balance, hill charts, Impact×Effort, RICE, OKR, capacity planner, hypothèses), QA, SRE/Ops, DPO, Legal, onboarding.
- Pages détail générées par Intent et par SPEC ; `data.json` v2 (schema_version + JSON Schema publié, ~60 clés) pour consumers CI ; badges SVG, PWA manifest, CSP, sitemap, mode print, `--serve`/`--watch`/`--check`/`--public-url`.
- Score santé /100 avec historique, score maturité, métriques leadership EU (humanAuthorshipRatio, governanceCoverage, traceCompleteness), dette JNSP, violations Tier 1.

### 4.7 Conformité et souveraineté EU outillées (CLI)

| Capacité | Commande |
|---|---|
| Documentation Annexe IV AI Act pré-remplie | `ai-act audit` |
| AIPD Article 35 RGPD (méthode CNIL) | `dpia` |
| SBOM CycloneDX v1.5 (CRA) | `sbom` |
| Scan PII 14 détecteurs (IBAN, NIR, cartes, tokens…) sur artefacts, mode pre-commit | `pii-scan` |
| Anonymisation (hash, k-anonymity, bruit Laplace) | `anonymize` |
| Audit trail append-only signé HMAC-SHA256 chaîné par hash | `audit log\|verify\|append` |
| Attestation SLSA Provenance v1.0 + Sigstore/Rekor | `provenance` |
| Builds reproductibles (content-hash tarball) | `verify-reproducibility` |
| Backup chiffré AES-256-GCM (rétention RGPD art. 30) | `backup` / `restore` |
| Score EU Sovereignty (5 dimensions, Bronze→Platinum, publié en commentaire de PR) | `sovereignty` |
| Kit adoption État FR (publiccode.yml, code.gouv.fr) | `dinum` |
| Matrice SLA support/sécurité | `sla` |
| Mode air-gapped (blocage + journal HTTP non-local) | `offline`, `AIAD_OFFLINE=1` |
| Certification Product Engineer (5 niveaux × 6 axes, badge JWS) | `cert` |

### 4.8 Multi-runtime et synchronisation documentaire

- `emit-rules` : source unique `.aiad/AGENT-GUIDE.md` + gouvernance + Intent actif → **AGENTS.md, header CLAUDE.md, .cursor/rules/*.mdc (règles Tier 1 scopées par globs), .codex/AGENT.md, GEMINI.md, Copilot, .kiro/** ; idempotence par `source-hash` ; `--check` bloquant en CI.
- `docs --check` (DOCUMENTATION.md régénérée), `version-sync --check` (zones sentinelles `<!--VERSION:START/END-->`), `schema` (OpenAPI 3.1 des ~100 routes `--json`), `storybook` (catalogue HTML des commandes slash), `skills validate`, `commands --tier`, `guardrails` (matrice enforced/advisory).

### 4.9 Fiabilité du cycle agent (v1.18)

- **Suite canary** : cas figés rejoués (CI nocturne 03:17 UTC) contre baseline pour distinguer régression réelle du bruit de serving LLM (±8-14 %), verdicts PASS/DRIFT/FAIL/JNSP.
- **Mémoire « from logs »** : promotion vers `.aiad/memory/MEMORY.md` uniquement sur récurrence ≥ seuil multi-sources et **auteur humain obligatoire** ; auto-curation au-delà d'un plafond.
- **StatusLine native** : SPEC active + état Gate + étape de cycle + % contexte, en continu.
- **Observabilité** : OTel opt-in, mesure d'usage réel des skills (`skill-usage.jsonl`, sobriété : retirer l'inutilisé), métriques santé des hooks (latence p50/p95, timeouts), empreinte tokens par artefact (`footprint`, `track`).
- **Auto-chaining conditionnel** (INTENT-031) : enchaînement automatique des étapes algorithmiquement déterminables (`auto_chain` dans config.yml), en préservant les 2 décisions humaines non-délégables (GO/NO-GO, gate→exec) ; cible ≤ 2 interruptions par cycle (vs 5-7).
- **Garde-fous de conception** (INTENT-012) : proportionnalité (`proportionality` — chemin court vs lourd selon le poids de l'Intent), gate humain interactif `grill-me`, règles à durée de vie limitée (`sunset` — frontmatter `sunset_when`/`review_at`).
- **EcoLogits** (INTENT-030) : estimation kgCO₂eq locale hors-ligne par session/commande (mix EU 2024), badge dans validate, page eco du dashboard — objectif −10 % d'impact d'un cycle en 6 mois, posture anti-greenwashing (estimation indicative).

### 4.10 Écosystème et intégrations

- **Forges** : connecteurs GitLab (MR/issue/wiki), Azure DevOps (PR/work-item/wiki), Bitbucket Cloud+Server — tous avec `--dry-run` ; GitHub App (`github-app install|setup`, substitut pragmatique : workflow `aiad-pr-review.yml` commente chaque PR avec review + score souveraineté + verdict trace) ; `review <branch>` (diff Intent/SPEC + agents Tier 1 à re-consulter) ; `ci-template` pour 6 forges ; 10 webhooks signés HMAC.
- **Exports** : OpenAPI depuis SPECs `api: true`, Confluence Cloud, vault Obsidian (wiki-links + MOC).
- **Imports/migration** : `import --from spec-kit|kiro|auto` (conversion concurrents → `.aiad/`), `migrate` (M1-M5 idempotentes), `migrate-v2` (squelette v1→v2 avec rollback).
- **Starters** : `new node-aiad|fastapi-aiad` (projets clés-en-main AIAD préinstallé) ; plugins tiers (`plugin install`, manifest `aiad-plugin.json`) ; `workspace` multi-projets (5-50, doctor/trace/analytics agrégés).
- **Onboarding** : `tour` (5 étapes), `tutorial` (4 domaines), `repl` interactif, complétion bash/zsh/fish, aide par commande, « did you mean » Levenshtein, profil `--minimal` AIAD-Lean (4 commandes, < 1k tokens), upgrade incrémental (`init --upgrade`).
- **Extension VS Code** : arbres Intents/SPECs, CodeLens « Aller à la SPEC » (9+ langages), 12 commandes (doctor, trace, dashboard --serve, SBOM, AIPD, audit AI Act…), snippets, validation frontmatter à la sauvegarde, `autoTraceOnSave`.
- **Site aiad.ovh** : bilingue FR/EN statique zéro framework, 11 articles concepts, pages commandes/gouvernance/équipe/valeurs/métriques/glossaire/recherche, comparatif concurrentiel honnête, gate accessibilité pa11y WCAG2AA + budgets de poids RGESN en CI.

---

## 5. Exigences non fonctionnelles (observées et testées)

| Exigence | Mécanisme de garantie |
|---|---|
| **Zero-dépendance npm runtime** | `lint-deps.js` bloquant en CI (`dependencies` vide) ; scripts qualité maison (lint, coverage, mutation testing 6 opérateurs ≥ 70 %) |
| **Performance** | cold-start CLI ~41 ms, init ~54 ms, trace 1k fichiers ~42 ms, doctor ~39 ms (bench publiés) ; budgets LOC par module (`lint-size --strict`) |
| **Qualité** | ~280 fichiers de tests (540+ tests), couverture bloquante lines ≥ 75 % / branches ≥ 70 % / funcs ≥ 65 %, mutation nightly, smoke test < 2 s |
| **Portabilité** | Node ≥ 18 et Bun ≥ 1.2 (matrice de parité ~23-30 commandes en CI), ESM pur (`lint-esm`) |
| **Sécurité supply chain** | `npm publish --provenance`, attestation SLSA, hygiène tarball vérifiée, hooks sandboxés (timeout, réseau coupé, fail-open sauf veto) |
| **i18n** | messages CLI FR (défaut) / EN (`--lang en`, `AIAD_LANG`) ; site et dashboard bilingues ; artefacts en français |
| **Accessibilité / écoconception** | RGAA AA gaté par pa11y-ci (57 pages, allowlist vide), budgets de poids par page, design system dashboard axe-core |
| **Context engineering** | seuil opérationnel 60-70 % (autocompact à 65 %), injection SessionStart ≤ 300 tokens, routers = corps chargés à la demande (−94 % de frontmatter à froid), budget exec ≈ 50K tokens |

---

## 6. Outcome Criteria (repris du PRD humain + Intents)

| Critère | Baseline | Cible |
|---|---|---|
| Temps d'onboarding | non mesuré | < 4 h |
| Trafic aiad.ovh | 14 vues/jour | 1 000 vues/jour |
| Intents issus du feedback utilisateurs | 0/mois | 5/mois |
| Interruptions manuelles par cycle SDD (INTENT-031) | 5-7 | ≤ 2 |
| Impact CO₂ d'un cycle SDD (INTENT-030) | mesuré via EcoLogits | −10 % en 6 mois |
| Déploiements tracés automatiquement DORA (INTENT-027) | 0 % | 100 % |
| Drift de version sur les surfaces publiques (INTENT-013) | multiple | 0 (gaté en CI) |

---

## 7. Trajectoire produit (rétro-ingénierie du CHANGELOG)

| Palier | Versions | Contenu |
|---|---|---|
| Socle cycle + outillage | v1.6–v1.13 | Cycle SDD, hooks Drift Lock, routers (−94 % cold-start), profil minimal, skills DRY, traçabilité machine (v1.10), EARS (v1.11), multi-runtime emit-rules (v1.12), dashboard HTML (v1.13) |
| Leader EU | v1.14 | doctor, audit AI Act, AIPD, SBOM, packs signés, REPL, migrate, télémétrie opt-in, SARIF, extension VS Code, i18n |
| Dashboards personas | v1.15–v1.17 | Cockpit PM ~140 widgets, Kanban role-aware, `/sdd prd`/`arch`, feedback qualitatif |
| Advisory → Enforced | v1.18 | Verdicts déterministes exit 0/1/2, hooks bloquants (JNSP, veto fail-closed, Drift Lock au Stop), phase Research, exécution phasée + mini-gates, gouvernance en pull, memory from logs, cycle en graphe, canary, cross-model review, plugin + /goal, doctrine garde-fous |
| Dogfooding & honnêteté | v1.19 | Site publié + version-sync CI, gates qualité bloquants, claims sourcés, registre + dépréciation, exemption trace, dashboard v2 (Aujourd'hui/Inbox/EBM), gate RGAA, EcoLogits, suggest-tests, DORA automatisé, runtime Kiro, auto-chaining |

**Roadmap implicite** (Atelier 2026-06 + backlog) : PRD formel avec Outcome Criteria d'usage réel (juillet 2026 — décision n°1 de l'atelier) ; élagage de la longue traîne CLI à la v2 (dépréciations INTENT-015) ; suivi −10 % CO₂ à 6 mois ; extension runtimes selon la demande ; vagues backlog restantes : mode live + onboarding guidé, packs gouvernance IT/NL/BE, self-update, migration v2, plugins Obsidian/JetBrains.

---

## 8. Annexe — traçabilité PRD ↔ Intents

| Thème produit | Intents sources |
|---|---|
| Enforcement harness (verdicts, hooks, veto, graphe, exemptions) | INTENT-002, 003, 004, 008, 024, 031 |
| Sobriété (pull, noyau CLI, empreinte tokens, CO₂) | INTENT-005, 015, 021, 030 |
| Fiabilité agent (canary, memory, observabilité, cross-model) | INTENT-006, 007, 009, 010 |
| Distribution & adoption (plugin, /goal, toggles, feedback) | INTENT-001, 011 |
| Doctrine garde-fous (proportionnalité, grill-me, sunset) | INTENT-012 |
| Dogfooding & exemplarité (zéro drift, gates actifs, CLI sous SPEC, dashboard RGAA) | INTENT-013, 014, 016, 022, 025, 028 |
| Pilotage par la valeur (radiateur quotidien, EBM/outcomes, DORA/Flow auto) | INTENT-017, 018, 027 |
| Verification-first & spec-anchored | INTENT-019, 020 |
| Rayonnement honnête (comparatif, runtimes Kiro/Amazon Q) | INTENT-023 |
| Hygiène des artefacts (archivage auto) | INTENT-026, 029 |
| Ergonomie agent (/model actionnable) | INTENT-032 |

*Écarts de cohérence relevés pendant la rétro-ingénierie (candidats FACT) : le CLAUDE.md racine annonce « 27 commandes » et « 4 agents Tier 1 » alors que le runtime compte 17 + 16 sous-commandes et 5 référentiels (CRA ajouté) ; le CHANGELOG détaillé commence à v1.6 (v1.0–1.5 non documentées).*
