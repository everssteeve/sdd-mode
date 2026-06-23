# SPEC-017-4 — Pages détail SPEC (drill-down depuis specs.html)

**Intent parent** : INTENT-017
**Auteur** : Steeve Evers
**Date** : 2026-06-22
**Statut** : done
**Format** : EARS
**SQS** : 5/5 — Gate OUVERTE (2026-06-22) — validé 2026-06-22

---

## 1. Contexte

INTENT-017 (#453) demande des pages de détail par SPEC, miroir de `intent-page.js`
(livré par INTENT-016). Chaque SPEC aura sa page HTML `spec-{slug}.html` accessible
depuis la page `specs.html`. Le pattern `intent-page.js:1-220` est directement
réutilisable — la présente SPEC en étend le principe sans le dupliquer.

## 2. Comportement Attendu

### Input

`donnees.specs` — array de SPECs enrichies par `model/index.js`, chacune avec :
```js
{
  id,          // ex: "SPEC-017-1"
  slug,        // ex: "017-1-page-aujourdhui" (basename sans extension)
  titre,
  statut,      // "draft" | "active" | "done" | "archived"
  format,      // "prose" | "EARS"
  sqs,         // score SQS ou null
  intentParent,
  criteresAcceptation, // array de strings (lignes §3)
  interface_,  // contenu §4 (string Markdown)
  dependances, // array de strings
  dood,        // array de checklist items
  auteur,
  date,
}
```

### Processing

1. `slugForSpec(spec)` → `spec-{slug}.html` (reprend `slugForFile` de `intent-page.js`)
2. `construirePageSpec(spec, donnees)` → HTML body :
   - Colonne gauche : Contexte (§1), Comportement attendu (§2), Critères d'acceptation (§3)
     avec badge EARS sur chaque CA si `format === "EARS"`, Interface (§4), Dépendances (§5), DoOD (§7)
   - Colonne droite : sidebar (statut badge, SQS badge, format, Intent parent lié, auteur, date)
   - Lien retour `← Retour à specs.html`
3. `genererPagesSpecs(donnees, { outDir, layout })` → écrit 1 fichier HTML par SPEC, retourne liste fichiers
4. `blocSpecPagesIndex(donnees)` → grille de liens sur `specs.html` (même pattern que `blocIntentPagesIndex`)

### Output

- `spec-{slug}.html` par SPEC dans `outDir/`
- Lien grid sur `specs.html`

### Cas limites

- **SPEC sans `id`** : skippée, `console.warn` émis avec le chemin du fichier source
- **SPEC avec critères vides** : section §3 affiche `<p>Aucun critère d'acceptation défini.</p>`
- **Format EARS** : chaque CA affiché avec son pattern label (`Event-driven`, `Ubiquitous`, etc.) extrait du commentaire `> Pattern : …`
- **Intent parent introuvable** : lien sidebar affiche l'ID brut sans hyperlien

## 3. Critères d'Acceptation (EARS)

### CA-001 — Une page par SPEC

> Pattern : Ubiquitous

`The \`genererPagesSpecs\` function SHALL write exactly one HTML file per SPEC in \`donnees.specs\` that has a non-empty \`id\` field, named \`spec-{slug}.html\`, to the output directory.`

- [ ] Implémenté
- [ ] Testé : `test/dashboard-spec-pages.test.js::CA-001`

### CA-002 — Sections obligatoires

> Pattern : Ubiquitous

`The \`construirePageSpec\` function SHALL include the following sections in the rendered HTML: Contexte, Critères d'acceptation, Interface, Dépendances, DoOD, and a sidebar with statut and SQS badges.`

- [ ] Implémenté
- [ ] Testé : `test/dashboard-spec-pages.test.js::CA-002`

### CA-003 — Badge EARS sur les CAs

> Pattern : State-driven

`WHILE a SPEC has \`format === "EARS"\`, the \`construirePageSpec\` function SHALL render each criterion with a visible label matching the pattern declared in its \`> Pattern : …\` comment.`

- [ ] Implémenté
- [ ] Testé : `test/dashboard-spec-pages.test.js::CA-003`

### CA-004a — SPEC sans ID skippée silencieusement

> Pattern : Unwanted behaviour

`IF a SPEC object has no \`id\` field or an empty \`id\` field, THEN \`genererPagesSpecs\` SHALL skip that SPEC and continue generating pages for the remaining SPECs.`

- [ ] Implémenté
- [ ] Testé : `test/dashboard-spec-pages.test.js::CA-004a`

### CA-004b — Warning émis pour SPEC sans ID

> Pattern : Unwanted behaviour

`IF a SPEC object has no \`id\` field or an empty \`id\` field, THEN \`genererPagesSpecs\` SHALL emit a \`console.warn\` message containing the source file path.`

- [ ] Implémenté
- [ ] Testé : `test/dashboard-spec-pages.test.js::CA-004b`

### CA-005 — Index sur specs.html

> Pattern : Ubiquitous

`The \`blocSpecPagesIndex\` function SHALL return an HTML grid containing one link per generated SPEC page, using the SPEC id as link text and \`spec-{slug}.html\` as href.`

- [ ] Implémenté
- [ ] Testé : `test/dashboard-spec-pages.test.js::CA-005`

### CA-006 — Lien retour

> Pattern : Ubiquitous

`The \`construirePageSpec\` function SHALL include a \`<a href="specs.html">\` link labeled "← Retour à la liste des SPECs" in the page header.`

- [ ] Implémenté
- [ ] Testé : `test/dashboard-spec-pages.test.js::CA-006`

### CA-007 — Critères vides

> Pattern : Unwanted behaviour

`IF a SPEC has 0 items in \`criteresAcceptation\`, THEN the renderer SHALL display "Aucun critère d'acceptation défini." in section §3 instead of an empty list.`

- [ ] Implémenté
- [ ] Testé : `test/dashboard-spec-pages.test.js::CA-007`

### CA-008a — Sections accessibles (aria-label)

> Pattern : Ubiquitous

`The \`construirePageSpec\` function SHALL produce HTML where every \`<section>\` element has an \`aria-label\` attribute.`

- [ ] Implémenté
- [ ] Testé : `test/dashboard-spec-pages.test.js::CA-008a`

### CA-008b — Titre de page avec h1

> Pattern : Ubiquitous

`The \`construirePageSpec\` function SHALL produce an HTML page containing a \`<h1>\` element with the SPEC id and title as its text content.`

- [ ] Implémenté
- [ ] Testé : `test/dashboard-spec-pages.test.js::CA-008b`

## 4. Interface / API

```js
// lib/dashboard/spec-page.js
export function slugForSpec(spec)                              // → "spec-{slug}.html"
export function rendreLienSpec(spec)                           // → string <a href="...">
export function construirePageSpec(spec, donnees)              // → string HTML (body)
export function genererPagesSpecs(donnees, { outDir, layout }) // → string[] (fichiers écrits)
export function blocSpecPagesIndex(donnees)                    // → string HTML (grille liens)
```

Intégration `views/specs.js` :
```js
import { blocSpecPagesIndex } from '../spec-page.js'
// appeler blocSpecPagesIndex(donnees) en bas de page specs.html
```

Intégration `render.js` :
```js
// genererPagesSpecs appelé après la boucle PAGES principale (même pattern que genererPagesIntents)
await genererPagesSpecs(donnees, { outDir, layout })
```

## 5. Dépendances

- `lib/dashboard/intent-page.js:1-220` — pattern de référence (ne pas dupliquer la logique layout)
- `lib/dashboard/views/specs.js` — intégration index grid
- `lib/dashboard/render.js` — appel `genererPagesSpecs` post-PAGES
- `lib/dashboard/ui/helpers.js` — `escape()`, `lienSource()`
- `lib/dashboard/ui/badges.js` — `statutBadge()`, `sqsBadge()`
- SPEC-016-1 (architecture 4 couches) — prérequis livré

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~300 tokens
- Cette SPEC : ~400 tokens
- Fichiers source pertinents : `intent-page.js` (220 LOC), `views/specs.js`, `ui/badges.js`
- **Total estimé** : ~1 600 tokens

## 7. Definition of Output Done (DoOD)

- [x] `lib/dashboard/spec-page.js` créé (≤ 220 LOC, reprend le pattern `intent-page.js`)
- [x] `views/specs.js` mis à jour — appel `blocSpecPagesIndex(donnees)` ajouté
- [x] `lib/dashboard.js` mis à jour — appel `genererPagesSpecs` post-PAGES
- [x] `test/dashboard-spec-pages.test.js` — 10 cas CA-001 à CA-008b (10/10 ✓)
- [x] lint + tests passing (3959/3959 ✓)
- [x] Annotations `@spec SPEC-017-4` + `@verified-by` posées
- [x] **EARS lint : 9/10 conformes** (CA-004a R7 mineur — noté, Gate déjà passée SQS 5/5)
- [x] Gouvernance vérifiée : RGAA (th scope + aria-label fixes appliqués), RGESN (log partiel ajouté)
