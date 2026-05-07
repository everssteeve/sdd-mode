# aiad-sdd

**Spec Driven Development pour Claude Code** — Framework de développement spec-anchored avec agents IA.

```bash
npx aiad-sdd init
```

---

## Qu'est-ce que SDD Mode ?

SDD Mode (Spec Driven Development Mode) est le framework de développement d'[AIAD](https://aiad.ovh). Il définit comment les équipes transforment des intentions produit en code de qualité en faisant des SPECs le pivot entre l'humain et l'agent IA.

**3 principes fondateurs :**

1. **Spec as Living Invariant** — La SPEC reste la source de vérité entre intention et code
2. **Drift = Échec de processus** — Code et SPEC toujours synchronisés
3. **Context Engineering Budget** — Le PE gère le budget de contexte de chaque session agent

## Installation

**Démarre minimal, évolue progressivement** — choisis ton profil selon le besoin.

```bash
# Profil minimal (AIAD-Lean) — 4 commandes, ≤ 1k tokens cold-start
npx aiad-sdd init --minimal

# Profil complet (structure + gouvernance + 27 commandes Claude Code)
npx aiad-sdd init

# Sans les agents de gouvernance
npx aiad-sdd init --sans-gouvernance

# Multi-runtime (v1.12) — Claude Code + Cursor + Codex + Copilot + Gemini
npx aiad-sdd init --runtime all
npx aiad-sdd init --runtime cursor

# Mettre à jour les agents de gouvernance
npx aiad-sdd gouvernance

# Régénérer les fichiers de règles multi-runtime depuis l'AGENT-GUIDE
npx aiad-sdd emit-rules

# Voir l'état du projet
npx aiad-sdd status
```

### Profil minimal — 3 différenciateurs essentiels

Le profil `--minimal` installe uniquement les 3 fondations qui distinguent AIAD : **Intent Statement**, **SQS** (Spec Quality Score), **Drift Lock**.

```
.aiad/
├── AGENT-GUIDE.md      ← contexte permanent (sans gouvernance Tier 1)
├── intents/_index.md
└── specs/_index.md

.claude/commands/       ← 4 commandes seulement
├── sdd-intent.md       ← Capturer l'intention humaine (POURQUOI)
├── sdd-spec.md         ← Rédiger une SPEC depuis un Intent
├── sdd-gate.md         ← Valider la SPEC (SQS ≥ 4/5)
└── sdd-drift-check.md  ← Vérifier la synchro code/SPEC

CLAUDE.md               ← condensé (constitution AIAD 7 valeurs + cycle minimal)
```

Mesure : ~93 tokens de frontmatter + ~700 tokens de CLAUDE.md = **~793 tokens cold-start** (< 1 000).

### Évoluer à la demande

À tout moment, tu peux ajouter un module au profil minimal :

```bash
npx aiad-sdd init --upgrade gouvernance   # Agents Tier 1 (AI-ACT, RGPD, RGAA, RGESN)
npx aiad-sdd init --upgrade rituals       # standup, retro, demo, intention, sync-strat, …
npx aiad-sdd init --upgrade metrics       # dashboard, DORA, flow + commandes /sdd fact|security|audit|context
npx aiad-sdd init --upgrade all           # Bascule complète vers le profil 27 commandes
```

L'upgrade est **purement additif** — tes fichiers personnalisés (Intent Statements, SPECs, AGENT-GUIDE, CLAUDE.md) sont préservés. Ajoute `--force` pour resynchroniser tout.

## Ce qui est installé

### Structure `.aiad/`

```
.aiad/
├── PRD.md                  ← Vision produit (template)
├── ARCHITECTURE.md         ← Standards techniques (template)
├── AGENT-GUIDE.md          ← Contexte permanent agent (template)
├── gouvernance/            ← Agents Tier 1 (droit de veto)
│   ├── _index.md
│   ├── AIAD-AI-ACT.md    ← Conformité EU AI Act
│   ├── AIAD-RGPD.md      ← Privacy by Design, RGPD
│   ├── AIAD-RGAA.md      ← Accessibilité RGAA 4.1 / WCAG 2.1
│   └── AIAD-RGESN.md     ← Écoconception numérique
├── intents/                ← Intent Statements
│   └── _index.md
├── specs/                  ← SPECs techniques
│   └── _index.md
├── facts/                  ← Traces /sdd-fact
├── metrics/                ← Persistance des données métriques
│   ├── security/           ← Rapports /sdd-security
│   └── audit/              ← Rapports /sdd-audit
└── CHANGELOG-ARTEFACTS.md  ← Historique des mises à jour
```

### Commandes Claude Code

