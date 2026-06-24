---
id: RESEARCH-027
title: Archivage automatique des artefacts done (Intents + SPECs)
intent: INTENT-026
author: Steeve Evers
date: 2026-06-24
status: go
---

# RESEARCH-027 — Archivage automatique des artefacts done

## Intent parent

INTENT-026 — l'humain veut une commande CLI qui déplace les artefacts
`status: done` hors des répertoires actifs, sans casser `trace`, `collect.js`
ni le dashboard.

---

## Discovery

> Agent Explore (read-only) — 2026-06-24

Ancrages code confirmés :

- `bin/aiad-sdd.js:95` — import archive.js (archiver, restaurer, listerLivrables)
- `bin/aiad-sdd.js:2549` — `case 'archive'` dispatch existant, à étendre avec branche `done`
- `lib/archive.js:137` — `archiver(racine, id, options)` — pipeline complet (move + frontmatter + audit + webhook)
- `lib/archive.js:332` — `listerLivrables(racine)` — filtre STATUTS_LIVRES, retourne `{ safe, id, kind }`
- `lib/dashboard/collect.js:44` — `listerFichiersMd(dir)` — lecture racine uniquement, pas de descente
- `lib/dashboard/collect.js:231` — `lireIntents(racineProjet)` — zéro changement requis
- `lib/sdd-trace.js:226` — `lireIntents()` dans trace — guard `archive/` implicite, à rendre explicite
- `lib/sdd-trace.js:251` — `lireSpecs()` dans trace — même situation
- `lib/sdd-trace.js:575` — filtre `!['draft','archived'].includes(s.status)` — déjà opérationnel
- `lib/review.js:56` — filtre `!f.includes('/archive/')` — déjà opérationnel
- `test/archive.test.js:117` — `archiver()` pipeline couvert
- `test/archive.test.js:297` — `listerLivrables()` couvert

### Zone 1 — Dispatcher CLI (`bin/aiad-sdd.js`)

**`bin/aiad-sdd.js:95`** — `lib/archive.js` déjà importé :
```js
import { archiver, restaurer, afficherListe, TYPES_ARTEFACTS } from '../lib/archive.js';
```

**`bin/aiad-sdd.js:2549–2602`** — `case 'archive'` existant, sous-commandes
`--list`, `--restore`, `--delivered`. Il suffit d'y ajouter une branche
`if (positionals[1] === 'done')`.

### Zone 2 — Noyau d'archivage (`lib/archive.js`)

**`lib/archive.js:332–363`** — `listerLivrables(racine)` :
- Lit `.aiad/intents/` et `.aiad/specs/` (exclut `archive/`)
- Filtre `STATUTS_LIVRES = ['done', 'delivered', 'livre', 'livré', 'closed', 'clos']`
- Retourne `{ id, kind, fichier, status, title, safe, raison }` par artefact
- `safe: false` si des annotations `@spec`/`@intent` pointent encore vers
  l'artefact dans le code source → signal de blocage conservé

**`lib/archive.js:137–213`** — `archiver(racine, id, options)` :
- Déplace, patche le frontmatter (`status: archived`, `archivedAt`, `archivedBy`,
  `archivedReason`), émet audit + webhook
- Supporte déjà `dryRun` ✓, `raison` ✓

**Manquant** : pas de fonction `archiverTous()` — à ajouter (~10 LOC) ou
à implémenter directement dans le dispatch CLI.

### Zone 3 — Collecte dashboard (`lib/dashboard/collect.js`)

**`lib/dashboard/collect.js:44–50`** — `listerFichiersMd(dir)` :
- Lit uniquement la racine du répertoire (pas de descente récursive)
- `archive/` n'est pas un fichier `.md` → **exclue naturellement**

**`lib/dashboard/collect.js:231–335`** — `lireIntents()` / `lireSpecs()` :
- Lecture racine uniquement — **zéro changement requis**

