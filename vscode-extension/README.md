# AIAD SDD pour VS Code

> Découverte des Intent Statements et SPECs dans la sidebar VS Code, navigation `@spec` → `.aiad/specs/SPEC-XXX.md` via CodeLens, validation du frontmatter à la sauvegarde. **Sans dépendance lourde** — utilise simplement `npx aiad-sdd` sous le capot.

Cible principale : équipes EU qui utilisent VS Code (et non Claude Code) mais veulent quand même la rigueur AIAD.

## Installation

Pour tester localement (avant publication marketplace) :

```bash
cd vscode-extension/
npm install -g @vscode/vsce
vsce package
# Puis dans VS Code : Cmd+Shift+P → "Install from VSIX..."
```

## Fonctionnalités

### Sidebar AIAD SDD

Une icône dédiée dans l'activity bar avec deux vues :
- **Intent Statements** — la liste de tes `.aiad/intents/INTENT-*.md`. Clic = ouvrir.
- **SPECs** — la liste de tes `.aiad/specs/SPEC-*.md` (template EARS exclu). Clic = ouvrir.

Bouton de refresh + bouton "Ouvrir la matrice de traçabilité" (génère la matrice si absente).

### CodeLens sur `@spec`

Toute annotation `@spec SPEC-NNN-N-slug` dans ton code (TS/JS/Python/Rust/Go/Java/Kotlin/C#/Ruby) affiche un lien cliquable :
- `→ SPEC-042-1-flow-auth` quand la SPEC existe → ouverture immédiate.
- `⚠ SPEC-042-1-flow-auth (manquante)` quand orpheline → propose `aiad-sdd trace --suggest`.

### Validation à la sauvegarde

À la sauvegarde d'une SPEC dans `.aiad/specs/`, vérifie la présence des champs frontmatter critiques (`parent_intent`, `status`). Affiche un warning non-bloquant si manquants.

### Commandes

| Commande | Description |
|----------|-------------|
| `AIAD : Rafraîchir Intents et SPECs` | Refresh manuel des arbres |
| `AIAD : Ouvrir la matrice de traçabilité` | Ouvre `trace.md` (génère si absent) |
| `AIAD : Lancer doctor` | Diagnostic unifié dans un terminal |
| `AIAD : Aller à la SPEC` | Navigation depuis CodeLens |

### Configuration

| Réglage | Défaut | Description |
|---------|--------|-------------|
| `aiad-sdd.aiadSddPath` | `""` | Chemin vers `aiad-sdd` (défaut `npx aiad-sdd`) |
| `aiad-sdd.autoTraceOnSave` | `false` | Lance `trace --json` à chaque sauvegarde de SPEC |

## Architecture

L'extension est volontairement légère :
- 1 fichier `src/extension.js` (~200 LOC, CommonJS)
- Aucune dépendance npm runtime
- Pas de TypeScript (pas de build)
- Délègue toute la logique métier au CLI `aiad-sdd`

C'est cohérent avec la philosophie zero-dep du framework principal.

## Maintenance

Cette extension vit dans le repo `aiad-sdd` : `vscode-extension/`. Pour signaler un bug : [issue GitHub](https://github.com/everssteeve/sdd-mode/issues).
