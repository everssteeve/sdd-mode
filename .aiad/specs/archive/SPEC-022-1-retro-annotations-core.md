---
id: SPEC-022-1
title: Spec rétroactive lib/init.js + annotations modules cœur
intent: INTENT-022
research: RESEARCH-035
author: Steeve Evers
date: 2026-06-26
status: done
format: prose
sqs: 5/5
---

# SPEC-022-1 — Spec rétroactive `lib/init.js` + annotations modules cœur

**Intent parent** : INTENT-022 — Dogfooding complet (le CLI sous SPEC)
**Research** : RESEARCH-035 — GO (90 %)
**Auteur** : Steeve Evers
**Date** : 2026-06-26
**Statut** : done
**Format** : prose
**SQS** : 5/5 — Gate OUVERTE (2026-06-26)

---

## 1. Contexte

Le package `aiad-sdd` prêche le « zéro code sans SPEC » mais son propre `lib/` compte 76/117 modules non annotés (65 %). `lib/init.js` est le module cœur le plus critique sans SPEC : 384 lignes, aucune annotation, 4 fichiers de tests (~24 000 lignes combinées). Cette SPEC documente rétroactivement le comportement de `lib/init.js` **et** spécifie l'annotation des 7 autres modules prioritaires identifiés dans RESEARCH-035.

## 2. Comportement Attendu

### Input

```js
init(projetDir: string, options?: {
  sansGouvernance?: boolean,  // default false — skip governance Tier 1 agents
  force?: boolean,            // default false — overwrite existing files
  withGitHooks?: boolean,     // default false — install pre-commit hooks
  minimal?: boolean,          // default false — minimal structure only
  runtimes?: string[],        // default ['claude-code'] — multi-runtime targets
  dryRun?: boolean,           // default false — preview without writing
  quiet?: boolean,            // default false — suppress console.log (tests)
}): Promise<void>
```

### Processing

**Mode standard** (ni `minimal` ni `dryRun`) :

1. **Structure `.aiad/`** — crée 15 sous-répertoires (`intents/`, `intents/archive/`, `research/`, `exec/`, `specs/`, `specs/archive/`, `facts/`, `metrics/security/`, `metrics/audit/`, `metrics/traceability/`, `metrics/canary/`, `canary/`, `canary/cases/`, `memory/`, `cycle/`, `reviews/`). Silencieux si déjà présents (idempotent).

2. **Templates** — copie récursive async (`copierDossierRecursifAsync`) depuis `templates/.aiad/` → `.aiad/` et `templates/.claude/` → `.claude/`. Si `--sans-gouvernance`, exclut `gouvernance/` à la profondeur 0.

3. **CLAUDE.md** — si le fichier existe et ne contient pas `# SDD Mode` : ajoute la section en fin de fichier. Si `--force` ou absent : copie depuis template. Si déjà présent avec `# SDD Mode` : skip.

4. **Gouvernance** (`addGovernance`) — installe 5 agents Tier 1 (AI-ACT/RGPD/RGAA/RGESN/CRA) via `lib/governance.js`. Ignoré si `sansGouvernance: true`.

5. **GitHub Actions** — copie récursive `templates/.github/` → `.github/`.

6. **Hooks git** (`installerHooks`) — installe le hook pre-commit uniquement si `withGitHooks: true`.

7. **Multi-runtime** (`emitRules`) — génère AGENTS.md + cibles dérivées pour les runtimes demandés. Erreur non-fatale : log un avertissement et continue.

8. **`.gitignore`** — append `hooks-config.local.json` si absent. N'écrase pas le fichier existant.

**Mode `minimal`** : délègue à `initMinimal()` — crée uniquement la structure `.aiad/` de base sans templates, gouvernance ni emit-rules.

**Mode `dryRun`** : substitue les écritures par des logs `(dry-run)`. Gouvernance et hooks sont skip avec message informatif.

**Mode `quiet`** : redirige `console.log` vers no-op le temps de l'exécution (pattern try/finally) pour les tests parallèles.

### Output

Projet initialisé :
- `.aiad/` avec 16 sous-répertoires et fichiers templates
- `.claude/` avec commandes SDD
- `CLAUDE.md` avec section SDD Mode
- 5 agents gouvernance dans `.aiad/gouvernance/` (sauf `--sans-gouvernance`)
- `.github/workflows/` avec CI traceability
- `AGENTS.md` + rendus multi-runtime (sauf `--minimal`)

### Cas limites

- **Projet déjà initialisé** (`--force` absent) : chaque fichier existant est skip (`logExiste`) ; aucune régression sur le contenu actuel.
- **`--force` + fichier critique (CLAUDE.md avec contenu custom)** : le contenu existant est écrasé sans confirmation. C'est voulu — `--force` signifie « je sais ce que je fais ».
- **`emitRules` échoue** (ex. : templates absent) : avertissement terminal, init continue. Le projet est fonctionnel ; l'utilisateur relance `aiad-sdd emit-rules` manuellement.
- **`dryRun: true`** : aucun fichier ne doit être créé/modifié. Si `existsSync` renvoie `true` après un dry-run → bug.
- **Répertoire cible inexistant** : `ensureDir` le crée récursivement avant d'écrire.

