---
layout: default
title: Comparaison — aiad-sdd vs Spec Kit, Kiro, Cursor Memory Bank
lang: fr-FR
---

# Comparaison

> Honnête, technique, datée. Cette page te dit **quand AIAD est meilleur** et **quand un autre framework l'est** — c'est la seule façon de t'aider à choisir avec lucidité.

**Mise à jour** : 2026-05-10. Pour signaler une inexactitude : [issue GitHub](https://github.com/everssteeve/sdd-mode/issues).

---

## Synthèse

| Capacité | aiad-sdd | [Spec Kit](https://github.com/github/spec-kit) | [AWS Kiro](https://kiro.dev/) | [Cursor Memory Bank](https://docs.cursor.com/context/memory-bank) |
|----------|:---:|:---:|:---:|:---:|
| **Cycle Intent → SPEC → Gate → Drift Lock** | ✅ formalisé | ⚠️ partiel (specify→plan) | ⚠️ partiel (steering→spec) | ❌ pas de cycle |
| **Cardinalité Intent / SPEC / code distincte** | ✅ 3 couches | 2 couches | 2 couches | 1 couche |
| **Spec Quality Score (SQS)** | ✅ 5 critères + Test de l'Étranger | ❌ | ❌ | ❌ |
| **Drift Lock mécanique (pre-commit + matrice)** | ✅ | ❌ | ❌ | ❌ |
| **Annotations machine-vérifiables (`@spec`, `@verified-by`)** | ✅ | ❌ | ❌ | ❌ |
| **Sortie SARIF v2.1.0 (GitHub Code Scanning)** | ✅ | ❌ | ❌ | ❌ |
| **Multi-runtime (Claude / Cursor / Codex / Gemini / Copilot)** | ✅ source amont unique | ⚠️ Claude Code-centré | ⚠️ Kiro IDE | ❌ Cursor-only |
| **Gouvernance EU Tier 1 native (AI-ACT, RGPD, RGAA, RGESN)** | ✅ avec droit de veto | ❌ | ❌ | ❌ |
| **Packs gouvernance multi-juridictions (US SOC 2/HIPAA, UK DPA)** | ✅ 3 packs | ❌ | ❌ | ❌ |
| **Documentation utilisateur auto-synchrone (CI parity)** | ✅ | ❌ | ❌ | ❌ |
| **Multi-language traçabilité (TS/JS/Python aujourd'hui)** | ✅ | langage agent | langage agent | n/a |
| **Zero runtime dependency** | ✅ | ❌ Python + deps | ❌ AWS-side | propriétaire |
| **Open source** | ✅ MIT | ✅ MIT | ⚠️ partiel | ❌ |
| **Langue française par défaut** | ✅ | ❌ EN | ❌ EN | ❌ EN |

---

## Spec Kit (GitHub)

> Repository : [github/spec-kit](https://github.com/github/spec-kit). Maturité : alpha.

### Forces réelles

- **Backé par GitHub**, intégration native avec l'écosystème (Issues, PRs, Actions).
- Approche **specify → plan → tasks → implement** très lisible pour qui débute le SDD.
- Bonne UX terminal Python (`uvx`).

### Limites face à AIAD

- **Pas de Drift Lock**. Une fois la SPEC écrite, rien n'empêche le code de diverger silencieusement. AIAD impose `pre-commit` + matrice machine-vérifiable.
- **Pas d'Intent Statement séparé**. Le « pourquoi » et le « comment » sont mélangés dans la SPEC. AIAD garde la couche Intent comme **espace humain pur** (cf. principe Human Authorship).
- **Pas de gouvernance réglementaire**. Pour un projet EU touché par AI-ACT / RGPD / RGAA, tout est à reconstruire à la main.
- **Spec-Kit est Claude Code-centré**. AIAD émet `AGENTS.md` + `.cursor/rules/` + `.codex/AGENT.md` + `GEMINI.md` depuis une source amont unique.
- **Pas de SQS** : aucun critère qualité formel pour décider qu'une SPEC est prête à exécuter.

### Quand préférer Spec Kit

- Si ton équipe est 100 % GitHub native et veut une intégration tickets/PR poussée hors-cadre (juste le développement).
- Si tu démarres et veux le **moins de cérémonial possible**, sans gouvernance.

### Migrer Spec Kit → aiad-sdd

```bash
# Tes specs Spec Kit deviennent des SPECs AIAD :
mv specs/*.md .aiad/specs/
# Crée les Intent rétroactivement :
npx aiad-sdd init && /sdd intent  # dans Claude Code
```

---

## AWS Kiro

> [kiro.dev](https://kiro.dev/). Approche Spec Driven Development d'AWS.

### Forces réelles

- **IDE intégré** très soigné (VS Code fork).
- Les fichiers `steering` (équivalent AGENT-GUIDE) sont propres.
- Bonne UX pour des équipes AWS-native.

### Limites face à AIAD

- **Verrouillage IDE** : Kiro fonctionne dans Kiro. AIAD est CLI + multi-runtime — l'équipe garde son éditeur.
- **Pas d'Intent Statement** comme couche distincte de la SPEC.
- **Pas de matrice de traçabilité machine-vérifiable**. Aucune alerte automatique si une SPEC validée n'est jamais implémentée.
- **Pas de gouvernance réglementaire EU**.
- **Pas open source côté serveur** ; lock-in AWS.
- **Pas de version française**.

### Quand préférer Kiro

- Équipes AWS-natives qui veulent un éditeur dédié et acceptent le lock-in.
- Ne s'applique pas aux contraintes RGPD strictes (hébergement extra-EU possible).

### Migrer Kiro → aiad-sdd

```bash
# .kiro/ → .aiad/ (les steering deviennent l'AGENT-GUIDE)
mv .kiro/steering/product.md .aiad/PRD.md
mv .kiro/steering/tech.md .aiad/ARCHITECTURE.md
mv .kiro/steering/structure.md .aiad/AGENT-GUIDE.md
mv .kiro/specs/*.md .aiad/specs/
npx aiad-sdd init  # crée les indices, gouvernance, etc.
```

---

## Cursor Memory Bank

> Pattern communautaire largement adopté dans Cursor (`.cursor/rules/*.mdc`).

### Forces réelles

- **Léger et immédiat** — quelques fichiers Markdown suffisent.
- Tight coupling avec Cursor : excellent UX si tu vis dans Cursor.

### Limites face à AIAD

- **Pas un cycle de développement**. Memory Bank décrit le **contexte**, pas le **processus**.
- **Pas de séparation Intent / SPEC**. C'est une fonctionnalité différente, pas un concurrent direct du SDD.
- **Cursor-only**.
- **Pas de gouvernance**, pas de Drift Lock, pas de traçabilité machine-vérifiable.

### Quand utiliser les deux

C'est compatible. AIAD émet `.cursor/rules/aiad.mdc` qui se substitue (ou complète) Memory Bank :

```bash
npx aiad-sdd init --runtime cursor  # ou --runtime all
```

`aiad.mdc` est `alwaysApply: true`, `aiad-rgpd.mdc` / `aiad-rgaa.mdc` etc. sont scopés via `globs`.

---

## Critères de choix

Pour t'aider à décider en 30 secondes :

| Si ton besoin est… | Choisis… |
|---|---|
| Cycle SDD complet avec gouvernance EU | **aiad-sdd** |
| Conformité AI-ACT / RGPD / RGAA / RGESN native | **aiad-sdd** |
| Multi-runtime IA (l'équipe utilise plusieurs outils) | **aiad-sdd** |
| Documentation toujours à jour automatiquement | **aiad-sdd** |
| Traçabilité machine-vérifiable + alerts CI | **aiad-sdd** |
| Démarrage minimal Spec-First sans cycle complet | **Spec Kit** |
| IDE dédié AWS-native | **Kiro** |
| Juste enrichir le contexte Cursor | **Cursor Memory Bank** |

---

## Compatibilité

aiad-sdd est conçu pour **cohabiter** avec ces outils. Tu peux installer aiad-sdd sur un projet Spec Kit existant — les fichiers ne se marchent pas dessus (`specs/` vs `.aiad/specs/`).

```bash
# Audit de l'état avant migration
npx aiad-sdd doctor
```

---

*Cette page sera mise à jour au fil des releases des concurrents. Pour proposer une correction : [issue GitHub](https://github.com/everssteeve/sdd-mode/issues).*
