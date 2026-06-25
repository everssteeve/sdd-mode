---
id: RESEARCH-031
intent: INTENT-031
author: Steeve Evers
date: 2026-06-25
status: done
---

# RESEARCH-031 — Chaînage automatique conditionnel + correctif hook Stop (← INTENT-031)

> Phase Research (§3.5) — entre l'Intent et la SPEC. Elle ne score PAS la qualité
> d'une SPEC (c'est le rôle du SQS) mais la **viabilité de l'intention**, ancrée
> dans le code réel. La Research informe ; **l'humain tranche le GO/NO-GO**.
> Verdict machine : `npx aiad-sdd research RESEARCH-031`.

---

## Discovery (ancrage code — agent Explore, read-only)

**Zone 1 — Hook Stop** (`lib/sdd-trace.js:560` cible principale) :

- `lib/sdd-trace.js:560` — filtre `['ready', 'validation', 'done']` pour `specsValideesNonImplementees` — inclut `ready` à tort (état normal pré-exec)
- `lib/sdd-trace.js:545` — `estExempte()` vérifie `traceability: exempt` + raison non vide — pattern réutilisable
- `lib/drift-verdict.js:37` — `compterGapsBloquants()` : `specsValideesNonImplementees` comptée comme gap bloquant
- `lib/drift-verdict.js:51` — `listerGaps()` → `kind: 'spec_validated_not_implemented'`, `blocking: true`
- `lib/hooks-config.js:30` — `TOGGLES` enum, `disableStopHook: ['drift-lock']` défini — ne couvre pas la détection de gap
- `test/drift-verdict.test.js:42` — test gap bloquant SPEC validée non implémentée (à adapter)

**Zone 2 — Moteur de chaînage** (LACUNE — aucun moteur n'existe) :

- `lib/command-hooks.js:1` — hooks `beforeCommand` / `afterCommand` génériques, non SDD-aware — point d'intégration retenu (C1)
- `test/command-hooks.test.js:1` — tests hooks utilisateur existants, pattern réutilisable

**Zone 3 — Paramètre `auto_chain`** :

- `.aiad/config.yml:1` — YAML statique, seules clés `hooks.pre_commit` + `canary.*` — clé `auto_chain` absente
- `templates/.aiad/config.yml:1` — source de vérité (même contenu, à étendre)
- `lib/hooks.js:43` — `ecrireConfigSiAbsente()` — copie template, ne valide pas schéma

---

## Faisabilité

**Zone 1 (hook Stop)** — Correctif chirurgical sur `lib/sdd-trace.js:560` :
remplacer `['ready', 'validation', 'done']` par `['validation', 'done']`.
Tests à mettre à jour : `test/trace.test.js` + `test/drift-verdict.test.js`.
Coût estimé : faible (1–2 fichiers, 1 PR).

**Zone 2 (moteur de chaînage)** — Nouveau module `lib/auto-chain.js` (zéro-dep).
La logique de conditions (SQS, budget contexte, gouvernance) est déjà disponible
via modules existants (`lib/sqs.js`, `lib/context-budget.js`, `lib/verdict.js`).
Branchement retenu (C1) : `afterCommand` dans `lib/command-hooks.js`.
Coût estimé : moyen (3–5 fichiers, 2 PRs).

**Zone 3 (config)** — Ajout de la clé `auto_chain` dans les templates YAML + parser
minimal. Risque de compatibilité descendante nul (clé absente = defaults hardcodés).
Coût estimé : faible (2 fichiers, 1 PR).

**Faisabilité globale** : GO sur les 3 zones avec l'architecture actuelle.
Aucune dépendance externe, aucune migration de données.

---

## Risques & inconnues

- **R1** : Exclure `ready` du gap hook Stop → faux-négatif "stuck-in-ready" accepté.
  On sacrifie la détection rare (SPEC `ready` depuis N jours sans exec) pour éliminer
  le faux-positif quotidien. Traçable via FACT si problème.

- **R2** : Point d'intégration du moteur de chaînage — tranché (C1) : `afterCommand` dans
  `lib/command-hooks.js`. Moins de fichiers impactés que l'intégration directe dans `.claude/sdd/`.

- **R3** : Budget tokens — `lib/context-budget.js` retourne une estimation statique.
  Acceptable pour v1 : le chaînage s'appuie sur `max_context_pct` (config) sans lecture dynamique.

- **R4** : Compatibilité `.aiad/config.yml` existant — défaut hardcodé `enabled: true`
  si clé absente. Aucun risque de régression.

---

## Verdict : CONDITIONAL GO  (confidence: 85 %)

**Auteur** : Steeve Evers
**Date** : 2026-06-25

## Conditions

- **C1** : R2 tranché — point d'intégration = `afterCommand` dans `lib/command-hooks.js`. SPEC-031-2 intègre cette décision.
- **C2** : R1 accepté explicitement — exclure `ready` sacrifie "stuck-in-ready" ; traçable via FACT si besoin.