## 3. Critères d'Acceptation

- [ ] `aiad-sdd init <dir>` crée `.aiad/` avec les 16 sous-répertoires attendus dans un répertoire vide.
- [ ] `aiad-sdd init <dir>` est **idempotent** : une deuxième exécution sans `--force` ne modifie aucun fichier existant (tous en `logExiste`).
- [ ] `aiad-sdd init <dir> --dry-run` n'écrit aucun fichier — `existsSync` sur chaque cible retourne `false` après exécution.
- [ ] `aiad-sdd init <dir> --force` écrase les fichiers existants sans erreur.
- [ ] `aiad-sdd init <dir> --sans-gouvernance` ne crée pas `.aiad/gouvernance/`.
- [ ] `aiad-sdd init <dir> --minimal` crée uniquement `.aiad/` (structure de base) sans `.claude/`, CLAUDE.md, gouvernance, GitHub Actions, ni emit-rules.
- [ ] `aiad-sdd init <dir> --with-git-hooks` installe le hook pre-commit (`existsSync('.git/hooks/pre-commit') === true`).
- [ ] Une erreur dans `emitRules` n'interrompt pas l'init (warn + continue).

## 4. Interface / API

```js
// lib/init.js
export async function init(projetDir: string, options?: InitOptions): Promise<void>
export async function copierDossierRecursifAsync(
  source: string,
  destination: string,
  force?: boolean,
  options?: { exclude?: Function, dryRun?: boolean, _depth?: number }
): Promise<void>
```

```
CLI : aiad-sdd init [options]
  --force              Écrase les fichiers existants
  --dry-run            Aperçu sans écriture
  --minimal            Structure minimale uniquement
  --sans-gouvernance   Skip agents Tier 1
  --with-git-hooks     Installe le hook pre-commit
  --runtimes <list>    Cibles multi-runtime (comma-separated)
```

## 5. Dépendances

- `lib/governance.js` → `addGovernance`
- `lib/hooks.js` → `installerHooks`
- `lib/emit-rules.js` → `emitRules`
- `lib/fs-ops.js` → `ensureDir`
- `lib/term.js` → `COLORS`, `log`, `logCreation`, `logExiste`, `logEcrase`
- `templates/` → répertoire source des fichiers copiés

## 6. Annotation des modules prioritaires (livrable complémentaire)

Dans la même PR, annoter les 7 modules suivants avec leur SPEC archivée correspondante :

| Module | Annotation à ajouter | SPEC de référence |
|--------|---------------------|-------------------|
| `lib/init.js:1` | `@spec SPEC-022-1-retro-annotations-core` | cette SPEC |
| `lib/governance.js:1` | `@spec SPEC-002-1-gouvernance-enforced` | `.aiad/specs/archive/` |
| `lib/hooks.js:1` | `@spec SPEC-011-1-hooks-toggles` | `.aiad/specs/archive/` |
| `lib/emit-rules.js:187` | compléter `@spec SPEC-005-1-context-pull` sur les autres fonctions exportées | `.aiad/specs/archive/` |
| `lib/fs-ops.js:1` | `@spec SPEC-022-1-retro-annotations-core` | cette SPEC |
| `lib/frontmatter.js:1` | `@spec SPEC-022-1-retro-annotations-core` | cette SPEC |
| `lib/doctor.js:1` | `@spec SPEC-004-1-execution-phasee` | `.aiad/specs/archive/` |

> `lib/fs-ops.js` et `lib/frontmatter.js` sont des modules d'infrastructure utilitaire sans SPEC dédiée ; ils se rattachent à cette SPEC qui les décrit implicitement via leurs dépendants.

## 7. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~500 tokens
- Cette SPEC : ~600 tokens
- `lib/init.js` (384 lignes) : ~600 tokens
- `lib/governance.js`, `lib/hooks.js`, `lib/fs-ops.js`, `lib/frontmatter.js` (lecture des en-têtes) : ~300 tokens
- **Total estimé** : ~2 000 tokens

## 8. Definition of Output Done (DoOD)

- [ ] `lib/init.js` annoté `@intent INTENT-022 @spec SPEC-022-1-retro-annotations-core @verified-by test/init.test.js`
- [ ] Les 6 autres modules prioritaires annotés (cf. tableau §6)
- [ ] `npx aiad-sdd trace` : `lib/init.js`, `lib/governance.js`, `lib/hooks.js`, `lib/emit-rules.js`, `lib/fs-ops.js`, `lib/frontmatter.js`, `lib/doctor.js` absents de la liste `code_without_spec`
- [ ] Tous les critères d'acceptation §3 couverts par des tests passants (`node --test`)
- [ ] `npx aiad-sdd lint:deps` — zéro dépendance runtime ajoutée
- [ ] Drift Lock : SPEC + code dans la même PR
