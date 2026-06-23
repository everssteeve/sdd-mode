# SPEC-018-3 — Hill charts calculés depuis l'état SDD

**Intent parent** : INTENT-018
**Auteur** : Steeve Evers
**Date** : 2026-06-23
**Statut** : done
**Format** : prose
**SQS** : 5/5

---

## 1. Contexte

Les hill charts (popularisés par Basecamp/Shape Up) représentent graphiquement où en est un Intent dans son cycle de vie : la montée (Discovery — on comprend comment faire) et la descente (Doing/Done — on exécute). Ils offrent une lecture instantanée de la confiance acquise sur chaque item en cours, complémentaire au throughput.

L'infrastructure temporelle existe déjà (pm-snapshots quotidiens + `cumulative-flow.js`). SPEC-018-3 ajoute un rendu SVG hill chart par Intent actif, basé sur la progression des SPECs liées.

## 2. Comportement Attendu

### Input

- `donnees.intents` — Intents filtrés `statut in [active, in-progress]`
- `donnees.specs` — SPECs liées à chaque Intent (champ `specs[]`)
- `.aiad/metrics/pm-snapshots/` — snapshots JSON horodatés (lus via `pm-diff.js`)

### Processing

**Calcul de position sur la courbe** pour chaque Intent actif :

1. Compter les SPECs liées : `nbTotal`, `nbDiscovery` (statut `draft`|`review`), `nbDoing` (statut `ready`|`in-progress`|`validation`), `nbDone` (statut `done`).
2. Calculer `positionX` (0–100) :
   - `0` = aucune SPEC connue (début de l'exploration)
   - `0–49` = Discovery (montée) :
     `positionX = Math.round(((nbDoing + nbDone) / nbTotal) * 49)`
     (ratio de SPECs sorties de Discovery — 0 si tout est draft, 49 si toutes en Doing/Done mais pas encore toutes done)
   - `50` = pic (toutes les SPECs connues, exécution commence)
   - `51–100` = Doing/Done (descente) : `50 + Math.round((nbDone / nbTotal) * 50)`

   **Règle de branche :**
   - Si `nbDiscovery === 0` et `nbDone === nbTotal` : `positionX = 100`
   - Si `nbDiscovery === 0` et `nbDoing + nbDone > 0` : phase Doing/Done → formule 50–100
   - Si `nbDiscovery > 0` et `nbTotal > 0` : phase Discovery → formule 0–49
   - Si `nbTotal === 0` : `positionX = 0`, flag `jnsp = true` (pas de SPECs → position inconnue)

3. Si `nbTotal === 0` : `positionX = 0`, flag `jnsp = true` (pas de SPECs → position inconnue).
4. Si données temporelles disponibles (≥ 3 snapshots, ≥ 3 Intents actifs) : tracer la trajectoire historique (pointillé) en plus du point actuel.
5. Si données temporelles insuffisantes (< 3 snapshots ou < 3 Intents actifs) : afficher uniquement le point actuel, avec note « Historique insuffisant — trajectoire disponible après 3 jours de données ».

### Output

```js
donnees.hillCharts = {
  intents: [
    {
      id: string,
      titre: string,
      positionX: number,   // 0–100
      jnsp: boolean,
      trajectoire: [       // [] si données insuffisantes
        { date: string, positionX: number }
      ],
    }
  ],
  historiqueDisponible: boolean,
  messageJnsp: string | null,   // message dégradé si historiqueDisponible=false
}
```

**Rendu SVG** `blocHillCharts(donnees)` :
- Courbe en S (arc) SVG inline, sans dépendance externe.
- Un point par Intent actif, positionné sur la courbe.
- Label Intent (id + titre tronqué 20 chars) adjacent au point.
- `<title>` et `<desc>` sur le `<svg>`.
- `aria-label` sur chaque point : « [INTENT-id] — [titre] — position [X/100] ».
- `@media (prefers-reduced-motion: reduce)` : supprimer toute animation.
- Couleurs : ne pas coder l'état par couleur seule — utiliser des formes différentes (cercle = en cours, carré = JNSP).

### Cas limites

- **0 Intent actif** : `donnees.hillCharts.intents = []` — bloc affiche « Aucun Intent en cours ».
- **Intent actif sans aucune SPEC** : `positionX = 0`, `jnsp = true`, point affiché avec forme distincte + label « SPECs non définies ».
- **Toutes SPECs done** : `positionX = 100`, point en bas de la descente.
- **< 3 snapshots disponibles** : `historiqueDisponible = false`, trajectoire non tracée (dégradé gracieux).
- **SVG dans environnement sans CSS** : doit rester lisible (labels texte toujours visibles).

## 3. Critères d'Acceptation

- [ ] `calculerHillCharts(donnees)` retourne un item par Intent `active`/`in-progress`, avec `positionX` dans [0–100].
- [ ] Un Intent sans SPECs retourne `positionX = 0` et `jnsp = true`.
- [ ] Un Intent dont toutes les SPECs sont `done` retourne `positionX = 100`.
- [ ] Quand les pm-snapshots contiennent < 3 dates distinctes, `historiqueDisponible === false` et `messageJnsp` est non vide.
- [ ] `blocHillCharts(donnees)` produit un `<svg>` avec `<title>`, `<desc>`, et un `aria-label` sur chaque point de données.
- [ ] axe-core signale 0 violation RGAA AA sur le rendu HTML du bloc.
- [ ] `@media (prefers-reduced-motion: reduce)` présent si une transition CSS est utilisée.
- [ ] Test unitaire : 3 Intents (0 SPEC, 2/4 SPECs done, 4/4 SPECs done) → positions [0, 75, 100].
  (2/4 done, 0 draft → phase Doing/Done : 50 + (2/4)×50 = 75)

## 4. Interface / API

```js
// lib/dashboard/hill-charts.js (nouveau fichier)

/**
 * @intent INTENT-018
 * @spec SPEC-018-3-hill-charts-sdd
 * @governance AIAD-RGAA
 */
export function calculerHillCharts(donnees) { /* … */ }
export function blocHillCharts(donnees) { /* → string HTML (SVG inline) */ }
```

> **SVG** : réutiliser le template `buildSvgPath()` de `lib/dashboard/cumulative-flow.js:43`
> — même viewBox (800×300), même style de courbe Bézier cubique, même palette CSS.
> Adapter uniquement les points de données (positions 0–100 mappées sur l'axe X du viewBox).

Injection dans `model/index.js` :
```js
donnees.hillCharts = calculerHillCharts(donnees);
```

## 5. Dépendances

- `lib/dashboard/cumulative-flow.js:43` — pattern SVG area-chart (template de référence)
- `lib/dashboard/pm-diff.js` — lecture des snapshots historiques
- `.aiad/metrics/pm-snapshots/*.json` — données temporelles
- `lib/dashboard/model/index.js` — injection (parallèle à SPEC-018-1)
- `lib/dashboard/schema/data-v2.schema.json` — déclarer `hillCharts`
- Gouvernance : AIAD-RGAA (SVG accessible)

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~400 tokens
- Cette SPEC : ~600 tokens
- Fichiers source : `cumulative-flow.js` (~150 lignes template SVG), `pm-diff.js` (~80 lignes), snapshots JSON (2–3 fichiers)
- **Total estimé** : ~1 800 tokens

## 7. Definition of Output Done (DoOD)

- [x] `lib/dashboard/hill-charts.js` créé avec `calculerHillCharts()` + `blocHillCharts()`
- [x] Injection dans `model/index.js`
- [x] Schéma `data-v2.schema.json` étendu (`hillCharts`)
- [x] Test unitaire `test/dashboard-hill-charts.test.js` : 3 Intents, dégradé < 3 snapshots
- [ ] axe-core 0 violation sur le SVG généré *(CI uniquement — condition merge)*
- [x] `@media (prefers-reduced-motion)` présent si animation utilisée
- [x] `@spec SPEC-018-3` posé dans les fichiers touchés
- [x] `_index.md` mis à jour
- [x] `npx aiad-sdd drift-check` OK
