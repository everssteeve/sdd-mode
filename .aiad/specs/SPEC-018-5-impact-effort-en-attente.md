# SPEC-018-5 — Matrice Impact × Effort des Intents en attente

**Intent parent** : INTENT-018
**Auteur** : Steeve Evers
**Date** : 2026-06-23
**Statut** : validation
**Format** : prose
**SQS** : 5/5

---

## 1. Contexte

La matrice RICE existante (`rice-matrix.js`) affiche tous les Intents confondus. Pour prioriser le backlog futur, le PM a besoin d'une vue focalisée sur les Intents **en attente** (non démarrés et non terminés), ordonnée par ratio Impact/Effort. SPEC-018-5 est un filtre + relabellisation sur l'infrastructure RICE existante — effort minimal.

## 2. Comportement Attendu

### Input

- `donnees.intents` — tableau complet des Intents enrichis
- `donnees.riceMatrix` — résultat existant de `calculerRiceMatrix()` (scores RICE par Intent)

### Processing

1. Filtrer `donnees.riceMatrix.items` pour ne conserver que les Intents dont le statut est **hors** `['done', 'archived', 'active', 'in-progress']` — c'est-à-dire `statut in ['draft', 'blocked', 'deferred']` ou statut absent.
2. Trier par `scoreRice` décroissant (Quick Wins en haut).
3. Si le filtre donne 0 item → liste vide, message « Aucun Intent en attente de priorisation ».
4. Produire `donnees.impactEffortEnAttente` avec les items filtrés + métadonnées de contexte.

Aucune modification du calcul RICE existant — lecture seule sur `donnees.riceMatrix`.

### Output

```js
donnees.impactEffortEnAttente = {
  items: [
    {
      id: string,
      titre: string,
      statut: string,
      scoreRice: number,
      scoreImpact: number,
      scoreEffort: number,
      quadrant: 'quick-win' | 'big-bet' | 'fill-in' | 'time-sink',
    }
  ],
  total: number,
  message: string | null,  // non null si 0 items
}
```

**Rendu HTML** `blocImpactEffortEnAttente(donnees)` :
- Tableau HTML trié par `scoreRice` décroissant avec colonnes : Intent | Impact | Effort | Score | Quadrant
- `<table>` avec `<caption>Intents en attente — Impact × Effort</caption>`, `<thead>`, `<th scope="col">`, `<tbody>`
- Badge textuel pour le quadrant (Quick Win / Big Bet / Fill-in / Time-sink) — pas de couleur seule
- Lien vers la page détail de l'Intent si disponible
- Si 0 items : message centré, pas de tableau vide

### Cas limites

- **0 Intent en attente** : `items = []`, `message = "Aucun Intent en attente de priorisation"`.
- **Intent sans score RICE** (champs `rice` absents du frontmatter) : inclus avec `scoreRice = 0`, affiché en bas du tableau.
- **`donnees.riceMatrix` absent** : `donnees.impactEffortEnAttente = { items: [], total: 0, message: "Scores RICE non calculés" }`.
- **Tous les Intents sont done/active** : 0 items retournés (cas normal en fin de release).

## 3. Critères d'Acceptation

- [ ] `calculerImpactEffortEnAttente(donnees)` retourne uniquement les Intents dont `statut` n'est pas dans `['done', 'archived', 'active', 'in-progress']`.
- [ ] Les items sont triés par `scoreRice` décroissant.
- [ ] Un jeu de 5 Intents (2 done, 1 active, 1 draft, 1 deferred) retourne exactement 2 items.
- [ ] Si `donnees.riceMatrix` est absent ou vide, retourner `{ items: [], total: 0, message: "..." }` sans erreur.
- [ ] `blocImpactEffortEnAttente(donnees)` produit un `<table>` avec `<caption>`, `<thead>`, `<th scope="col">`.
- [ ] Si 0 items, un message textuel est affiché (pas de `<table>` vide).
- [ ] axe-core 0 violation RGAA AA sur le bloc rendu.

## 4. Interface / API

```js
// lib/dashboard/rice-matrix.js (extension — lecture seule sur riceMatrix existant)

/**
 * @intent INTENT-018
 * @spec SPEC-018-5-impact-effort-en-attente
 */
export function calculerImpactEffortEnAttente(donnees) { /* filtre + tri */ }
export function blocImpactEffortEnAttente(donnees) { /* → string HTML */ }
```

Injection dans `model/index.js` :
```js
donnees.impactEffortEnAttente = calculerImpactEffortEnAttente(donnees);
// après donnees.riceMatrix (déjà calculé)
```

## 5. Dépendances

- `lib/dashboard/rice-matrix.js:22,44` — `scoreImpact()`, `scoreEffort()`, `calculerRiceMatrix()` — utilisés en lecture seule
- `lib/dashboard/model/index.js` — injection après `riceMatrix`
- `lib/dashboard/schema/data-v2.schema.json` — déclarer `impactEffortEnAttente`
- Aucune dépendance sur les autres SPECs-018 (parallélisable avec SPEC-018-1 en Wave 1)

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~400 tokens
- Cette SPEC : ~400 tokens
- Fichiers source : `rice-matrix.js:1-50` (~50 lignes pertinentes), `model/index.js` (injection)
- **Total estimé** : ~1 000 tokens (SPEC légère)

## 7. Definition of Output Done (DoOD)

- [ ] `calculerImpactEffortEnAttente()` et `blocImpactEffortEnAttente()` ajoutés à `rice-matrix.js`
- [ ] Injection dans `model/index.js`
- [ ] Schéma `data-v2.schema.json` étendu (`impactEffortEnAttente`)
- [ ] Test unitaire dans `test/dashboard-pm-v*.test.js` (ou nouveau) : 5 Intents → 2 en attente retournés
- [ ] axe-core 0 violation sur le tableau
- [ ] `@spec SPEC-018-5` posé dans les fichiers touchés
- [ ] `_index.md` mis à jour
- [ ] `npx aiad-sdd drift-check` OK
