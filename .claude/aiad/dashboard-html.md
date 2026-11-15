---
name: dashboard-html
description: Générer le dashboard HTML multi-pages du projet SDD Mode (dossier dashboard/)
---

# AIAD — Dashboard HTML

Tu es un Product Engineer AIAD. L'utilisateur veut produire le **dashboard HTML multi-pages** du projet — la vue d'ensemble pilotable d'un projet SDD Mode, complémentaire du `/aiad dashboard` ASCII utilisé en rituel d'équipe.

**Recommandation modèle** : Haiku 4.5 — génération HTML depuis les données métriques persistées.
👉 `/model claude-haiku-4-5-20251001` — génération HTML depuis les métriques persistées.

## Différence avec `/aiad dashboard`

| Commande | Format | Usage | Période |
|----------|--------|-------|---------|
| `/aiad dashboard` | ASCII (chat) | Rituel d'équipe (15-45 min) | Hebdo / mensuel |
| `/aiad dashboard-html` | HTML statique multi-pages | Pilotage continu (toujours dispo) | Snapshot live |

Le HTML est régénéré à la demande, lu dans un navigateur, pas un livrable de réunion.

## Pages produites

Le dashboard est produit dans `dashboard/` à la racine du projet :

Six onglets : une vue d'ensemble de l'application en cours de développement, puis un onglet par responsabilité AIAD. Les pages d'un onglet forment sa sous-navigation.

| Onglet | Pages | Ce qu'on y trouve |
|--------|-------|-------------------|
| **Vue d'ensemble** | `index.html`, `today.html`, `inbox.html`, `changelog.html`, `onboarding.html` | État global : maturité, santé, cycle SDD en six étapes, une carte par responsabilité, alertes |
| **Product Manager** | `pm.html`, `intents.html` | Cockpit PM, Intent Statements |
| **Product Engineer** | `pe.html`, `specs.html`, `kanban.html`, `traceability.html`, `drifts.html` | SPECs, Execution Gate, traçabilité, Drift Lock, facts |
| **Agents Engineer** | `ae.html`, `governance.html`, `eco.html` | Équipe d'agents et sa conformité au registre, skills, gouvernance Tier 1, hooks, impact écologique |
| **QA Engineer** | `qa.html`, `legal.html`, `dpo.html` | File de validation, couverture, EARS, conformité |
| **Tech Lead** | `tl.html`, `adrs.html`, `metrics.html`, `sre.html`, `graph.html` | Architecture, ADR, dette, DORA & Flow, sécurité |

Chaque cockpit de rôle s'ouvre sur la carte de son assistant (`claude --agent aiad-<rôle>`) et liste les signaux qui attendent une décision sur son périmètre. L'onglet porte une pastille quand il y en a. Un chiffre non mesuré s'affiche « — ».

**Mesure d'usage.** Le serveur local (`--serve`) compte les pages consultées, par jour et par onglet, dans `.aiad/metrics/dashboard-usage/` — un jour, un compteur, rien d'autre : ni adresse IP, ni navigateur, ni heure, et rien ne quitte la machine. La vue d'ensemble affiche les consultations des 30 derniers jours et signale un dashboard non consulté depuis plus de 14 jours. Un dashboard ouvert en fichier statique ou publié n'est pas compté : « non mesuré » ne veut pas dire « non utilisé ». Désactivation : `AIAD_DASHBOARD_USAGE=0`.

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

- ✅ Dossier `dashboard/` créé à la racine avec la vue d'ensemble, les cinq cockpits de rôle et leurs pages + `data.json` + `assets/`
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
