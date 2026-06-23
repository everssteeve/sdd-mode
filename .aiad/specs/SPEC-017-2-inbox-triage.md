# SPEC-017-2 — Inbox de triage facts/drifts (localStorage)

**Intent parent** : INTENT-017
**Auteur** : Steeve Evers
**Date** : 2026-06-22
**Statut** : done
**Format** : EARS
**SQS** : 5/5 — Gate OUVERTE (2026-06-22) — en attente de /sdd exec

---

## 1. Contexte

Les facts et drifts s'accumulent dans `.aiad/facts/` sans point de triage centralisé.
INTENT-017 introduit une page `inbox.html` dédiée permettant d'accepter ou différer
chaque élément via des actions client-side persistées en localStorage (C1 RESEARCH-023 :
pas de backend, site statique). La limitation de portabilité entre navigateurs est
documentée et assumée.

## 2. Comportement Attendu

### Input

- `.aiad/facts/*.md` — lus par `collect.js` (déjà existant)
- `donnees.drifts` — drifts détectés (déjà calculé par model)
- `localStorage` clé `aiad-inbox-{id}` → `"accepted"` | `"deferred"` | absent (= `"new"`)

### Processing

1. Calculateur `calculerInboxTriage(donnees)` dans `model/index.js` :
   - Agrège `donnees.facts` + `donnees.drifts` en liste unifiée `{id, type, titre, statut}`
   - Statut initial de chaque item = `"new"` (la résolution localStorage se fait côté client)
2. Renderer `blocInboxTriage(donnees)` dans `lib/dashboard/views/inbox.js` :
   - Génère la table HTML avec boutons Accept / Différer
   - Génère le JS inline (`<script>`) pour lire/écrire localStorage au clic
   - Génère les onglets de filtre (Tout / Nouveau / Accepté / Différé) en JS pur
3. Page complète `pageInbox(donnees, { layout })` exportée dans `lib/dashboard/views/inbox.js`

### Output

`inbox.html` — page statique avec :
- Table responsive listant facts + drifts (colonnes : ID, Type, Titre, Statut, Actions)
- Boutons "Accepter" et "Différer" par ligne, actifs côté client
- Onglets de filtre sans rechargement de page
- Badge compteur `(N nouveaux)` dans le titre de section

### Cas limites

