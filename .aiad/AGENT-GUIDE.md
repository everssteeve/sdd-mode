# AGENT-GUIDE — aiad-sdd

> Ce fichier est le **contexte permanent** de l'agent IA.
> Il est injecté dans CHAQUE session de développement.
> Le maintenir à jour est une responsabilité de l'Agents Engineer (AE).
> Framework : AIAD SDD Mode v1.3

---

## IDENTITÉ DU PROJET

**Nom** : aiad-sdd (CLI `aiad-sdd`, v1.18.x)
**Description** : Framework de développement spec-first (Spec Driven Development) pour Claude Code et runtimes IA. Outille le cycle AIAD `Intent → Research → SPEC → Gate → Exec → Validation → Drift Lock` via une CLI Node.js + des skills/commandes Claude Code.
**Domaine métier** : Outillage développeur / gouvernance de développement assisté par IA (dev tooling, AI agents).
**Mission** : Garantir la **paternité humaine de l'intention** tout au long d'un cycle de dev IA, et rendre la gouvernance (qualité, réglementaire) **machine-vérifiable** plutôt qu'advisory. Le projet se développe en dogfooding (il s'applique son propre cycle SDD).

---

## DOCUMENTATION DE RÉFÉRENCE

| Document | Chemin | Mode d'injection |
|----------|--------|-----------------|
| PRD | @.aiad/PRD.md | Cadrage uniquement |
| Architecture | @.aiad/ARCHITECTURE.md | Condensé permanent |
| SPEC active | @.aiad/specs/[SPEC-XXX].md | Par tâche uniquement |
| Index SPECs | @.aiad/specs/_index.md | Planification |
| Index Intents | @.aiad/intents/_index.md | Planification |
| Gouvernance | @.aiad/gouvernance/ | Permanent (Tier 1, veto) |
| Guide agent multi-runtime | @AGENTS.md | Source des rendus emit-rules |

---

## STACK TECHNIQUE (Référence Rapide)

