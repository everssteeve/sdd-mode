# Architecture interne — `aiad-sdd`

> Document destiné aux contributeurs. Pour la vue produit, voir [README.md](../README.md). Pour le guide de contribution, voir [CONTRIBUTING.md](../CONTRIBUTING.md).

## Principes de conception

1. **Zero runtime dependency.** Le paquet n'importe que `node:` builtins. Toute lib externe ferait porter un risque supply-chain à des milliers de projets clients ; on s'en prive.
2. **Idempotence partout.** Les commandes peuvent être ré-exécutées sans effet de bord parasite. Sentinelles, frontmatters `source-hash`, `mettreAJour` qui n'écrit qu'en cas de différence, etc.
3. **Préservation utilisateur.** Tout ce que l'humain rédige (Intent, SPEC, PRD, ARCHITECTURE, AGENT-GUIDE, hooks personnalisés, règles Cursor non-AIAD) est sacré. La détection passe par marqueurs / sentinelles, jamais par chemin seul.
4. **Pure / impure séparées.** Chaque commande qui produit du contenu sépare la collecte (pure, JSON-sérialisable) du rendu (impure : I/O, ANSI). Cela rend les surfaces JSON / SARIF triviales à dériver.
5. **Sortie machine-lisible disponible** sur toute commande de pilotage (`status`, `bench`, `doctor`, `trace`, `update --check`, `emit-rules --check`, `skills validate`).

## Vue d'ensemble

```
                  ┌─────────────────────┐
                  │  bin/aiad-sdd.js     │  parseArgs (zero-dep)
                  │  router CLI          │  schéma global typé
                  └────────┬────────────┘
                           │
              ┌────────────┼─────────────┬───────────────┐
              ▼            ▼             ▼               ▼
        ┌──────────┐ ┌───────────┐ ┌──────────┐  ┌──────────────┐
        │  setup   │ │  cycle    │ │ pilotage │  │   sortie     │
        │ init     │ │  trace    │ │ status   │  │   sarif      │
        │ update   │ │  emit-r.  │ │ doctor   │  │   dashboard  │
        │ upgrade  │ │ governance│ │ bench    │  │              │
        │ uninst.  │ │  hooks    │ │ skills   │  │              │
        └────┬─────┘ └─────┬─────┘ └────┬─────┘  └──────┬───────┘
             │             │            │                │
             └─────────────┼────────────┴────────────────┘
                           ▼
                ┌─────────────────────┐
                │ couche socle        │
                │  term.js  fs-ops.js │
                │  frontmatter.js     │
                │  lockfile.js        │
                └─────────────────────┘
```

## Couche socle

### `lib/term.js`

Centralise la palette ANSI 16-couleurs et les helpers `log*`. Respecte automatiquement `NO_COLOR`, `AIAD_NO_COLOR`, et la détection TTY (les codes ANSI sont neutralisés en CI / pipe).

API publique : `COLORS` (alias `C`), `log`, `logCreation`, `logMaj`, `logOk`, `logExiste`, `logEcrase`, `logPreserve`, `logSkip`, `logDrift`, `logSection`, `logHeader`, `logStats`, `colorsEnabled`.

### `lib/fs-ops.js`

Sémantique unique de copie / mise à jour, avec `dryRun` propagé partout. Les retours sont typés (`'created' | 'updated' | 'unchanged' | 'preserved'`), ce qui rend la décision de logger atomique.

API : `ensureDir`, `mettreAJour`, `copierFichier`, `copierDossier`, `ajouterSiAbsent`.

`copierDossier` accepte un filtre `exclude(nom, src, depth)` qui est utilisé par `init` pour exclure `gouvernance/` quand `--sans-gouvernance` est passé.

### `lib/frontmatter.js`

Mini-parser YAML couvrant le sous-ensemble nécessaire aux artefacts SDD : scalaires typés, listes inline et multilignes, commentaires `#`. Compatibilité ascendante 100 % : si pas de `---` en tête, retourne `{ data: {}, body: contenu }` et les anciens lecteurs basés sur regex continuent de fonctionner.

API : `parseFrontmatter`, `stringifyFrontmatter`.

### `lib/lockfile.js`

Verrou inter-processus via `O_EXCL` (Node `wx`). Stale recovery automatique sur deux signaux : âge du lock (mtime) et liveness du PID (`process.kill(pid, 0)`). Backoff configurable (50 retries × 100ms par défaut).

API : `acquireLock`, `avecLock`. Utilisé par `emitRules` quand le mode est write (skip pour `--check` / `--dry-run`).

## Commandes setup

### `init`

Bootstrap d'un projet AIAD. Deux profils :
- **Complet** (défaut) : structure `.aiad/` avec PRD/ARCHI/GUIDE/intents/specs/gouvernance/metrics/facts, 27+ commandes Claude Code, skills, workflows GitHub, AGENTS.md, header CLAUDE.md. Émet `--runtime claude-code` par défaut, ou multi-runtime via `--runtime cursor,codex,gemini,all`.
- **Minimal** (`--minimal`) : 4 commandes essentielles uniquement (intent/spec/gate/drift-check), AGENT-GUIDE seul, ~793 tokens cold-start. Pour démarrer puis évoluer via `--upgrade`.

### `update`

