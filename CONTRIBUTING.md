# Contribuer à `aiad-sdd`

Merci de l'intérêt que tu portes à AIAD ! Ce guide te donne tout ce dont tu as besoin pour contribuer en confiance.

> **Cap stratégique** : `aiad-sdd` se veut le **framework leader européen de développement basé sur l'intention**, en langue française par défaut. La barre de qualité est haute (zero-dep runtime, tests automatisés, idempotence stricte, sortie machine-lisible) mais l'accueil est ouvert : la documentation, les commentaires de code et les messages utilisateur sont en français ; les noms de fonctions, signatures et identifiants en anglais pour rejoindre la convention de l'écosystème Node.

## Sommaire

1. [Mise en place](#mise-en-place)
2. [Lancer les tests](#lancer-les-tests)
3. [Conventions de code](#conventions-de-code)
4. [Conventions de commit](#conventions-de-commit)
5. [Architecture interne](#architecture-interne)
6. [Comment proposer un changement](#comment-proposer-un-changement)
7. [Ajouter un pack de gouvernance](#ajouter-un-pack-de-gouvernance)
8. [Code de conduite](#code-de-conduite)

## Mise en place

```bash
git clone git@github.com:everssteeve/sdd-mode.git
cd sdd-mode
node --version  # ≥ 18.0.0 requis (parseArgs natif)
npm install      # zero dep, instantané
```

Pas de dépendances runtime. **Node ≥ 18** ou **Bun ≥ 1.2** au choix.

### Bun runtime (alternative)

Le bin `aiad-sdd` est compatible Bun 1.2+ (validé en CI via `.github/workflows/bun-smoke.yml`). Tous les imports `node:*` utilisés (fs, path, url, os, process, crypto, child_process, http, readline, util, worker_threads) sont supportés par Bun.

```bash
bun bin/aiad-sdd.js --help
bun bin/aiad-sdd.js init
bun bin/aiad-sdd.js doctor
```

**Note** : la suite de tests utilise `node:test` natif (pas `bun test`). Les tests doivent rester exécutables avec `node --test`. Si tu introduis un module qui dépend d'une API Node-only ou Bun-only, le test `test/bun-compat.test.js` (lint statique) échouera et te guidera.

## Lancer les tests

```bash
npm test                            # node --test sur test/**/*.test.js (~290+ tests)
npm run lint                        # node --check + détection imports cassés
npm run test:coverage               # rapport coverage natif Node (zero-dep)
npm run test:coverage:threshold     # exit 1 si lines < 75% / branches < 70% / funcs < 65%
node scripts/bench-trace.js         # bench perf de `construireMatrice` (5000 fichiers / 5 runs)
node scripts/bench-trace.js --files 100000 --runs 1   # bench monorepo
```

Le `prepublishOnly` enchaîne les deux : impossible de publier un tarball cassé.

Tests d'intégration : ils créent des projets temporaires dans `os.tmpdir()`, donc rien ne pollue ton repo local. La suite tourne en moins de 2 secondes.

## Garde-fous de conception (§4) — checklist de revue

Avant d'ouvrir une PR qui ajoute/modifie une commande ou une règle SDD, vérifie ces garde-fous transverses (ils **bornent** la roadmap : empêcher la sur-ingénierie et garder SDD aligné sur l'évolution des modèles) :

- [ ] **GF1 — Agentic engineering** : la fonctionnalité sert l'intention humaine + la vérifiabilité (pas un échafaudage que le prochain modèle rendra inutile).
- [ ] **GF2 — Code en boucle** : aucune commande ne produit de code sans **ancrage codebase préalable** (Discovery `Explore`, §3.5). Spécifier sans regarder le code réel = specs-to-code naïf, interdit.
- [ ] **GF3 — Léger par défaut** : le chemin est **proportionné** au risque (`aiad-sdd proportionality`). On n'impose le lourd (EARS + Research complète) que si l'ambiguïté coûte cher.
- [ ] **GF4 — Gate interactif** : les modes `--guided` suivent le pattern `grill-me` (une question à la fois + recommandation), jamais un formulaire statique.
- [ ] **GF5 — Durée de vie limitée** : une règle/skill qui pallie une lacune du modèle porte `sunset_when:` ou `review_at:` (vérifié par `aiad-sdd sunset` / `doctor`). À relire à chaque montée de version majeure de Claude Code.

## Conventions de code

### Style

- **ESM uniquement** (`"type": "module"` dans `package.json`, imports explicites avec `.js`).
- **Synchrone par défaut** dans le CLI court (`readFileSync`, `writeFileSync`) — l'asynchrone est réservé au serveur HTTP et au lock-file.
- **Zero-dep runtime** est non-négociable. Si tu penses avoir besoin d'une dep, ouvre une issue avant la PR pour discuter de l'alternative.
- Identifiants / noms de fonctions / signatures publiques en **anglais**.
- Commentaires, messages CLI, artefacts métier en **français**.

### Couleurs et logs

Toujours via `lib/term.js` :

```js
import { C, log, logCreation, logMaj, logHeader } from './term.js';
```

Ne réintroduis pas de palette ANSI locale.

### Opérations FS

Toujours via `lib/fs-ops.js`. **Préfère les noms canoniques EN** pour le nouveau code :

```js
import { ensureDir, syncFile, copyFile, copyDir, appendIfMissing, translateIOError } from './fs-ops.js';
```

Les noms français legacy (`mettreAJour`, `copierFichier`, `copierDossier`, `ajouterSiAbsent`, `traduireErreurIO`) restent exportés en alias pour préserver la compat. À terme, les call-sites internes migrent vers les noms EN ; les artefacts métier (Intent / SPEC / PRD / AGENT-GUIDE) restent en français.

Toutes les fonctions acceptent `dryRun: true` qui retourne le verdict sans toucher au disque. Cet invariant est un contrat que tu dois préserver. Les erreurs IO sont automatiquement traduites en messages français actionnables (EACCES / EPERM / ENOSPC / EROFS) via `translateIOError`.

### Frontmatter

Le mini-parser zero-dep est dans `lib/frontmatter.js`. N'ajoute pas de dépendance YAML — si le sous-ensemble actuel ne suffit pas, étends-le et ajoute des tests.

### Lock-file

Toute commande qui écrit dans plusieurs fichiers en parallèle doit utiliser `lib/lockfile.js#avecLock` pour prévenir la corruption en CI matrix.

## Conventions de commit

[Conventional Commits](https://www.conventionalcommits.org/) :

```
feat: nouveau pack gouvernance us-baseline
fix: lockfile relâché même si fn lève
docs: explique les annotations machine-vérifiables
test: durcit le test de debounce du watcher
refactor: extrait dashboard/server.js
chore: bump devDeps
```

Les corps de commits sont en français quand ils discutent de produit/UX, en anglais quand ils discutent d'API.

## Architecture interne

Voir [`docs/architecture.md`](docs/architecture.md) pour la vue d'ensemble. Résumé :

```
bin/aiad-sdd.js          → parsing CLI (node:util.parseArgs)
lib/
├── term.js              → palette ANSI + log helpers (NO_COLOR-aware)
├── fs-ops.js            → opérations FS unifiées + dryRun
├── frontmatter.js       → mini-parser YAML zero-dep
├── lockfile.js          → verrou inter-processus (O_EXCL)
├── init.js              → bootstrap projet (profil complet ou minimal)
├── update.js            → resynchronise commandes + gouvernance
├── upgrade.js           → modules incrémentaux (rituals/metrics/all)
├── governance.js        → pack eu-baseline (legacy)
├── governance-packs.js  → registre eu/us/uk + installerPack
├── status.js            → état projet (collecterStatus pure + rendu)
├── doctor.js            → diagnostic unifié 7 catégories
├── coldstart.js         → bench frontmatters cold-start
├── hooks.js             → install pre-commit Drift Lock
├── sdd-trace.js         → matrice traçabilité Intent↔SPEC↔Code↔Tests
├── sarif.js             → export SARIF v2.1.0
├── emit-rules.js        → multi-runtime (AGENTS.md/Cursor/Codex/Gemini)
├── skills.js            → validation frontmatter SKILL.md
├── uninstall.js         → désinstallation propre, préserve l'humain
└── dashboard/
    ├── collect.js       → lecture pure artefacts → modèle JSON
    ├── server.js        → HTTP local 127.0.0.1
    ├── assets.js        → CSS + JS client (constantes)
    └── watch.js         → fs.watch + debounce + filtres
```

## Comment proposer un changement

1. **Ouvre une issue** d'abord pour les changements > 50 LOC. Pour les fix mineurs ou doc, va direct en PR.
2. **Crée une branche** `feat/...`, `fix/...`, `docs/...`.
3. **Écris le test d'abord** quand tu peux — la couverture actuelle est exhaustive, on aimerait qu'elle le reste.
4. **Code en suivant les conventions ci-dessus**.
5. **Lance `npm run lint && npm test`** localement.
6. **Pousse et ouvre une PR** ; la CI tourne sur Node 18, 20, 22 × ubuntu, macos.
7. **Réponds aux retours de revue** dans la même PR (force-push autorisé, pas de fix-up commit imposé).

## Ajouter un pack de gouvernance

Pour étendre l'adressabilité à une nouvelle juridiction :

1. Crée `templates/.aiad/gouvernance-packs/<nom-pack>/AIAD-XXX.md` (un fichier par agent Tier 1) avec la structure : MISSION + DÉCLENCHEURS + RÈGLES TOUJOURS + RÈGLES JAMAIS + PROTOCOLE DE SIGNALEMENT.
2. Ajoute l'entrée dans `lib/governance-packs.js#PACKS` :
   ```js
   '<nom-pack>': {
     titre: '...',
     description: '...',
     juridiction: '...',
     sourceDir: join(TEMPLATES_DIR, '.aiad', 'gouvernance-packs', '<nom-pack>'),
     defaut: false,
   }
   ```
3. Ajoute un test dans `test/governance-packs.test.js` qui vérifie le nombre d'agents et un texte clé.
4. **Le défaut sans `--pack` reste `eu-baseline`** — c'est le cap stratégique du framework.

## Code de conduite

- Respect, bienveillance, retours techniques précis.
- Pas de discrimination, pas de harcèlement.
- Le mainteneur a le dernier mot sur les arbitrages.

Pour toute remontée privée : [evers.steeve@gmail.com](mailto:evers.steeve@gmail.com).

---

Merci. Chaque PR qui rapproche `aiad-sdd` de son cap de leader européen compte.
