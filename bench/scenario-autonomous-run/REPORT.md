# REPORT — Scénario autonome SDD Mode sur tinr.ly

**Date** : 2026-05-13
**Cible** : URL shortener souverain, 10 itérations
**Version package testée** : `aiad-sdd@1.14.0`
**Doc de référence comparée** : `SDDMode.md` (figée à v1.6)
**CLAUDE.md installé déclare** : v1.12
**Sandbox** : `bench/scenario-autonomous-run/url-shortener/`

---

## Synthèse exécutive

Le framework AIAD SDD Mode **fonctionne et est riche** (45+ commandes CLI, 30+ commandes slash, 8 skills, 5 agents Tier 1, packs gouvernance multi-juridictions, dashboard HTML, traceability, EARS, dpia, sbom, ai-act audit, sovereignty score…). Le scénario a parcouru 10 itérations sans blocage majeur.

**Mais** un PE qui lit `SDDMode.md` et tente de l'exécuter rencontre **6 frictions structurelles** (sévérité 🔴/🟠), principalement dues à :

1. La doc `SDDMode.md` est restée à v1.6 alors que le package est en v1.14.0 (skills, routers, EARS, trace, JNSP, CRA, dual-mode `--guided/--fast`, multi-runtime sont invisibles).
2. Plusieurs commandes comptent ou parsent leurs entrées différemment → divergences trompeuses entre `doctor`, `status`, `dashboard`, `trace`, `storybook`.
3. Le contrat de **liaison Intent ↔ SPEC** n'est pas explicite : le frontmatter et le corps Markdown servent tous deux, sans schéma unifié.

Aucune commande n'a planté de manière non récupérable. La pipeline est solide ; ce sont des défauts de cohérence et de doc.

---

## Tableau récapitulatif des findings

