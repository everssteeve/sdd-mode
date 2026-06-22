# SPEC-017-1 — Page "Aujourd'hui" (radiator ≤ 4 sections)

**Intent parent** : INTENT-017
**Auteur** : Steeve Evers
**Date** : 2026-06-22
**Statut** : done
**Format** : EARS
**SQS** : 5/5 (gate 2026-06-22 — EARS 0 violation)
**Validé** : 2026-06-22

---

## 1. Contexte

INTENT-017 veut transformer le dashboard encyclopédie en radiateur quotidien.
La page "Aujourd'hui" est la page d'entrée du dashboard — lisible en 10 secondes,
limitée à 4 sections, sans scroll vertical sur un écran 1080p standard (1920×1080).
Dépend de INTENT-016 (architecture 4 couches livrée).

## 2. Comportement Attendu

### Input

`donnees` : objet enrichi par `model/index.js` contenant :
- `donnees.standupScript` — script standup du jour (calculé par `standup-script.js`)
- `donnees.intents` — liste brute des Intents ; filtrée P0/P1 actifs via `topPriorites(donnees.intents, 3)`
  depuis `lib/dashboard/intent-priority.js` (structure item : `{ id, titre, statut, priority, file }`)
- `donnees.deadlines` — Intents avec date cible calculés par `calculerEcheances`
  (structure item : `{ id, titre, targetDate, joursRestants }`)
- `donnees.riskTransparency.items` — risques enrichis par `calculerRiskTransparency`
  (items non couverts : `.filter(i => !i.couvert).slice(0, 3)`)
  (structure item : `{ id, titre, niveau, couvert, mitigation }`)

### Processing

1. Appeler `topPriorites(donnees.intents, 3)` (import `intent-priority.js`) → section Priorités du jour
2. Lire `donnees.deadlines` filtrées à `joursRestants ≤ 7` → section Échéances proches
3. Lire `donnees.riskTransparency.items.filter(i => !i.couvert).slice(0, 3)` → section Risques découverts
4. Lire `donnees.standupScript.texte` → section Script standup
5. Assembler en `<section>` × 4 via `construirePageAujourdhui(donnees)`
6. Retourner page complète via `pageAujourdhui(donnees)` + layout existant

### Output

`today.html` — page statique dans `outDir/` avec :
- Titre `<h1>Aujourd'hui · YYYY-MM-DD</h1>`
- 4 sections (`<section aria-label="…">`) avec leur propre `<h2>`
- Pas de scroll vertical sur viewport 1920×1080 (max-height: 100vh sur le conteneur)

### Cas limites

- **Aucun Intent P0/P1 actif** : section Priorités affiche `<p>Aucun bloquant aujourd'hui.</p>`
- **Aucune deadline ≤ 7 jours** : section Échéances affiche `<p>Aucune échéance imminente.</p>`
- **Standup script vide** : section affiche `<p>Script non disponible — relance le dashboard.</p>`
- **Top risques vide** : section Risques affiche `<p>Aucun risque découvert non couvert.</p>`

## 3. Critères d'Acceptation (EARS)

### CA-001 — Exactement 4 sections

> Pattern : Ubiquitous

`The today-page renderer SHALL produce exactly 4 \`<section>\` elements inside the page body.`

- [ ] Implémenté
- [ ] Testé : `test/dashboard-today.test.js::CA-001`

### CA-002 — Priorités triées P0 avant P1

> Pattern : Ubiquitous

`The today-page renderer SHALL list top-3 active Intents ordered by priority (P0 before P1, then by date ascending).`

- [ ] Implémenté
- [ ] Testé : `test/dashboard-today.test.js::CA-002`

### CA-003 — Aucun bloquant quand liste vide

> Pattern : Unwanted behaviour

`IF no active P0 or P1 Intent exists, THEN the today-page renderer SHALL display "Aucun bloquant aujourd'hui." in the Priorités section.`

- [ ] Implémenté
- [ ] Testé : `test/dashboard-today.test.js::CA-003`

### CA-004 — Échéances filtrées à 7 jours

> Pattern : Ubiquitous

`The today-page renderer SHALL include only Intents whose \`targetDate\` falls within 7 calendar days of the generation date in the Échéances section.`

- [ ] Implémenté
- [ ] Testé : `test/dashboard-today.test.js::CA-004`

### CA-005 — Placeholder standup absent

> Pattern : Unwanted behaviour

`IF the standup script text is empty or undefined, THEN the today-page renderer SHALL display "Script non disponible — relance le dashboard." in the Script standup section.`

- [ ] Implémenté
- [ ] Testé : `test/dashboard-today.test.js::CA-005`

### CA-006a — Sections accessibles (aria-label)

> Pattern : Ubiquitous

`The today-page renderer SHALL produce HTML where every \`<section>\` element has an \`aria-label\` attribute.`

- [ ] Implémenté
- [ ] Testé : `test/dashboard-today.test.js::CA-006a`

### CA-006b — Hiérarchie de titres séquentielle

> Pattern : Ubiquitous

`The today-page renderer SHALL produce HTML where every heading element follows a sequential hierarchy (h1 then h2, no skipped levels).`

- [ ] Implémenté
- [ ] Testé : `test/dashboard-today.test.js::CA-006b`

### CA-007a — Wiring PAGES array

> Pattern : Ubiquitous

`The dashboard generator SHALL include an entry with slug "today" in the PAGES array.`

- [ ] Implémenté
- [ ] Testé : `test/dashboard.test.js::CA-007a`

### CA-007b — Écriture today.html

> Pattern : Ubiquitous

`The dashboard generator SHALL write \`today.html\` to the output directory on each run.`

- [ ] Implémenté
- [ ] Testé : `test/dashboard.test.js::CA-007b`

## 4. Interface / API

```js
// lib/dashboard/views/today.js
export function construirePageAujourdhui(donnees)  // → string HTML (body uniquement)
export function pageAujourdhui(donnees, { layout }) // → string HTML (page complète)
```

Entrée dans `render.js` PAGES :
```js
{ slug: 'today', titre: "Aujourd'hui", icone: '⊙', file: 'today.html',
  builder: (d, opts) => pageAujourdhui(d, opts) }
```

## 5. Dépendances

- `lib/dashboard/model/index.js` — `donnees.standupScript`, `donnees.deadlines`, `donnees.riskTransparency`
- `lib/dashboard/intent-priority.js` — `topPriorites()`, `lirePriorite()` (import direct dans today.js)
- `lib/dashboard/render.js` — intégration PAGES
- `lib/dashboard/ui/helpers.js` — `escape()`
- SPEC-016-1 (architecture 4 couches) — prérequis livré

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~300 tokens
- Cette SPEC : ~400 tokens
- Fichiers source pertinents : `render.js` (112 LOC), `standup-script.js` (136 LOC), `model/index.js` (306 LOC), `views/overview.js` (299 LOC comme référence)
- **Total estimé** : ~1 800 tokens

## 7. Definition of Output Done (DoOD)

- [ ] `lib/dashboard/views/today.js` créé (≤ 180 LOC)
- [ ] `render.js` PAGES mis à jour (1 ligne additive)
- [ ] Aucune modification de `model/index.js` (`topPriorites` importée directement dans `today.js`)
- [ ] `test/dashboard-today.test.js` — 7 cas CA-001 à CA-007
- [ ] **EARS lint : 0 violation** (skill `ears-validator`)
- [ ] lint + tests passing (npm test)
- [ ] Annotations `@spec SPEC-017-1` + `@verified-by` posées
- [ ] Gouvernance vérifiée : RGAA (CA-006), RGESN (budget SPEC-016-4 non impacté)