Resynchronise avec le package : commandes slash et gouvernance écrasées (le contrat documenté), PRD/ARCHI/GUIDE/CLAUDE.md préservés (tout ce qui est rédigé par l'humain). Mode `--check` (helper `syncOuVerif` partagé) pour valider la parité en CI.

### `upgrade`

Modules incrémentaux qui ajoutent au profil minimal : `rituals` (router /aiad + sous-commandes), `metrics` (dashboard/dora/flow), `gouvernance` (Tier 1 EU), `all` (bascule complète).

### `uninstall`

Retire les artefacts générés par aiad-sdd, **préserve les artefacts métier**. Mode aperçu par défaut, `--force` pour exécuter, `--purge --force` pour supprimer aussi `.aiad/` (irréversible). Détection par marqueur `<!-- DO NOT EDIT — regenerate via /aiad-emit-rules -->` ou `# AIAD SDD Mode` (hooks).

## Commandes cycle

### `sdd-trace`

Scanne le code source à la recherche d'annotations `@intent`, `@spec`, `@verified-by`, `@governance` et croise avec `.aiad/intents/` et `.aiad/specs/` pour produire la matrice de traçabilité (forward + backward + gaps). Stratégie de scan : `git ls-files` quand un repo Git est présent (respecte `.gitignore`, plus rapide), sinon walk récursif avec liste d'exclusions.

Sortie : Markdown + JSON + HTML + SARIF v2.1.0 (consommable GitHub Code Scanning, GitLab, Sonar).

### `emit-rules`

Régénère les fichiers dérivés multi-runtime depuis `.aiad/AGENT-GUIDE.md` + `.aiad/gouvernance/` + Intent actif. Cibles : `AGENTS.md`, header `CLAUDE.md`, `.cursor/rules/aiad*.mdc`, `.codex/AGENT.md`, `GEMINI.md`. Idempotence par `source-hash` SHA-256 dans le frontmatter de chaque fichier émis. Mode `--check` exit 1 si divergence (CI parity check).

### `governance` (legacy) + packs

`addGovernance` installe le pack EU baseline historique (4 agents Tier 1). Le nouveau registre `governance-packs.js` permet `--pack us-baseline | uk-baseline | eu-baseline`, `--list`. Le défaut sans flag reste `eu-baseline` (cap stratégique leader EU/FR).

### `hooks`

Installe le wrapper pre-commit (Husky-aware) qui invoque `.aiad/hooks/pre-commit.sh`. Le script bash respecte `.aiad/config.yml` (mode `block`/`warn`/`off`) et `.aiad/hook-bypass.yml` (whitelist gitignore-style).

## Commandes pilotage

### `status`

`collecterStatus(projetDir)` est pure et JSON-sérialisable. `showStatus({ json })` rend en console ou émet le JSON sur stdout.

### `doctor`

Diagnostic unifié 7 catégories (structure, fondamentaux, cycle, commandes, gouvernance, parité emit-rules, hooks, git, version). Chaque check expose `{ ok, severity, message, details? }`. Sortie texte ou `--json`. Exit 1 si anomalies bloquantes.

### `bench`

Mesure le poids cumulé des frontmatters de commandes Claude Code (avant/transition/après le retrait des alias plats prévu en v2). Cible : -70 % final.

### `skills validate`

Vérifie le frontmatter des `.claude/skills/<name>/SKILL.md` : `name`, `description ≥ 30 caractères`, corps ≥ 50 caractères. Évite les skills silencieusement ignorées par Claude Code.

## Dashboard

`lib/dashboard/` est éclaté en 5 modules :

- `collect.js` (pure) — 12 fonctions de lecture des artefacts vers un modèle JSON.
- `server.js` — serveur HTTP local 127.0.0.1 (zero-dep).
- `assets.js` — CSS + JS client (constantes string).
- `watch.js` — `fs.watch` recursive avec debounce 200ms et filtres anti-boucle.
- `dashboard.js` (orchestrateur) — RENDERERS, layout, page builders, écriture des HTML.

Mode `--serve --watch` régénère silencieusement à chaque changement dans `.aiad/`.

## Lecture des artefacts

`dashboard/collect.js#lireIntents/lireSpecs` et `sdd-trace.js#lireIntents/lireSpecs` priorisent le frontmatter YAML (champ `status`, `parent_intent`, etc.) sur la regex prose legacy (`**Statut** : ready`). La compat ascendante est garantie : si pas de frontmatter, fallback regex.

## Tests

- `test/<feature>.test.js` — couvre une feature isolément.
- Fixtures dans `os.tmpdir()` — pas de pollution du repo.
- Tests d'intégration utilisent `init()` puis manipulent l'arbo créée.
- Tests CLI via `child_process.spawnSync('node', [bin, ...args])`.
- Le hook pre-commit est testé via `bash` direct sur un mini-repo Git.

## Émission CI

`.github/workflows/ci.yml` (matrix Node 18/20/22 × ubuntu/macos + lint + tests + tarball check exclut .DS_Store/.tgz/test/playwright/productbacklog).
`.github/workflows/release.yml` (publish-on-tag `v*` avec `--provenance`, vérifie tag = version package).

## Points d'extension

- **Nouveau pack gouvernance** : voir [CONTRIBUTING.md#ajouter-un-pack-de-gouvernance](../CONTRIBUTING.md#ajouter-un-pack-de-gouvernance).
- **Nouveau format de sortie pour `trace`** : ajouter un module `lib/<format>.js` exportant `rendre<Format>(modele)` et brancher dans `sdd-trace.js#trace`.
- **Nouveau runtime IA dans `emit-rules`** : ajouter un générateur dans `emit-rules.js` (pattern `genererXxx(ctx)` + `wants('xxx')`).
- **Nouvelle commande pilotage** : créer `lib/<cmd>.js` qui sépare collecte pure / rendu, avec option `{ json }`. Brancher dans `bin/aiad-sdd.js`.