| # | Sévérité | Titre | Reproduction | Suggestion |
|---|----------|-------|--------------|------------|
| F-001 | 🟠 | Doc `SDDMode.md` figée à v1.6 vs package 1.14.0 | `head SDDMode.md` vs `package.json` | `npm run docs:check` + bandeau version + emit-rules étendu à `SDDMode.md` |
| F-002 | 🟠 | Décompte des commandes incohérent (24 / 27 / 30 / 32) | `SDDMode.md`, `--help`, `storybook` | Source unique de vérité, calculée à chaud |
| F-003 | 🔴 | `init` sans `--force` n'écrit ni CLAUDE.md ni AGENTS.md | `npx aiad-sdd init --runtime claude-code` puis `ls CLAUDE.md` | Toujours déclencher `emit-rules` en fin de `init` |
| F-004 | 🔴 | `init` sans `--force` installe partiellement (7 commandes au lieu de 30) | Cf. transcript | Atomicité install + `doctor` capable de détecter état partiel + log écrit `.aiad/.install-log` |
| F-005 | 🟡 | 5ᵉ agent Tier 1 (CRA) absent de la doc | `ls .aiad/gouvernance/` | Mettre à jour `SDDMode.md`, ajouter section gouvernance multi-niveaux (Tier 1 + packs Tier 2/3) |
| F-006 | 🟡 | 8 skills `.claude/skills/` invisibles dans la doc | `ls .claude/skills/` | Nouvelle section "Skills v1.9" dans `SDDMode.md` |
| F-007 | 🟠 | Le template `spec-ears-template.md` est compté comme une SPEC active par `doctor` et `status` | `npx aiad-sdd doctor` après init vierge | Exclure les fichiers ne matchant pas `SPEC-NNN-*.md` |
| F-008 | 🟠 | Décomptes SPECs divergents : `doctor` dit 14, `trace` 13, `dashboard` 13 | Cf. transcripts | Source unique de comptage, exclure template |
| F-009 | 🟡 | `_index.md` des intents/specs réfère les **alias dépréciés** (`/sdd-intent`) | `head .aiad/intents/_index.md` | Régénérer les `_index.md` en passant à `/sdd intent` (forme router) |
| F-010 | 🔴 | `gouvernance lint` parse mal les listes YAML : `[AIAD-RGPD, AIAD-CRA]` → faux positifs `[AIAD-RGPD` / `AIAD-CRA]` | `npx aiad-sdd gouvernance lint` | Parser le frontmatter en YAML, pas regex sur la chaîne brute |
| F-011 | 🟠 | `dashboard` rapporte "Gouvernance 4/4" alors que `doctor` rapporte "5/5" (CRA inclus chez doctor, pas chez dashboard) | `npx aiad-sdd dashboard` + `doctor` | Aligner les deux sur le même comptage |
| F-012 | 🟠 | `status` affiche maturité "5/5 Complet" sur un projet **sans tests, sans hooks, sans git** | `status --json` après écriture des artefacts | Affiner le scoring : déprécier "Complet" tant que tests=0 ou hooks=absent |
| F-013 | 🔴 | `trace` ne reconnaît PAS les liens Intent ↔ SPEC déclarés en frontmatter (`intent: INTENT-001`) | `trace` → "Intents sans SPEC : 10" alors que tous mes SPECs déclarent leur Intent en frontmatter | Documenter explicitement le schéma : soit `**Intent parent** : INTENT-NNN` dans le corps (actuel), soit `intent: INTENT-NNN` en frontmatter (plus DX-friendly). Idéalement supporter les deux. |
| F-014 | 🟠 | `score` exige Ollama local — non documenté dans `SDDMode.md` ni dans `--help` | `npx aiad-sdd score intent INTENT-001` → `fetch failed` | Mentionner la dépendance Ollama dans `--help` et dans `SDDMode.md` § Commandes auxiliaires |
| F-015 | 🟡 | `sbom` échoue avec message brut si pas de `package.json` (le sandbox n'en a pas) | `npx aiad-sdd sbom` | Message d'aide : "Le SBOM requiert un `package.json` à la racine — utiliser `--from <chemin>` ou créer le manifeste" |
| F-016 | 🟢 | `bench` est excellent : montre +94 % d'économie tokens system prompt avec routers | `npx aiad-sdd bench` | **Confirmé** — pédagogique. Promouvoir cette commande dans le `init` post-install. |
| F-017 | 🟢 | `skills validate` est propre, listing clair | `npx aiad-sdd skills validate` | **Confirmé** — modèle de UX pour d'autres lints |
| F-018 | 🟢 | `dpia` et `ai-act audit` génèrent des squelettes utiles avec warning "humain requis" | `npx aiad-sdd dpia`, `ai-act audit` | **Confirmé** — bonne posture mixte humain/agent |
| F-019 | 🟡 | `refactor-spec` non documentée dans `SDDMode.md` mais utile (détection LOC > 200 / critères > 7) | `npx aiad-sdd refactor-spec <id>` | À ajouter dans la doc, c'est le couplage naturel avec `/sdd split` |
| F-020 | 🟠 | Les liens Intent→SPEC du frontmatter Intent (`spec_links: [SPEC-001-1-core-shortening]`) ne sont consommés par aucune commande visible | Aucune commande ne s'en sert | Soit documenter leur usage (ex: réservés à `/aiad health` pour détecter orphelins), soit retirer du template |
| F-021 | 🟡 | Pas de `git init` proposé par `init` alors que Drift Lock l'exige | `doctor` warn "pas de .git/" après init complet | Ajouter prompt "Initialiser un repo git maintenant ?" dans `init --interactive` |
| F-022 | 🟡 | `aiad-help` est défini comme 3ᵉ router dans CLAUDE.md mais ne contient aucune sous-commande (storybook : "Commandes /aiad-help : 0") | `storybook` summary | Soit retirer le router, soit ajouter de vraies sous-commandes (search, list, parcours) |
| F-023 | 🟠 | Aucune commande CLI ne mappe vers les rituels `/aiad-intention`, `/aiad-sync-strat`, `/aiad-standup`, `/aiad-demo`. Ils n'existent que côté Claude Code slash | Tenter `npx aiad-sdd intention` → 404 | Soit documenter clairement la dichotomie CLI vs slash, soit créer des stubs CLI qui ouvrent le canvas de préparation |
| F-024 | 🟡 | `reflect` et `negotiate` requièrent Ollama — friction silencieuse pour qui ne l'a pas | `--help` les liste sans flag prérequis | Tag `[Ollama requis]` dans `--help` à côté de chaque commande dépendante |
| F-025 | 🟡 | `sovereignty` recommande `--pack fr-anssi` mais la commande exacte d'installation n'est pas évidente depuis le message | `npx aiad-sdd sovereignty` | Préfixer chaque reco par la commande complète : `npx aiad-sdd gouvernance --pack fr-anssi` |

---

## Findings classés par axe

### Axe 1 — Cohérence documentaire (priorité 🔴)

`SDDMode.md` est l'entrée principale du framework (lien depuis le README, depuis `aiad.ovh`). Elle est à v1.6 alors que tout le reste est à v1.12+. Six versions majeures d'écart cachent au PE :

- **Routers v1.7** : la forme moderne est `/sdd <sub>`, pas `/sdd-<sub>`
- **Skills v1.9** : 8 skills automatiquement invoquées
- **Trace v1.10** + annotations `@intent`/`@spec`/`@verified-by`/`@governance`
- **EARS v1.11** avec `--ears` et linter strict
- **Multi-runtime v1.12** : Cursor, Codex, Copilot, Gemini
- **JNSP** : verdict "Je Ne Sais Pas" + exit code 2
- **CRA** : 5ᵉ agent Tier 1
- **Dual-mode `--guided` / `--fast`** sur toutes les commandes

→ **Suggestion d'action #1** : régénérer `SDDMode.md` depuis les sources (les commandes `.claude/sdd/*.md` sont elles-mêmes bien rédigées avec leur frontmatter `description:`). Le contenu existe, il faut le compiler.

→ **Suggestion d'action #2** : étendre `emit-rules` pour produire aussi un `SDDMode.md` versionné, ou ajouter `docs:check` dans le pipeline `prepublishOnly`.

### Axe 2 — Cohérence des décomptes (priorité 🟠)

Sur le même projet :
- Commandes slash : 27 (doc), 30 (--help), 32 (storybook) ⇒ trois sources, trois chiffres
- SPECs : 14 (doctor), 13 (trace), 13 (dashboard)
- Gouvernance : 4 (dashboard), 5 (doctor, status, status --json)
- Maturité SDD : "Complet 5/5" alors qu'il manque tests, git, hooks

→ **Suggestion #3** : factoriser un module `lib/counters.js` consommé par doctor/status/dashboard/trace/storybook, avec règles explicites (template exclu, draft vs ready, etc.).

→ **Suggestion #4** : raffiner le scoring de maturité — par exemple :
- 1 pt si artefacts fondamentaux
- 1 pt si ≥ 1 Intent
- 1 pt si ≥ 1 SPEC ready
- 1 pt si Drift Lock activé (hook + git)
- 1 pt si ≥ 1 test annoté `@verified-by`

Sans ce raffinement, le statut "Complet" est trompeur dès `init`.

### Axe 3 — Contrat de liaison Intent ↔ SPEC ↔ Code (priorité 🔴)

Trois mécanismes coexistent, deux ne sont pas consommés :

| Mécanisme | Source de vérité | Consommé par |
|-----------|------------------|--------------|
| `**Intent parent** : INTENT-NNN` dans le corps SPEC | Convention Markdown | `trace` ✅ |
| Frontmatter SPEC `intent: INTENT-NNN` | YAML | _aucun_ ❌ (F-013) |
| Frontmatter Intent `spec_links: [...]` | YAML | _aucun_ ❌ (F-020) |

Un PE qui rédige sa SPEC en `--fast` met naturellement la liaison en frontmatter (DX-friendly, machine-vérifiable). `trace` ne la voit pas → tous ses Intents apparaissent orphelins dans la matrice.

→ **Suggestion #5** : adopter le frontmatter comme source primaire (champ `intent:`), avec fallback sur la convention Markdown. Documenter explicitement dans le SDDMode.md.

→ **Suggestion #6** : `traceability` (skill) devrait expliciter ce contrat dans son SKILL.md.

### Axe 4 — Parsing du frontmatter (priorité 🔴)

`gouvernance lint` parse les listes `governance: [AIAD-RGPD, AIAD-CRA]` en regex naïve sur la chaîne — produit `[AIAD-RGPD` et `AIAD-CRA]` comme "agents manquants". 9 faux positifs sur 11 SPECs gouvernées.

→ **Suggestion #7** : utiliser un parser YAML standard (`yaml` lib déjà dans `node_modules` probablement). Pré-condition à un Drift Lock fiable, car la gouvernance bloque les PR.

### Axe 5 — Discoverability des dépendances externes (priorité 🟠)

Plusieurs commandes plantent silencieusement sans Ollama :
- `score`
- `reflect`
- `negotiate`
- `suggest-annotations`

D'autres exigent des prérequis non documentés :
- `sbom` → `package.json` à la racine
- `hooks` → `.git/`
- `review` → branche cible existante

→ **Suggestion #8** : tag `[REQUIRES: ollama|git|package.json]` dans `--help`, en colonne dédiée. Ou message d'erreur "doctor" agrégeant les prérequis manquants.

### Axe 6 — Dichotomie CLI vs slash (priorité 🟠)

Les rituels (`intention`, `sync-strat`, `standup`, `demo`, `retro`) sont **uniquement des slash commands**. La CLI ne les expose pas. Un PE qui scripte ses rituels (ex: cron de standup automatique en Slack) ne le voit pas explicité.

→ **Suggestion #9** : section explicite dans `SDDMode.md` "CLI vs Slash" indiquant quelles commandes vivent où, et pourquoi. Optionnel : stubs CLI qui ouvrent le canvas de prep (utile pour CI/CD).

---

## Confirmations positives (🟢)

- **Routers v1.7** : effet mesuré -94 % sur le system prompt. Excellente architecture.
- **Skills v1.9** : 8 skills validées sans erreur, modèle de DRY respecté.
- **EARS** : le template `spec-ears-template.md` est pédagogique et clair (R1-R7).
- **DPIA / AI-Act / Sovereignty / SBOM** : posture mixte humain/agent excellente — warnings "humain requis" présents.
- **Trace** génère 4 formats (md, json, html, sarif) — outillage industriel.
- **Bench** : visualise le bénéfice tangible des routers, devrait être promu dans le post-install.
- **Pii-scan** : fonctionne sans dépendance externe, output JSON-friendly.
- **JNSP** : posture honnête, exit code 2 dédié, pré-commit hook prêt — beau alignement avec la valeur "Human Authorship".

---

## Suggestions priorisées (backlog produit)

| Prio | Action | Effort | Impact |
|------|--------|--------|--------|
| P0 | Régénérer `SDDMode.md` depuis sources (commandes + CLAUDE.md template) | M | Très haut — recovers 6 versions de retard |
| P0 | Fixer `gouvernance lint` (parser YAML) | S | Très haut — débloque Drift Lock fiable |
| P0 | Atomiser `init` + lancer `emit-rules` systématique | S | Très haut — supprime un état corrompu silencieux |
| P0 | Documenter le contrat Intent↔SPEC↔Code et l'aligner sur frontmatter | M | Très haut — fonde la traceability |
| P1 | Factoriser `lib/counters.js` (doctor/status/dashboard/trace/storybook) | M | Élimine la confusion 24/27/30/32 |
| P1 | Raffiner le scoring maturité SDD | S | Crédibilise `status` et `doctor` |
| P1 | Tags `[REQUIRES: …]` dans `--help` | S | Évite les `fetch failed` aveugles |
| P2 | Section "CLI vs Slash" dans `SDDMode.md` | S | Clarifie le contrat outillage |
| P2 | Régénérer les `_index.md` en forme router | S | Évite la promotion des alias dépréciés |
| P2 | Prompt `git init` dans `init --interactive` | S | Préserve la promesse Drift Lock |
| P3 | Promouvoir `bench` dans le post-install | XS | Pédagogie sur les routers |
| P3 | Documenter `refactor-spec` dans SDDMode.md | XS | Couplage manquant avec `/sdd split` |
| P3 | Décider du sort de `aiad-help` (router vide) | XS | Cohérence |

Légende effort : XS < 1h · S < 4h · M < 2j · L < 1 semaine.

---

## Observation méta (pour Steeve)

Ton framework est plus mature que sa doc ne le laisse paraître. Le **vrai produit** est dans `.claude/sdd/*.md`, `.claude/skills/*/SKILL.md` et le CLAUDE.md template — qui sont bien écrits, à jour, avec mode dual `--guided/--fast`, JNSP, EARS, skills auto-déclenchées. **`SDDMode.md` est devenu un artefact secondaire qui est resté en arrière**.

Si le pipeline `release.js` ajoutait une étape "compiler SDDMode.md depuis les sources installées", tu rattraperais 6 versions d'un coup et tu n'aurais plus à le maintenir à la main.

Sur l'aspect "Human Authorship" : la simulation a poussé tous les `author:` à `PM-sim` / `PE-sim`. Aucune commande n'a relevé ce marquage explicite. Si tu veux durcir la skill `human-authorship-check`, elle pourrait reconnaître les patterns `*-sim`, `[SIMULATION]`, `bot-*` et émettre un avertissement (pas un veto — c'est légitime pour les tests).

---

*Rapport généré par simulation autonome. Aucun code n'a été exécuté en production. Tous les artefacts sont sous `bench/scenario-autonomous-run/url-shortener/`.*
