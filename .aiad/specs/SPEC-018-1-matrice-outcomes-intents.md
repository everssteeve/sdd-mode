# SPEC-018-1 — Matrice outcomes ↔ Intents

**Intent parent** : INTENT-018
**Auteur** : Steeve Evers
**Date** : 2026-06-23
**Statut** : done
**Format** : prose
**SQS** : 5/5 — Gate OUVERTE

---

## 1. Contexte

INTENT-018 veut relier les outcomes du PRD aux Intents qui y contribuent, pour que le PM voie non plus seulement l'activité (specs fermées) mais la valeur produite (quel outcome progresse, grâce à quel Intent). L'infrastructure de base existe (`outcome-attribution.js`, `outcomes.js`) mais ne trace que la direction outcome → specs ; il manque la liaison inverse Intent → outcomes.

## 2. Comportement Attendu

### Input

- `donnees.outcomes` : tableau d'outcomes parsés depuis `PRD.md` (via `lireOutcomes()`) — champs : `titre`, `criteres`, `baseline`, `cible`, `ratio`
- `donnees.intents` : tableau d'Intents enrichis (via `collect.js`) — champs existants : `id`, `statut`, `outcomes` (tableau de noms d'outcomes déclarés en frontmatter), `specs`
- `donnees.outcomeAttribution` : résultat existant de `calculerOutcomeAttribution()` (specs livrées par outcome)

### Processing

1. Construire un index `intentParOutcome : Map<string, Intent[]>` :
   - Pour chaque Intent, lire le champ frontmatter `outcomes` (tableau de slugs ou titres d'outcomes).
   - Normaliser chaque valeur (minuscule, sans accents) et joindre sur `donnees.outcomes[].titre` normalisé.
   - Enregistrer l'Intent dans `intentParOutcome[outcomeTitre]`.
2. Pour chaque outcome, enrichir l'objet `outcomeAttribution` existant avec :
   - `intentsContributeurs : { id, titre, statut }[]` — Intents qui déclarent contribuer à cet outcome.
   - `intentsActifs : number` — count(statut in [`active`, `in-progress`]).
   - `intentsTermines : number` — count(statut `done`).
3. Produire `donnees.matriceOutcomesIntents` (tableau d'items enrichis).
4. Pas de modification des structures existantes (`donnees.outcomes`, `donnees.outcomeAttribution`) — extension non destructive.

### Output

```js
donnees.matriceOutcomesIntents = [
  {
    outcomeTitre: string,       // titre outcome du PRD
    ratio: number,              // 0–1, depuis outcomeAttribution existant
    specsLivrees: number,
    specsTotal: number,
    intentsContributeurs: [
      { id: string, titre: string, statut: string }
    ],
    intentsActifs: number,
    intentsTermines: number,
  }
]
```

### Cas limites

- **Outcome sans Intent déclaré** : `intentsContributeurs = []`, `intentsActifs = 0`, `intentsTermines = 0`. Affiché en tableau avec cellule vide (pas de crash).
- **Intent dont le champ `outcomes` est absent/vide** : ignoré silencieusement dans la jointure (pas d'erreur).
- **Titre d'outcome non trouvé après normalisation** : l'Intent est ignoré pour cet outcome ; un avertissement est loggé en console (pas de crash prod).
- **PRD sans section Outcome Criteria** : `donnees.matriceOutcomesIntents = []`, bloc HTML affiche « Aucun outcome défini dans PRD.md ».
- **Intents tous archivés** : matrice affichée normalement, avec `intentsActifs = 0` pour tous.

## 3. Critères d'Acceptation

- [ ] La fonction `calculerMatriceOutcomesIntents(donnees)` retourne un tableau avec un item par outcome présent dans `donnees.outcomes`.
- [ ] Chaque item contient `intentsContributeurs` (peut être vide), `intentsActifs` et `intentsTermines` corrects.
- [ ] Un Intent dont le frontmatter `outcomes: [X]` correspond à un outcome du PRD apparaît dans `intentsContributeurs` de cet outcome.
- [ ] Un Intent sans champ `outcomes` n'apparaît dans aucun `intentsContributeurs`.
- [ ] Un outcome sans Intent contributeur est présent dans le tableau (cellule vide), sans erreur.
- [ ] `blocMatriceOutcomesIntents(donnees)` produit un tableau HTML accessible : `<table>` avec `<caption>`, `<thead>`, `<th scope="col">`, `<tbody>`, aucune info codée par couleur seule.
- [ ] Le test unitaire passe avec un projet fixture comportant 2 outcomes et 3 Intents (dont 1 sans correspondance).

## 4. Interface / API

```js
// lib/dashboard/outcome-attribution.js (extension)

/**
 * @intent INTENT-018
 * @spec SPEC-018-1-matrice-outcomes-intents
 */
export function calculerMatriceOutcomesIntents(donnees) {
  // retourne MatriceOutcomesIntentsItem[]
}

export function blocMatriceOutcomesIntents(donnees) {
  // retourne string HTML
}
```

Injection dans `model/index.js` :
```js
donnees.matriceOutcomesIntents = calculerMatriceOutcomesIntents(donnees);
// après donnees.outcomeAttribution (ligne ~185)
```

## 5. Dépendances

- `lib/dashboard/outcome-attribution.js` — étendu (non réécrit)
- `lib/dashboard/outcomes.js` — `lireOutcomes()` non modifié
- `lib/dashboard/collect.js:243-264` — champ `outcomes` déjà parsé
- `lib/dashboard/model/index.js` — injection du nouveau calcul
- `SPEC-018-2` — consommera `donnees.matriceOutcomesIntents` (Wave 2)
- `SPEC-018-4` — consommera données Intent enrichies (Wave 2)

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~400 tokens
- Cette SPEC : ~500 tokens
- Fichiers source : `outcome-attribution.js` (~150 lignes), `outcomes.js` (~80 lignes), `collect.js:243-264` (~20 lignes), `model/index.js:177-190` (~15 lignes)
- **Total estimé** : ~1 500 tokens (Sonnet 4.6, large marge)

## 7. Definition of Output Done (DoOD)

- [x] `calculerMatriceOutcomesIntents()` implémentée et exportée depuis `outcome-attribution.js`
- [x] `blocMatriceOutcomesIntents()` produit un tableau HTML AA-conforme (axe-core 0 violation)
- [x] Injection dans `model/index.js` après `outcomeAttribution`
- [x] Test unitaire `test/dashboard-matrice-outcomes.test.js` : 2 outcomes × 3 Intents (8 cas)
- [x] `@spec SPEC-018-1` posé dans les fichiers touchés (outcome-attribution.js, model/index.js, test)
- [x] `_index.md` mis à jour, INTENT-018 lié
- [x] Drift check — annotations présentes, 0 gap