> **Nouveau en v1.7** — Les 27 commandes sont regroupées sous **3 routers** (`/sdd`, `/aiad`, `/aiad-help`). Les corps des sous-commandes sont chargés à la demande, pas dans le system prompt à froid (mesure : -94 % de frontmatter chargé une fois les alias rétro-compat retirés). Mesure-le toi-même : `npx aiad-sdd bench`.
>
> **Nouveau en v1.9** — 7 **skills réutilisables** auto-déclenchées factorisent la logique récurrente : `human-authorship-check`, `regulatory-veto`, `drift-detection`, `sqs-scoring`, `context-budget`, `reasons-canvas`, `ears-validator`. Les commandes SDD sont **plus courtes (-32 % de bytes cumulés)** et composables. Cf. `.claude/skills/`.
>
> **Nouveau en v1.11** — Variante **EARS optionnelle** pour les SPECs critiques (`/sdd spec --ears`). Linter strict R1–R7 (mots interdits, multi-SHALL, déclencheurs WHEN/WHILE/IF/WHERE, …), bonus +1 sur le SQS Testabilité si 0 violation. Cohabitation totale avec le format prose. Cf. `.aiad/specs/spec-ears-template.md`.
>
> **Nouveau en v1.12** — **Multi-runtime** via `/aiad emit-rules`. AIAD devient **source amont** : `.aiad/AGENT-GUIDE.md` + `.aiad/gouvernance/` génèrent `AGENTS.md`, `CLAUDE.md` (header), `.cursor/rules/*.mdc`, `.codex/AGENT.md`, `GEMINI.md`. Une seule modification → tous les runtimes alignés. Workflow CI `aiad-emit-rules-check.yml` bloque toute divergence. Cible explicite via `aiad-sdd init --runtime cursor|codex|copilot|gemini|all`.
>
> Les anciens alias plats (`/sdd-spec`, `/aiad-status`, …) restent fonctionnels pendant 1 version et seront retirés à la v2.

**Cycle SDD (13 sous-commandes) — `/sdd <sub>` :**

| Forme courante | Phase | Description |
|----------------|-------|-------------|
| `/sdd init` | Cadrage | Initialiser PRD + ARCHITECTURE + AGENT-GUIDE |
| `/sdd intent` | Intention | Capturer un Intent Statement (POURQUOI) |
| `/sdd spec` | Spécification | Rédiger une SPEC depuis un Intent |
| `/sdd gate` | Validation | Execution Gate + SQS + plan de remédiation |
| `/sdd exec` | Exécution | Lancer l'agent avec contexte optimisé (post-Gate) |
| `/sdd validate` | Validation | Valider le code produit par l'agent |
| `/sdd drift-check` | Intégration | Vérifier synchronisation artefacts/code |
| `/sdd split` | Spécification | Découper une SPEC trop volumineuse |
| `/sdd resume` | Exécution | Reprendre une session agent interrompue |
| `/sdd context` | Amélioration | Auditer le budget de contexte (estimation vs. réel) |
| `/sdd fact` | Correction | Capturer et qualifier un écart livré/désiré |
| `/sdd security` | Audit | Audit sécurité (OWASP, secrets, permissions agents) |
| `/sdd audit` | Audit | Audit qualité (conformité SPEC, dette technique) |

**Framework AIAD — Synchronisations & Rituels (11 sous-commandes) — `/aiad <sub>` :**

| Forme courante | Phase | Description |
|----------------|-------|-------------|
| `/aiad init` | Adoption | Bootstrapper AIAD sur un projet existant |
| `/aiad onboard` | Adoption | Générer un briefing d'onboarding nouveau membre |
| `/aiad gouvernance` | Gouvernance | Vérifier la conformité Tier 1 (AI-ACT, RGPD, RGAA, RGESN) |
| `/aiad health` | Monitoring | Diagnostiquer la santé des artefacts |
| `/aiad status` | Monitoring | État du projet SDD |
| `/aiad retro` | Amélioration | Rétrospective + signaux d'évolution |
| `/aiad intention` | Alignement | Atelier d'Intention (rituel mensuel, espace humain pur) |
| `/aiad sync-strat` | Alignement | Synchronisation alignement stratégique (mensuelle, 1h30) |
| `/aiad demo` | Feedback | Demo & Feedback (hebdomadaire, 45 min) |
| `/aiad tech-review` | Technique | Tech Review (synchronisation technique hebdomadaire) |
| `/aiad standup` | Monitoring | Standup quotidien AIAD (état, blockers, intentions du jour) |

**Métriques & Dashboards AIAD (3 sous-commandes) — `/aiad <sub>` :**

| Forme courante | Phase | Description |
|----------------|-------|-------------|
| `/aiad dashboard` | Métriques | Dashboard de santé globale du projet AIAD |
| `/aiad dora` | Métriques | DORA Metrics (Deployment Frequency, Lead Time, CFR, MTTR) |
| `/aiad flow` | Métriques | Flow Metrics (Cycle Time, Lead Time, Throughput, WIP, Flow Efficiency) |

**Multi-runtime (v1.12) — `/aiad <sub>` :**

| Forme courante | Phase | Description |
|----------------|-------|-------------|
| `/aiad emit-rules` | Adoption | Régénère `AGENTS.md`, `CLAUDE.md` (header), `.cursor/rules/`, `.codex/`, `GEMINI.md` depuis `.aiad/AGENT-GUIDE.md` |

**Aide :** `/aiad-help` — vue d'ensemble, parcours type, recherche d'une commande par mot-clé.

### Multi-runtime (v1.12)

