---
layout: default
title: aiad-sdd — Spec Driven Development pour Claude Code
lang: fr-FR
---

# aiad-sdd

> **Le framework leader européen de développement basé sur l'intention.**
> Spec Driven Development pour Claude Code, Cursor, Codex, Copilot, Gemini —
> en langue française par défaut, gouvernance EU Tier 1 native.

[![CI](https://github.com/everssteeve/sdd-mode/actions/workflows/ci.yml/badge.svg)](https://github.com/everssteeve/sdd-mode/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/aiad-sdd.svg)](https://www.npmjs.com/package/aiad-sdd)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## En 3 lignes

```bash
npx aiad-sdd init           # bootstrap d'un projet AIAD complet
npx aiad-sdd doctor         # diagnostic unifié
npx aiad-sdd docs --check   # CI parity check de la doc utilisateur
```

## Pourquoi `aiad-sdd` ?

Les frameworks d'agents IA actuels (Spec Kit, Kiro, Memory Bank) automatisent le **comment**. AIAD remet l'**intention humaine** au centre :

1. **Spec as Living Invariant** — la SPEC reste la source de vérité entre intention et code.
2. **Drift = Échec de processus** — code et SPEC toujours synchronisés (mécaniquement, pas humainement).
3. **Context Engineering Budget** — l'humain gère le budget de contexte de chaque session agent.

## Différenciateurs leadership EU/FR

| Capacité | aiad-sdd | Spec Kit | Kiro | Cursor MB |
|----------|:---:|:---:|:---:|:---:|
| Cycle Intent → SPEC → Gate → Drift Lock | ✅ | partiel | partiel | ❌ |
| Gouvernance EU Tier 1 native (AI-ACT, RGPD, RGAA, RGESN) | ✅ | ❌ | ❌ | ❌ |
| Multi-runtime (Claude / Cursor / Codex / Gemini / Copilot) | ✅ | partiel | ❌ | spécifique |
| Traçabilité machine-vérifiable (matrice + SARIF) | ✅ | ❌ | ❌ | ❌ |
| Documentation auto-synchrone (CI parity check) | ✅ | ❌ | ❌ | ❌ |
| Zero runtime dependency | ✅ | ❌ | ❌ | ❌ |
| Langue française par défaut | ✅ | ❌ | ❌ | ❌ |
| Packs gouvernance multi-juridictions | ✅ EU/US/UK | ❌ | ❌ | ❌ |

## Documentation

- 📘 **[Documentation utilisateur](./DOCUMENTATION.html)** — référence complète des commandes CLI, slash commands, skills, gouvernance, annotations. **Auto-générée**, toujours synchrone.
- 🏗️ **[Architecture interne](./architecture.html)** — vue d'ensemble pour les contributeurs.
- 📜 **[Changelog](https://github.com/everssteeve/sdd-mode/blob/main/CHANGELOG.md)** — historique des versions.
- 🤝 **[Contribuer](https://github.com/everssteeve/sdd-mode/blob/main/CONTRIBUTING.md)** — guide complet (mise en place, conventions, ajout de pack gouvernance).

## Démarrer

```bash
# Profil minimal — 4 commandes essentielles, ~793 tokens cold-start
npx aiad-sdd init --minimal

# Profil complet — 27 commandes + gouvernance + skills + workflows CI
npx aiad-sdd init

# Multi-runtime (Cursor + Codex + Gemini + Copilot)
npx aiad-sdd init --runtime all

# Pack gouvernance US (SOC 2 / HIPAA / ADA / NIST AI RMF)
npx aiad-sdd init && npx aiad-sdd gouvernance --pack us-baseline
```

## Communauté & support

- **Site officiel** : [aiad.ovh](https://aiad.ovh)
- **Issues / discussions** : [GitHub](https://github.com/everssteeve/sdd-mode)
- **npm** : [aiad-sdd](https://www.npmjs.com/package/aiad-sdd)

---

*Framework AIAD — Artificial Intelligence Agent Development. Open Source MIT — Steeve Evers.*
