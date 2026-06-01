---
name: dashboard-html
description: Générer le dashboard HTML multi-pages du projet SDD Mode (dossier dashboard/)
---

# AIAD — Dashboard HTML

Tu es un Product Engineer AIAD. L'utilisateur veut produire le **dashboard HTML multi-pages** du projet — la vue d'ensemble pilotable d'un projet SDD Mode, complémentaire du `/aiad dashboard` ASCII utilisé en rituel d'équipe.

## Différence avec `/aiad dashboard`

| Commande | Format | Usage | Période |
|----------|--------|-------|---------|
| `/aiad dashboard` | ASCII (chat) | Rituel d'équipe (15-45 min) | Hebdo / mensuel |
| `/aiad dashboard-html` | HTML statique multi-pages | Pilotage continu (toujours dispo) | Snapshot live |

Le HTML est régénéré à la demande, lu dans un navigateur, pas un livrable de réunion.

## Pages produites

Le dashboard est produit dans `dashboard/` à la racine du projet :

| Page | Rôle |
|------|------|
| `index.html` | Vue d'ensemble : maturité, KPIs, SPECs récentes, changelog |
| `intents.html` | Catalogue des Intent Statements (statut, SPECs liées) |
| `specs.html` | Catalogue des SPECs (SQS, format prose/EARS, statut) |
| `traceability.html` | Matrice Forward / Backward + gaps détectés |
| `metrics.html` | DORA + Flow + Qualité depuis `.aiad/metrics/` |
| `governance.html` | Agents Tier 1 (AI-ACT / RGPD / RGAA / RGESN) |
| `drifts.html` | Drifts & facts capturés via `/sdd fact` |
| `changelog.html` | Historique des artefacts |

Plus :
- `dashboard/data.json` — dump complet (debug / intégration)
- `dashboard/assets/style.css` + `app.js` — assets partagés

## Comment exécuter

Cette commande est un **wrapper léger** sur la CLI `aiad-sdd dashboard`.

### 1. Inspecter `$ARGUMENTS`

Options reconnues :
- `--out <dir>` — dossier de sortie (défaut : `dashboard`)
- `--quiet` — pas de résumé console
- `--serve` — lance un serveur HTTP local après génération (défaut port 8765)
- `--port <n>` — port custom pour `--serve`
- `--source-base <url>` — préfixe les liens vers les `.md` sources (utile pour GitHub Pages)

### 2. Vérifier les pré-requis

Avec ton outil `Read`, vérifie :
- `.aiad/` existe → sinon propose `npx aiad-sdd init`
- `.aiad/intents/` et `.aiad/specs/` existent → sinon prévenir que les pages associées seront vides (pas bloquant)

### 3. Lancer la commande

Avec ton outil `Bash` :

```bash
npx aiad-sdd dashboard $ARGUMENTS
```

Exemples :

```bash
npx aiad-sdd dashboard                      # Dossier dashboard/
npx aiad-sdd dashboard --serve              # Génère puis sert sur 127.0.0.1:8765
npx aiad-sdd dashboard --serve --port 9000  # Port custom
npx aiad-sdd dashboard --out docs/dashboard # Dossier custom
npx aiad-sdd dashboard --quiet              # Sans résumé
```

### 3bis. Mode `--serve` — viewer local

Quand l'utilisateur demande à *voir* le dashboard (mobile, machine distante, navigateur sans accès file://), lance la commande avec `--serve`. Le serveur :
- Bind localhost uniquement (jamais d'exposition réseau)
- Aucune dépendance externe (module `http` natif)
- Sert le dossier `dashboard/` avec les bons MIME types
- Ctrl+C arrête proprement

Quand utiliser : itération rapide (modif SPEC → régen → reload) ; capture d'écran via MCP Playwright pour montrer dans Claude Code ; aperçu mobile via tunnel Tailscale / ngrok / cloudflared.

### 3ter. Publication GitHub Pages (sans serveur)

Pour rendre le dashboard accessible depuis n'importe où sans serveur local, le template `.github/workflows/aiad-dashboard.yml` :
- Régénère le dashboard à chaque push sur `main` (et changements `.aiad/**`)
- Utilise `--source-base "https://github.com/<owner>/<repo>/blob/<branch>/"` pour que les liens `.md` pointent vers le blob GitHub (rendu Markdown automatique)
- Publie via `actions/deploy-pages`

Pré-requis utilisateur : Settings → Pages → Source = **GitHub Actions**.

### 4. Annoncer le rendu

La sortie indique :
- Synthèse maturité + compte d'artefacts
- Liste des pages générées (chemins relatifs)
- Lien `file://` vers `index.html` à ouvrir dans un navigateur

### 5. Proposer la suite

Selon le contexte :
- **Premier usage** → suggère d'ouvrir `dashboard/index.html` et de jeter un œil à la maturité + traçabilité
- **Maturité < 3/5** → renvoie vers `/sdd init` ou `/aiad health` selon le gap
- **Gaps de traçabilité > 0** → renvoie vers `/sdd trace` + annotations `@spec` sur le code
- **Aucune metric** → suggère d'activer les rituels `/aiad standup`, `/aiad demo`, `/aiad retro` qui peuplent `.aiad/metrics/`
- **Dashboard à versionner** → discuter avec l'équipe : commit du dossier (transparence GitHub Pages) ou ajout au `.gitignore` (régénération à la demande)

## Critères de succès

- ✅ Dossier `dashboard/` créé à la racine avec 8 pages HTML + `data.json` + `assets/`
- ✅ Les pages s'ouvrent en mode statique (sans serveur) et la navigation fonctionne
- ✅ La page d'accueil reflète l'état réel du projet (maturité cohérente avec `npx aiad-sdd status`)
- ✅ La page traçabilité montre les mêmes gaps que `npx aiad-sdd trace`

## Règles

- Le dashboard HTML est **dérivé** — ne jamais l'éditer manuellement, il est écrasé à chaque génération
- Considère-le comme un **artefact de pilotage**, pas comme la source de vérité (les sources restent `.aiad/`)
- Régénère après tout changement notable d'artefact (nouvelle SPEC mergée, nouveau fact, mise à jour PRD…)
- Pour partager le dashboard avec des stakeholders non-développeurs, héberge-le via GitHub Pages, Netlify ou simplement un partage de dossier — il est 100 % statique

## Anti-patterns

- ❌ Éditer un fichier `dashboard/*.html` à la main → écrasement à la régénération
- ❌ Confondre `/aiad dashboard` (ASCII rituel) et `/aiad dashboard-html` (HTML pilotage) — usages distincts
- ❌ Présenter le HTML comme un substitut au rituel d'équipe — il informe la conversation, ne la remplace pas
- ❌ Oublier de relancer la commande après une SPEC mergée → données obsolètes affichées comme actuelles

$ARGUMENTS