AIAD se positionne en **source amont** : une seule modification dans `.aiad/AGENT-GUIDE.md` ou `.aiad/gouvernance/` propage automatiquement vers tous les runtimes IA.

```bash
# Régénération complète (Claude Code + Cursor + Codex + Copilot + Gemini)
npx aiad-sdd emit-rules

# Cible un runtime unique
npx aiad-sdd emit-rules --runtime cursor
npx aiad-sdd emit-rules --runtime cursor,codex

# Mode CI — exit 1 si divergence
npx aiad-sdd emit-rules --check

# Bootstrap projet avec runtime explicite
npx aiad-sdd init --runtime all
npx aiad-sdd init --runtime cursor
```

**Fichiers émis :**

| Fichier | Runtime | Mécanisme |
|---------|---------|-----------|
| `AGENTS.md` | Standard inter-outils + Copilot | Source canonique |
| `CLAUDE.md` (header) | Claude Code | Header de cohérence injecté entre sentinels |
| `.cursor/rules/aiad.mdc` | Cursor — règle principale | `alwaysApply: true` |
| `.cursor/rules/aiad-{rgpd,rgaa,ai-act,rgesn}.mdc` | Cursor — Tier 1 | Scopés via globs, `alwaysApply: false` |
| `.codex/AGENT.md` | OpenAI Codex | Optionnel |
| `GEMINI.md` | Google Gemini | Optionnel |

Chaque fichier émis porte un `source-hash` SHA-256 dans son frontmatter et le header `<!-- DO NOT EDIT — regenerate via /aiad-emit-rules -->`. Le workflow `aiad-emit-rules-check.yml` (déployé via `init --upgrade all`) bloque toute PR qui modifie l'AGENT-GUIDE sans régénérer les cibles, OU qui modifie manuellement un fichier dérivé.

### CLAUDE.md

Un `CLAUDE.md` est créé (ou enrichi) avec le contexte SDD Mode complet : cycle de développement, hiérarchie documentaire, règles absolues, gouvernance.

## Cycle de développement

```
┌──────────────┐     ┌────────────┐     ┌──────────────┐
│ /sdd intent  │────▶│ /sdd spec  │────▶│  /sdd gate   │
│  Intention   │     │   SPEC     │     │  SQS ≥ 4/5   │
└──────────────┘     └─────┬──────┘     └──────┬───────┘
                           │                    │
                     /sdd split            /sdd exec
                    (si atomicité         (contexte
                     insuffisante)         optimisé)
                                              │
     ┌────────────────────────────────────────┘
     ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  /sdd exec   │────▶│ /sdd validate│────▶│ /sdd drift-check │
│  Agent IA    │     │  Validation  │     │   Drift Lock     │
└──────┬───────┘     └──────────────┘     └──────────────────┘
       │
  /sdd resume                              /sdd context
 (si session                              (audit post-
  interrompue)                             session)
```

## Démarrage rapide

```bash
# 1. Initialiser SDD Mode
npx aiad-sdd init

# 2. Dans Claude Code, lancer le cadrage (nouveau projet)
/sdd init
# OU bootstrapper sur un projet existant
/aiad init

# 3. Capturer la première intention
/sdd intent

# 4. Rédiger la première SPEC
/sdd spec
# Si la SPEC est trop grosse → /sdd split

# 5. Valider la SPEC (Execution Gate)
/sdd gate

# 6. Lancer l'agent avec contexte optimisé
/sdd exec
# Si la session est interrompue → /sdd resume

# 7. Valider et verrouiller
/sdd validate
/sdd drift-check

# 8. Auditer le budget de contexte (optionnel, recommandé)
/sdd context
```

## Agents de gouvernance

Les 4 agents Tier 1 ont un **droit de veto** sur toute implémentation non conforme :

| Agent | Périmètre | Référentiel |
|-------|-----------|-------------|
| **AIAD-AI-ACT** | Composants IA | Règlement (UE) 2024/1689 |
| **AIAD-RGPD** | Données personnelles | RGPD + ePrivacy |
| **AIAD-RGAA** | Interfaces utilisateur | RGAA 4.1 / WCAG 2.1 |
| **AIAD-RGESN** | Écoconception | RGESN v2 |

## Compatibilité

SDD Mode est conçu pour Claude Code mais les artefacts sont compatibles avec :
- **Cursor** — `.aiad/AGENT-GUIDE.md` ↔ Memory Bank (`.cursor/rules`)
- **AWS Kiro** — `.aiad/` ↔ `.kiro/` (steering files)
- **GitHub Spec Kit** — `.aiad/specs/` ↔ Spec files

## Framework AIAD

AIAD (Artificial Intelligence Agent Development) est un framework open source pour le développement logiciel à l'ère des agents IA.

- **Site** : [aiad.ovh](https://aiad.ovh)
- **Constitution** : 7 valeurs fondatrices, gouvernance gardien/communauté
- **5 responsabilités** : PM, Product Engineer, Agents Engineer, QA Engineer, Tech Lead
- **27 commandes** (13 SDD + 11 rituels + 3 métriques), regroupées sous **3 routers** depuis la v1.7

## Licence

MIT — Steeve Evers — [aiad.ovh](https://aiad.ovh)
