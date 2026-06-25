---
status: archived
archivedAt: "2026-06-25T07:45:25.832Z"
archivedBy: evers.steeve@gmail.com
archivedReason: archive done
---
# SPEC-030-4-dashboard-eco

**Intent parent** : INTENT-030
**Auteur** : Steeve Evers
**Date** : 2026-06-24
**Statut** : done
**Format** : prose
**SQS** : 5/5 (Gate ouverte — 2026-06-25)

---

## 1. Contexte

INTENT-030 exige un badge CO₂ dans le dashboard AIAD (critère de drift). Cette SPEC ajoute une page `dashboard/eco.html` et un widget CO₂ dans `dashboard/metrics.html`. Elle lit `.aiad/metrics/hook-runs.jsonl` (alimenté par SPEC-030-2) et génère une vue de tendance de l'empreinte écologique sur les 30 dernières sessions.

## 2. Comportement Attendu

### Input

- `lib/dashboard.js` — fichier existant (`RENDERERS` map, `lib/dashboard.js:60-84`).
- `.aiad/metrics/hook-runs.jsonl` — entrées `{ ts, ecoMetrics: { co2g, totalTokens, method } }`.

### Processing

**A) Collecte des données (`lib/eco-dashboard.js`)** :
1. Lire `.aiad/metrics/hook-runs.jsonl`, filtrer les entrées avec `ecoMetrics` présent.
2. Garder les **30 dernières entrées** (fenêtre glissante).
3. Calculer :
   - `co2Total30` (g) — somme des `co2g` non-null sur 30 sessions
   - `co2Moyenne` (g/session) — moyenne sur les sessions estimées
   - `tokensTotal30` — somme des `totalTokens`
   - `sessionCount` — nombre d'entrées avec `ecoMetrics`
   - `sessionEstimees` — entrées avec `method: 'estimated'`
   - `tendance` — comparaison sessions 1–15 vs 16–30 (delta %, null si < 15 sessions)

**B) Widget CO₂ dans `dashboard/metrics.html`** :
- Ajouter une carte `EcoLogits` après les métriques DORA :
  ```
  ┌─────────────────────────────────────┐
  │ 🌱 Impact écologique (30 dernières) │
  │ CO₂ total  : X.XX g CO₂eq           │
  │ Tendance   : ▼ -8 % vs 15 prev      │
  │ Tokens     : XXX k                  │
  │ estimation indicative (non certif.) │
  └─────────────────────────────────────┘
  ```
- Le libellé `estimation indicative (non certifiée)` est obligatoire dans la carte.

**C) Page dédiée `dashboard/eco.html`** :
- Même structure HTML que les autres pages du dashboard (réutiliser le layout).
- Tableau des 30 dernières sessions : `date | modèle | tokens | CO₂ (g) | méthode`.
- Section tendance : delta % sessions 1–15 vs 16–30.
- Avertissement si `sessionEstimees < sessionCount` : `N sessions sur M sans estimation (modèle non référencé)`.
- Lien retour vers `metrics.html`.

**D) Intégration dans `lib/dashboard.js`** :
- Ajouter `eco: { render: pageEco }` dans `RENDERERS`.
- Appeler `collecterEcoMetrics()` depuis `lib/eco-dashboard.js` lors de la génération.

### Output

- `dashboard/eco.html` généré (ou régénéré) à chaque appel `/aiad dashboard-html`.
- Widget CO₂ visible dans `dashboard/metrics.html`.

### Cas limites

- **`hook-runs.jsonl` absent ou 0 entrée `ecoMetrics`** : afficher `Aucune donnée — hook Stop non configuré.` dans le widget et la page, pas d'erreur.
- **< 15 sessions** : `tendance: null`, afficher `Données insuffisantes pour calculer la tendance`.
- **Toutes entrées `method: 'unknown'`** : `CO₂ total : N/D`, widget visible avec avertissement.
- **`co2g` null** sur certaines entrées : ignorer dans la somme, décompter dans `sessionEstimees`.
- **Ligne JSONL malformée** : ignorer silencieusement, continuer avec les lignes valides.

## 3. Critères d'Acceptation

- [ ] `/aiad dashboard-html` génère `dashboard/eco.html` avec un tableau des 30 dernières sessions (colonnes : date, modèle, tokens, CO₂, méthode).
- [ ] `dashboard/metrics.html` contient une carte `EcoLogits` avec `co2Total30`, `tendance` et le libellé `estimation indicative (non certifiée)`.
- [ ] `hook-runs.jsonl` absent → widget affiche `Aucune donnée` (pas d'exception levée, pas de page vide cassée).
- [ ] < 15 sessions → `Données insuffisantes pour calculer la tendance` (pas de valeur inventée).
- [ ] `eco.html` respecte l'accessibilité RGAA : tableau avec `<th scope="col">` sur chaque colonne, ratio de contraste ≥ 4.5:1 pour le texte normal (WCAG 2.1 SC 1.4.3), pas de couleur comme seul vecteur d'information.
- [ ] La génération de `eco.html` n'augmente pas le temps de génération total de plus de 500 ms (test chronométré en CI).
- [ ] `RENDERERS` dans `lib/dashboard.js` inclut l'entrée `eco`.

## 4. Interface / API

```js
// lib/eco-dashboard.js (nouveau, ESM)
export function collecterEcoMetrics(racine, options = { limit: 30 }): EcoDashboardData
// EcoDashboardData = { co2Total30, co2Moyenne, tokensTotal30, sessionCount,
//                      sessionEstimees, tendance, sessions[] }

// lib/dashboard.js — ajout dans RENDERERS (lib/dashboard.js:60-84)
import { pageEco } from './eco-dashboard.js'
const RENDERERS = {
  // ... existant ...
  eco: { render: pageEco },
}
```

## 5. Dépendances

- **SPEC-030-2** — alimentation de `.aiad/metrics/hook-runs.jsonl` avec `ecoMetrics`.
- `lib/dashboard.js:60-84` — `RENDERERS` map (point d'injection).
- Accessibilité RGAA 4.1 / WCAG 2.1 AA — tableaux, contrastes (AIAD-RGAA).
- RGESN — pas de requête réseau supplémentaire, génération locale uniquement.

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~300 tokens
- SPEC-030-1 (format EcoResult) : ~100 tokens
- SPEC-030-2 (format hook-runs) : ~100 tokens
- Cette SPEC : ~500 tokens
- Fichiers à lire : `lib/dashboard.js`, `dashboard/metrics.html` (exemple), `test/dashboard.test.js`
- **Total estimé** : ~1 500 tokens

## 7. Definition of Output Done (DoOD)

- [ ] `lib/eco-dashboard.js` — `collecterEcoMetrics()` et `pageEco()` exportées, ESM
- [ ] `lib/dashboard.js` — entrée `eco` dans `RENDERERS`
- [ ] `dashboard/eco.html` généré sans erreur (jeu de données vide + non-vide)
- [ ] `dashboard/metrics.html` — widget EcoLogits présent
- [ ] `test/eco-dashboard.test.js` — couverture des 7 critères d'acceptation avec `node:test`
- [ ] `@spec SPEC-030-4-dashboard-eco` posé sur `eco-dashboard.js`
- [ ] `@intent INTENT-030` posé sur `eco-dashboard.js`
- [ ] Accessibilité : `<th scope="col">` sur chaque colonne, contrastes AA vérifiés (AIAD-RGAA)
- [ ] Lint passing
- [ ] SPEC mise à jour si écart (Drift Lock)
- [ ] Gouvernance : AIAD-RGAA (accessibilité tableau), AIAD-RGESN (génération locale, zéro réseau)