- **Runtime** : Node.js ≥ 18 (ESM natif, `"type": "module"`) ; compatible Bun ≥ 1.2.
- **Langage** : JavaScript pur (pas de TypeScript, pas d'étape de build).
- **Dépendances** : **ZÉRO dépendance runtime ET dev** (`dependencies: {}`, `devDependencies: {}`). Contrainte structurante — appliquée par `lint:deps`. Tout besoin (JSON Schema, parsing, couleurs terminal) est réimplémenté maison.
- **Tests** : runner natif `node --test` (`test/*.test.js`), couverture via `--experimental-test-coverage` + seuil (`scripts/coverage-threshold.js`).
- **Distribution** : paquet npm (`bin/aiad-sdd.js`), + skills/commandes Claude Code dans `.claude/`.
- **Code applicatif** : `lib/*.js` (~100 modules, un par capacité CLI). Scripts d'outillage dans `scripts/`.

---

## RÈGLES ABSOLUES

### TOUJOURS
- Lire l'AGENT-GUIDE + la SPEC active en tête de contexte avant de coder
- Annoter tout code applicatif avec `@intent` / `@spec` (+ `@verified-by`, `@governance` si pertinent)
- Synchroniser SPEC + code dans la même PR (Drift Lock)
- Ajouter / mettre à jour un test `node --test` pour chaque feature et chaque bug fix
- Faire dériver le verdict d'une gate/validation d'un **script CLI déterministe** (jamais du jugement libre du modèle) — cf. `lib/verdict.js`
- Vérifier le Human Authorship avant toute automatisation d'une décision
- Après tout changement CLI touchant l'aide ou la couverture des commandes : régénérer `aiad-sdd docs` + `coverage:badge` (sinon CI rouge)
- Après activation d'un Intent : régénérer les rendus multi-runtime (`emit-rules`) — l'Intent actif y est embarqué

### JAMAIS
- Ajouter une dépendance npm (runtime ou dev) — la contrainte zéro-dep est non négociable
- Coder une feature sans SPEC validée (SQS ≥ 4/5)
- Inventer une intention — toujours demander à l'humain
- Introduire du TypeScript ou une étape de build
- Committer sans `npm run lint` + tests passants
- Pusher des secrets dans git (`.env` + `.env.example`)
- Merger une PR sans Drift Check
- Ignorer un veto d'un agent de gouvernance Tier 1

### INCERTITUDE — Dire "je ne sais pas"
- Dire `JNSP` (Je Ne Sais Pas) est un signal valide, pas un échec — préférer une réponse honnête à une réponse confiante mais inventée
- Si l'intention n'est pas formulée par un humain identifiable → JNSP, demander à l'humain plutôt que paraphraser
- Si un critère d'acceptation ne peut pas être testé sans ambiguïté → JNSP, ne pas le scorer "OK"
- Si la gouvernance Tier 1 ne peut pas être tranchée → `UNKNOWN` = VETO par défaut (fail-closed)
- Si les annotations `@spec` sont absentes du code à vérifier → `INCONNU` plutôt que "pas de drift"
- Si un fichier de contexte n'a pas pu être lu intégralement → JNSP, pas d'extrapolation
- Dans le code : poser `// TODO-JNSP: <question précise pour l'humain>` ; le hook pre-commit bloque tout diff qui en contient
- Dans une réponse : structurer en 3 lignes — ce qui est connu, ce qui manque, question à l'humain

---

## CONVENTIONS DE CODE

### Nommage
- **Fichiers `lib/`** : kebab-case, un module par capacité (`drift-verdict.js`, `commands-registry.js`, `version-sync.js`).
- **Exports** : nommés, en `UPPER_SNAKE` pour les constantes gelées (`VERDICTS_CANONIQUES`, `VERDICT_EXIT`), camelCase pour les fonctions.
- **Tests** : `test/<module>.test.js`, miroir du nom du module.

### Structure d'un module `lib/`
```js
// AIAD SDD Mode — <rôle du module en 1-2 phrases>.
//
// <contexte / cap stratégique éventuel>
//
// @intent INTENT-NNN
// @spec SPEC-NNN-N-slug
// @verified-by test/<module>.test.js
//
// Documentation : https://aiad.ovh

import { ... } from './autre-module.js'; // imports relatifs avec extension .js

export const CONST = Object.freeze({ ... });
export function faireQuelqueChose(args) { ... }
```

### Imports
- ESM uniquement, **extension `.js` obligatoire** sur les imports relatifs (vérifié par `lint:esm`).
- Aucun import de package tiers (zéro-dep).

### Gestion des erreurs
```js
// Verdicts via exit codes stables (lib/verdict.js) : 0=PASS/CONDITIONAL, 1=FAIL, 2=JNSP.
// Erreurs CLI : message clair sur stderr + process.exitCode, pas de throw nu remontant à l'utilisateur.
```

---

## VOCABULAIRE MÉTIER

| Terme métier | Définition | Terme à éviter |
|--------------|------------|----------------|
| Intent Statement | Le POURQUOI d'une feature, à paternité humaine | « ticket », « user story » |
| SPEC | Le COMMENT technique atomique, lié à un Intent | « specs » au sens vague |
| SQS (Spec Quality Score) | Score 0–5 ouvrant l'Execution Gate (seuil ≥ 4/5) | « note de la spec » |
| Drift Lock | Synchronisation SPEC ↔ code dans la même PR | « sync » |
| JNSP | « Je Ne Sais Pas » — verdict honnête, exit code 2 | « erreur », « échec » |
| Veto (Tier 1) | Refus non-bypassable d'un agent de gouvernance | « warning » |
| Enforced vs Advisory | Règle bloquante (harness) vs simple recommandation | — |

---

## PATTERNS DE DÉVELOPPEMENT

### Pattern 1 — Verdict déterministe + exit code
Toute gate/validation/audit produit un verdict via `lib/verdict.js` (sortie validée par schéma maison, exit code stable). Le même artefact est affiché à l'humain, injecté au modèle et lu par le hook harness. Jamais de verdict issu du jugement libre du LLM.

### Pattern 2 — Capacité = un module `lib/` + un test miroir + une commande/skill
Une nouvelle capacité CLI s'ajoute par : un module `lib/<nom>.js` annoté, un `test/<nom>.test.js`, l'enregistrement dans `lib/commands-registry.js` (catégorie core/extended/experimental), et le câblage dans `bin/aiad-sdd.js`.

---

## ANTI-PATTERNS

| Anti-pattern | Pourquoi éviter | Alternative |
|--------------|-----------------|-------------|
| Ajouter une lib npm pour un besoin ponctuel | Casse la garantie zéro-dep (différenciateur du projet) | Réimplémenter le sous-ensemble nécessaire dans `lib/` |
| Verdict basé sur le jugement libre du modèle | Non déterministe (variance LLM) → gate non fiable | Script CLI + schéma + exit code (`lib/verdict.js`) |
| Coder puis « documenter plus tard » la SPEC | Drift garanti, CI rouge | SPEC + code dans la même PR (Drift Lock) |
| Modifier l'aide/couverture sans régénérer | Badge & doc désynchronisés → CI rouge | `aiad-sdd docs` + `coverage:badge` dans la PR |

---

## LESSONS LEARNED

> Section mise à jour à chaque fin d'itération (commande `/aiad retro`).
> Documentez ici les erreurs récurrentes de l'agent ET les corrections appliquées.

| Date | Erreur agent | Correction | Impact |
|------|-------------|------------|--------|
| 2026-06-19 | Activer un Intent sans régénérer les rendus multi-runtime | Lancer `emit-rules` dans la même PR | Évite une CI rouge sur le check de divergence |
| 2026-06-19 | Toucher l'aide/couverture CLI sans régénérer doc + badge | `aiad-sdd docs` + `npm run coverage:badge` | Évite une CI rouge (doc/badge désynchronisés) |
| 2026-06-19 | Débugger le test perf « gain cold/warm scanCode » qui échoue | C'est un flaky de timing — relancer le job, ne pas modifier le diff | Évite de chasser un faux bug |
| 2026-06-23 | Annoter le code d'une SPEC sans couvrir tous les modules — trace completeness bloquée à 75,6 % | Vérifier `npx aiad-sdd trace --fail-on-gap` avant de clore chaque PR de feature | Évite un gap structurel détecté trop tard par la CI |
| 2026-06-24 | Import nommé `C` depuis `term.js` absent dans un nouveau handler `bin/` → ReferenceError runtime | Tester `node -e "require('./bin/aiad-sdd')"` (dry-run import) avant de committer un nouveau handler | Détecte les imports cassés avant CI |
| 2026-06-24 | Garde `safe: false` basée sur l'invariant "annoté dans lib/ = actif" — devenu caduc après le patch `78d3b9b` de `construireMatrice()` | Quand on modifie `construireMatrice()` ou un invariant du système de traçabilité, auditer immédiatement les consommateurs de ce résultat (`listerLivrables`, `drift-check`, etc.) | Évite des gardes silencieusement caduques après un fix de traçabilité |

---

## HUMAN LEARNINGS

> Section v1.1 — Documentez ici les écarts entre l'intention humaine et la livraison.
> Ces learnings ne sont PAS des erreurs de l'agent — ce sont des défaillances de l'expression humaine.
> Documenter ces écarts prévient la *cognitive debt* (Fowler/Joshi, 2026) : ce qui n'a pas été compris une fois se répète.

| Date | Intention exprimée | Résultat obtenu | Apprentissage |
|------|--------------------|-----------------|---------------|
| 2026-06-23 | INTENT-018 déclaré implicitement « terminé » au fil des PRs | L'index restait `draft` — découvert 12 jours après la dernière SPEC | Clore explicitement l'Intent dans `_index.md` à la même PR que la dernière SPEC liée (même réflexe que le Drift Lock) |
| 2026-06-24 | SPEC-026-1 conçue sans anticiper la dépendance avec `78d3b9b` (patch traçabilité en cours dans la même session) — la garde `safe` était basée sur un invariant que le patch venait de changer | Quand deux changements portent sur des systèmes interdépendants (archive + traçabilité), rédiger les SPECs ou les patches en ordre topologique, ou noter explicitement la dépendance dans la SPEC | Évite les bugs d'intégration intra-session invisibles à la review |
| 2026-06-23 | 6 Intents `draft` créés le même jour sans priorisation | Backlog draft qui vieillit → risque de « draft oublié » à J+14 | Chaque session de création groupée d'Intents doit se terminer par une décision de priorisation (`active` / `archived`), pas laisser tout en `draft` |
