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

### Consommateurs de construireMatrice()

> **Règle** : tout changement de `construireMatrice()` (`lib/sdd-trace.js`) ou de son invariant de retour impose de lancer `grep -rn construireMatrice lib/ test/` et d'auditer chaque appelant dans la même PR.

**Définition** : `lib/sdd-trace.js:486` — `export function construireMatrice(racineProjet)`

**Invariant de retour (à jour au 2026-06-29)** :
- `gaps.codeSansSpec` : objet `{ bloquant, non_bloquant, total, items }` — **pas un tableau**. Utiliser `.total` pour le compte, `.items` pour l'itération.
- Archive/ est inclus dans `specsConnus` depuis le patch `78d3b9b` — un fichier archivé n'est plus considéré comme gap.

**Consommateurs production (8 modules)** :

| Module | Ligne d'appel | Usage | Criticité |
|--------|--------------|-------|-----------|
| `lib/sdd-trace.js` | 703, 731 | `trace()`, `watchTrace()` — rendus md/json/sarif | CRITIQUE |
| `lib/drift-verdict.js` | 99 | `emitDriftVerdict()` — accède `gaps.codeSansSpec` | CRITIQUE |
| `lib/ai-act-audit.js` | 35 | `auditAiAct()` — try/catch (optionnel) | MEDIUM |
| `lib/leadership-metrics.js` | 37 | `computeLeadershipMetrics()` — try/catch (optionnel) | MEDIUM |
| `lib/dpia.js` | 53 | `dpia()` — try/catch (optionnel) | MEDIUM |
| `lib/repl.js` | 60 | commande `repl` — `compterGaps(m)` | MEDIUM |
| `lib/workspace.js` | 71 | `runWorkspace()` — agrégation multi-projet | MEDIUM |
| `lib/dashboard/collect.js` | 12 | collecte data dashboard | LOW |

**Checklist quand on modifie `construireMatrice()` ou un invariant** :
1. `grep -rn construireMatrice lib/ test/` — identifier tous les appelants
2. Vérifier que chaque consommateur CRITIQUE fonctionne encore (`npm test`)
3. Mettre à jour ce tableau si un consommateur est ajouté ou supprimé

---

## DRIFT LOCK

> Synchroniser SPEC + code dans la même PR est non négociable. Cette section documente le **modèle de deltas** pour réduire la friction sur les petits changements (SPEC-020-1).

### Modèle deltas (SPEC-020-1)

Tout changement apporté à une SPEC existante (`ready`, `in-progress`, `validation`) suit l'une des deux routes :

| Chemin | Critères | Actions |
|--------|----------|---------|
| **A — Petit delta** | ≤ 5 lignes modifiées **ET** ne touche ni §3 (CA) ni §4 (API) | Mettre à jour la SPEC + ajouter entrée `## Historique des modifications`. Pas d'entrée `CHANGELOG-ARTEFACTS`. |
| **B — Changement significatif** | > 5 lignes **OU** touche ≥ 1 CA ou l'Interface/API | Mettre à jour la SPEC + entrée `## Historique` + entrée `CHANGELOG-ARTEFACTS`. |

**Règle §3/§4 prime sur le compte de lignes** : un changement ≤ 5 lignes touchant un CA est toujours chemin B.

**En cas de doute** : chemin B (conservateur).

**Format entrée Historique** (section en pied de SPEC, après §7 DoOD) :
```
- YYYY-MM-DD [auteur] — <description 1 ligne> (déclencheur : FACT-NNN | décision PE | exécution)
```

**Delta sur SPEC archivée** : interdit — restaurer via `aiad-sdd archive restore <ID>` d'abord.

### Redevabilité bidirectionnelle (SPEC-020-2)

Quand l'agent découvre en exécution une contrainte non documentée dans la SPEC (timeout implicite, invariant de domaine, ordre de traitement), il peut proposer un patch de SPEC **sans jamais modifier la SPEC directement** :

1. Créer un FACT enrichi (`.aiad/facts/FACT-NNN.md`) avec le champ optionnel `spec-patch-proposal`.
2. Le PE examine la proposition et choisit : appliquer (chemin A ou B) / rejeter / modifier.
3. Un FACT avec `spec-patch-proposal` et `statut: ouvert` est signalé par `/sdd drift-check` comme "à statuer avant merge".

Nouveau type de drift détecté par la skill `drift-detection` : `constraint-violated-without-fact` (niveau `WARN` par défaut).

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
| 2026-06-24 | Import nommé `C` depuis `term.js` absent dans un nouveau handler `bin/` → ReferenceError runtime | Lancer `npm run smoke` (dry-run import ESM) avant de committer un nouveau handler | Détecte les imports cassés avant CI |
| 2026-06-24 | Garde `safe: false` basée sur l'invariant "annoté dans lib/ = actif" — devenu caduc après le patch `78d3b9b` de `construireMatrice()` | Quand on modifie `construireMatrice()` ou un invariant du système de traçabilité, auditer immédiatement les consommateurs de ce résultat (`listerLivrables`, `drift-check`, etc.) | Évite des gardes silencieusement caduques après un fix de traçabilité |
| 2026-06-25 | FACT-010 : hook Stop signale `spec_validated_not_implemented` juste après ouverture de gate — l'agent a modifié le statut SPEC pour débloquer, créant une boucle | Ne jamais modifier le statut SPEC pour contourner le hook Stop — c'est une friction outil (INTENT-031), pas un drift réel. Utiliser `git commit --no-verify` documenté (`hook-bypass.yml`) si nécessaire | Évite la boucle ready→review→ready et préserve l'intégrité des statuts SPEC |
| 2026-06-26 | `codeSansSpec` dans `gaps` était un tableau — 8 appelants utilisaient `.length` / `for...of` directement | SPEC-022-2 a changé `codeSansSpec` en objet `{bloquant, non_bloquant, total, items}` — tout nouveau consommateur de `gaps.codeSansSpec` doit utiliser `.total` (compte) ou `.items` (itération) | Quand on enrichit une structure partagée dans `construireMatrice()`, auditer tous les appelants avec `grep -rn codeSansSpec lib/ test/` avant de committer |

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
| 2026-06-25 | INTENT-032 créé, SPEC rédigée, livrée et archivée en ~24h — la solution était de la documentation pure, aucun code applicatif | Avant de créer un Intent, poser la question « y a-t-il du code à écrire ? » — si non, évaluer si un FACT + ajustement direct suffit (moins de friction, même traçabilité) | Évite le surcoût d'un cycle Intent/SPEC complet pour une modification documentaire |
| 2026-06-25 | FACT-010 et FACT-011 décrivaient une friction répétée sur plusieurs sessions avant qu'un Intent soit capturé (INTENT-031) | Toute friction répétée sur 2 sessions consécutives doit déclencher un Intent draft immédiatement, pas uniquement un FACT | Le FACT capture l'écart passé ; l'Intent exprime la volonté de le corriger — les deux sont nécessaires |