- **localStorage indisponible** (navigation privée, quota dépassé) : boutons restent visibles, clic silencieux, avertissement `<p aria-live="polite">` affiché
- **Aucun fact ni drift** : table affiche `<p>Aucun élément en attente de triage.</p>`
- **Fact sans `id` frontmatter** : item ignoré par le calculateur, warning émis en console (pas d'erreur fatale)
- **Rechargement de la page** : états localStorage rechargés et appliqués au rendu initial via JS inline

## 3. Critères d'Acceptation (EARS)

### CA-001 — Liste unifiée facts et drifts

> Pattern : Ubiquitous

`The inbox calculator SHALL produce a unified list combining all items from \`donnees.facts\` and \`donnees.drifts\`, each with fields \`{ id, type, titre, statut: "new" }\`.`

- [x] Implémenté
- [x] Testé : `test/dashboard-inbox.test.js::CA-001`

### CA-002a — Persistance "Accepter" dans localStorage

> Pattern : Event-driven

`WHEN the user clicks the "Accepter" button for item \`{id}\`, the inbox client script SHALL write \`localStorage.setItem("aiad-inbox-{id}", "accepted")\`.`

- [x] Implémenté
- [x] Testé : `test/dashboard-inbox.test.js::CA-002a`

### CA-002b — Mise à jour label "Accepté"

> Pattern : Event-driven

`WHEN the user clicks the "Accepter" button for item \`{id}\`, the inbox client script SHALL update the row status label to "Accepté" without reloading the page.`

- [x] Implémenté
- [x] Testé : `test/dashboard-inbox.test.js::CA-002b`

### CA-003a — Persistance "Différer" dans localStorage

> Pattern : Event-driven

`WHEN the user clicks the "Différer" button for item \`{id}\`, the inbox client script SHALL write \`localStorage.setItem("aiad-inbox-{id}", "deferred")\`.`

- [x] Implémenté
- [x] Testé : `test/dashboard-inbox.test.js::CA-003a`

### CA-003b — Mise à jour label "Différé"

> Pattern : Event-driven

`WHEN the user clicks the "Différer" button for item \`{id}\`, the inbox client script SHALL update the row status label to "Différé" without reloading the page.`

- [x] Implémenté
- [x] Testé : `test/dashboard-inbox.test.js::CA-003b`

### CA-004a — Avertissement si localStorage indisponible

> Pattern : Unwanted behaviour

`IF \`localStorage\` throws on write, THEN the inbox client script SHALL display a \`<p aria-live="polite">\` warning "Actions de triage indisponibles (navigation privée ou quota dépassé).".`

- [x] Implémenté
- [x] Testé : `test/dashboard-inbox.test.js::CA-004a`

### CA-004b — Pas d'exception non interceptée si localStorage indisponible

> Pattern : Unwanted behaviour

`IF \`localStorage\` throws on write, THEN the inbox client script SHALL catch the exception without propagating it to the browser's uncaught-error handler.`

- [x] Implémenté
- [x] Testé : `test/dashboard-inbox.test.js::CA-004b`

### CA-005 — Filtrage par onglet client-side

> Pattern : Event-driven

`WHEN the user clicks a filter tab (Tout / Nouveau / Accepté / Différé), the inbox client script SHALL hide all rows whose status does not match the selected filter without reloading the page.`

- [x] Implémenté
- [x] Testé : `test/dashboard-inbox.test.js::CA-005`

### CA-006 — Inbox vide

> Pattern : Unwanted behaviour

`IF the unified list contains 0 items, THEN the inbox renderer SHALL display "Aucun élément en attente de triage." instead of an empty table.`

- [x] Implémenté
- [x] Testé : `test/dashboard-inbox.test.js::CA-006`

### CA-007a — Lecture localStorage au chargement

> Pattern : Event-driven

`WHEN the inbox page loads, the inbox client script SHALL read \`localStorage\` for each rendered item's key \`aiad-inbox-{id}\`.`

- [x] Implémenté
- [x] Testé : `test/dashboard-inbox.test.js::CA-007a`

### CA-007b — Application des labels stockés au chargement

> Pattern : Event-driven

`WHEN the inbox page loads, the inbox client script SHALL apply the stored status label from \`localStorage\` to each matching row before the first user interaction.`

- [x] Implémenté
- [x] Testé : `test/dashboard-inbox.test.js::CA-007b`

### CA-008 — Accessibilité RGAA AA

> Pattern : Ubiquitous

`The inbox renderer SHALL produce a \`<table>\` with a \`<caption>\`, \`<th scope="col">\` for each column, and each action button with an \`aria-label\` containing the item ID.`

- [x] Implémenté
- [x] Testé : `test/dashboard-inbox.test.js::CA-008`

## 4. Interface / API

```js
// lib/dashboard/views/inbox.js
export function calculerInboxTriage(donnees)         // → { items: [{id, type, titre, statut}] }
export function blocInboxTriage(donnees)             // → string HTML (section + table + script inline)
export function pageInbox(donnees, { layout })       // → string HTML (page complète)
```

Entrée dans `render.js` PAGES :
```js
{ slug: 'inbox', titre: 'Inbox', icone: '📥', file: 'inbox.html',
  builder: (d, opts) => pageInbox(d, opts) }
```

localStorage schema :
```
clé   : "aiad-inbox-{id}"        (ex: "aiad-inbox-FACT-003")
valeur: "accepted" | "deferred"  (absent = "new")
```

## 5. Dépendances

- `lib/dashboard/collect.js` — `donnees.facts`
- `lib/dashboard/model/index.js` — `donnees.drifts`, wiring calculateur inbox
- `lib/dashboard/render.js` — intégration PAGES
- `lib/dashboard/ui/helpers.js` — `escape()`
- SPEC-016-1 (architecture 4 couches) — prérequis livré
- RESEARCH-023 condition C1 — localStorage assumé, limitation documentée

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~300 tokens
- Cette SPEC : ~450 tokens
- Fichiers source pertinents : `collect.js` (498 LOC), `model/index.js` (306 LOC), `views/drifts.js` (référence rendu drifts)
- **Total estimé** : ~2 000 tokens

## 7. Definition of Output Done (DoOD)

- [x] `lib/dashboard/views/inbox.js` créé (≤ 220 LOC)
- [x] `render.js` PAGES mis à jour (1 ligne additive)
- [x] `model/index.js` — calculateur `calculerInboxTriage` ajouté
- [x] `test/dashboard-inbox.test.js` — 8 cas CA-001 à CA-008
- [x] **EARS lint : 0 violation** (skill `ears-validator`)
- [x] lint + tests passing (npm test)
- [x] Annotations `@spec SPEC-017-2` + `@verified-by` posées
- [x] Limitation localStorage documentée dans la page HTML (`<details>` ou note de bas de page)
- [x] Gouvernance vérifiée : RGAA (CA-008), RGPD (localStorage ne stocke pas de données personnelles)