### Zone 4 — Traçabilité (`lib/sdd-trace.js`)

**`lib/sdd-trace.js:226–249`** — `lireIntents()` :
```js
for (const nom of readdirSync(dir)) {
  if (!nom.endsWith('.md') || nom.startsWith('_')) continue;
  // …
}
```
`readdirSync()` retourne aussi `'archive'` (dossier) ; `!nom.endsWith('.md')`
l'écarte, mais le filtre explicite `nom === 'archive'` est plus robuste.

**`lib/sdd-trace.js:575`** — Filtre de statut existant :
```js
.filter((s) => !['draft', 'archived'].includes(s.status))
```
→ Les artefacts `status: archived` sont déjà exclus du scope traçabilité.

**Changement requis** : ajout d'un guard `if (nom === 'archive') continue;`
dans `lireIntents()` et `lireSpecs()` (robustesse, ~2 LOC chacune).

### Zone 5 — Review (`lib/review.js:56–57`)

```js
intents: fichiers.filter((f) => … && !f.includes('/archive/')).sort(),
specs:   fichiers.filter((f) => … && !f.includes('/archive/') …).sort(),
```
→ **Déjà exclut `/archive/`** — zéro changement.

### Zone 6 — Infrastructure archive

Répertoires `.aiad/intents/archive/` et `.aiad/specs/archive/` : **existent
mais sont vides** — à utiliser tels quels.

### Zone 7 — Tests existants

**`test/archive.test.js:297–325`** — `listerLivrables()` couvert.
**`test/archive.test.js:117–163`** — `archiver()` pipeline complet couvert.
**`test/dashboard-collect.test.js`** — `lireIntents()` / `lireSpecs()` couvertes
mais sans cas de test explicite sur l'exclusion du dossier `archive/`.
**`test/trace.test.js`** — matrice couverte sans cas artefact archivé.

---

## Faisabilité

**Réalisable avec l'architecture actuelle.** Les briques critiques existent :
`lib/archive.js` (archiver, listerLivrables), le dispatch CLI `case 'archive'`
et les répertoires archive vides. L'impact net sur le code applicatif est faible :

| Fichier | Effort estimé |
|---------|---------------|
| `bin/aiad-sdd.js` | ~30 LOC — ajout branche `done` dans `case 'archive'` |
| `lib/archive.js` | ~10 LOC — fonction `archiverTous()` ou inline |
| `lib/sdd-trace.js` | ~4 LOC — guard explicite `archive/` dans 2 fonctions |
| Tests (`archive`, `collect`, `trace`) | ~40 LOC — 3 nouveaux cas |

**Zéro** changement sur `collect.js`, `review.js`, annotations `@spec`.

---

## Risques & inconnues

**R1 — Artefacts `safe: false`** : tranché par Steeve Evers (2026-06-24) — option A retenue :
archiver uniquement les `safe: true` ; ignorer silencieusement les `safe: false`
(ID encore référencé dans le code). À documenter dans la SPEC comme critère d'acceptation.

**R2 — Volume du premier run** : 21 intents + ~35 specs en `status: done`
dans les répertoires actifs. L'affichage de la liste avant confirmation
interactive est indispensable (contrainte déjà dans INTENT-026 — aucun archivage silencieux).

---

## Verdict humain attendu

> Vu le Discovery et les risques, quel est ton verdict ?
>
> - **GO** : on spécifie, pas d'inconnue bloquante.
> - **CONDITIONAL GO** : on spécifie, mais ces conditions doivent être levées.
> - **DEFER** : on reporte.
> - **NO-GO** : on n'y va pas.
>
> Confiance (0-100 %) ?

## Verdict

**GO — 90 %** (Steeve Evers, 2026-06-24)

Décision R1 : **option A** — archiver uniquement les artefacts `safe: true` ;
ignorer silencieusement les `safe: false` (ID encore référencé dans le code).

## Conditions (si CONDITIONAL GO)

_N/A — verdict GO franc._
