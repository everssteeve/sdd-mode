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

```bash
# Initialisation complète (structure + gouvernance + commandes Claude Code)
npx aiad-sdd init

# Sans les agents de gouvernance
npx aiad-sdd init --sans-gouvernance

# Mettre à jour les agents de gouvernance
npx aiad-sdd gouvernance

# Voir l'état du projet
npx aiad-sdd status
```

## Ce qui est installé

### Structure `.aiad/`

```
.aiad/
├── PRD.md                  ← Vision produit (template)
├── ARCHITECTURE.md         ← Standards techniques (template)
├── AGENT-GUIDE.md          ← Contexte permanent agent (template)
├── gouvernance/            ← Agents Tier 1 (droit de veto)
│   ├── AIAD-AI-ACT.md    ← Conformité EU AI Act
│   ├── AIAD-RGPD.md      ← Privacy by Design, RGPD
│   ├── AIAD-RGAA.md      ← Accessibilité RGAA 4.1 / WCAG 2.1
│   └── AIAD-RGESN.md     ← Écoconception numérique
├── intents/                ← Intent Statements
│   └── _index.md
├── specs/                  ← SPECs techniques
│   └── _index.md
└── CHANGELOG-ARTEFACTS.md  ← Historique des mises à jour
```

### Commandes Claude Code

**Cycle SDD (10 commandes) :**

| Commande | Phase | Description |
|----------|-------|-------------|
| `/sdd-init` | Cadrage | Initialiser PRD + ARCHITECTURE + AGENT-GUIDE |
| `/sdd-intent` | Intention | Capturer un Intent Statement (POURQUOI) |
| `/sdd-spec` | Spécification | Rédiger une SPEC depuis un Intent |
| `/sdd-gate` | Validation | Execution Gate + SQS + plan de remédiation |
| `/sdd-exec` | Exécution | Lancer l'agent avec contexte optimisé (post-Gate) |
| `/sdd-validate` | Validation | Valider le code produit par l'agent |
| `/sdd-drift-check` | Intégration | Vérifier synchronisation artefacts/code |
| `/sdd-split` | Spécification | Découper une SPEC trop volumineuse |
| `/sdd-resume` | Exécution | Reprendre une session agent interrompue |
| `/sdd-context` | Amélioration | Auditer le budget de contexte (estimation vs. réel) |

**Framework AIAD — Synchronisations & Rituels (11 commandes) :**

| Commande | Phase | Description |
|----------|-------|-------------|
| `/aiad-init` | Adoption | Bootstrapper AIAD sur un projet existant |
| `/aiad-onboard` | Adoption | Générer un briefing d'onboarding nouveau membre |
| `/aiad-gouvernance` | Gouvernance | Vérifier la conformité Tier 1 (AI-ACT, RGPD, RGAA, RGESN) |
| `/aiad-health` | Monitoring | Diagnostiquer la santé des artefacts |
| `/aiad-status` | Monitoring | État du projet SDD |
| `/aiad-retro` | Amélioration | Rétrospective + signaux d'évolution |
| `/aiad-intention` | Alignement | Atelier d'Intention (rituel mensuel, espace humain pur) |
| `/aiad-sync-strat` | Alignement | Synchronisation alignement stratégique (mensuelle, 1h30) |
| `/aiad-demo` | Feedback | Demo & Feedback (hebdomadaire, 45 min) |
| `/aiad-tech-review` | Technique | Tech Review (synchronisation technique hebdomadaire) |
| `/aiad-standup` | Monitoring | Standup quotidien AIAD (état, blockers, intentions du jour) |

**Métriques & Dashboards AIAD (3 commandes) :**

| Commande | Phase | Description |
|----------|-------|-------------|
| `/aiad-dashboard` | Métriques | Dashboard de santé globale du projet AIAD |
| `/aiad-dora` | Métriques | DORA Metrics (Deployment Frequency, Lead Time, CFR, MTTR) |
| `/aiad-flow` | Métriques | Flow Metrics (Cycle Time, Lead Time, Throughput, WIP, Flow Efficiency) |

### CLAUDE.md

Un `CLAUDE.md` est créé (ou enrichi) avec le contexte SDD Mode complet : cycle de développement, hiérarchie documentaire, règles absolues, gouvernance.

## Cycle de développement

```
┌─────────────┐     ┌──────────┐     ┌──────────────┐
│  /sdd-intent │────▶│ /sdd-spec │────▶│  /sdd-gate   │
│  Intention   │     │  SPEC    │     │  SQS ≥ 4/5   │
└─────────────┘     └────┬─────┘     └──────┬───────┘
                         │                    │
                    /sdd-split           /sdd-exec
                   (si atomicité        (contexte
                    insuffisante)        optimisé)
                                             │
     ┌───────────────────────────────────────┘
     ▼
┌──────────────┐     ┌──────────────┐     ┌────────────────┐
│  /sdd-exec   │────▶│ /sdd-validate│────▶│/sdd-drift-check│
│  Agent IA    │     │  Validation  │     │  Drift Lock    │
└──────┬───────┘     └──────────────┘     └────────────────┘
       │
  /sdd-resume                              /sdd-context
 (si session                              (audit post-
  interrompue)                             session)
```

## Démarrage rapide

```bash
# 1. Initialiser SDD Mode
npx aiad-sdd init

# 2. Dans Claude Code, lancer le cadrage (nouveau projet)
/sdd-init
# OU bootstrapper sur un projet existant
/aiad-init

# 3. Capturer la première intention
/sdd-intent

# 4. Rédiger la première SPEC
/sdd-spec
# Si la SPEC est trop grosse → /sdd-split

# 5. Valider la SPEC (Execution Gate)
/sdd-gate

# 6. Lancer l'agent avec contexte optimisé
/sdd-exec
# Si la session est interrompue → /sdd-resume

# 7. Valider et verrouiller
/sdd-validate
/sdd-drift-check

# 8. Auditer le budget de contexte (optionnel, recommandé)
/sdd-context
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
- **24 commandes** : 10 SDD Mode + 11 synchronisations & rituels AIAD + 3 métriques

## Licence

MIT — Steeve Evers — [aiad.ovh](https://aiad.ovh)
