# SPEC-030-1-eco-estimator

**Intent parent** : INTENT-030
**Auteur** : Steeve Evers
**Date** : 2026-06-24
**Statut** : done
**Format** : prose
**SQS** : 5/5 — Gate OUVERTE (2026-06-24)

---

## 1. Contexte

INTENT-030 vise à mesurer et réduire l'impact écologique des cycles SDD (-10 % en 6 mois). RESEARCH-028 a tranché : périmètre B (harness Claude Code) + stratégie B (ré-implémentation JS de l'algorithme EcoLogits). Cette SPEC est la fondation : elle expose l'estimateur CO₂ en JS natif et la base de modèles JSON dérivée des données EcoLogits publiées. Toutes les SPECs suivantes (030-2, 030-3, 030-4) en dépendent pour le format de sortie.

## 2. Comportement Attendu

### Input

```js
estimerImpact({ model, inputTokens, outputTokens })
```

- `model` : string — nom du modèle Claude (ex. `claude-sonnet-4-6`, `claude-opus-4-8`, `claude-haiku-4-5-20251001`)
- `inputTokens` : number ≥ 0
- `outputTokens` : number ≥ 0

### Processing

Algorithme EcoLogits (portage JS) :

```
energyWh = inputTokens × model.energyPerInputToken
         + outputTokens × model.energyPerOutputToken
co2g     = energyWh × carbonIntensity
```

- `energyPerInputToken` et `energyPerOutputToken` : valeurs en Wh/token issues de `lib/eco-models.json` (source : EcoLogits model database, licence Apache-2.0).
- `carbonIntensity` : constante configurable via `AIAD_CARBON_INTENSITY_G_KWH` (défaut : 475 gCO₂eq/kWh — moyenne européenne 2024 selon EcoLogits).
- Si le modèle est inconnu → retourner `method: 'unknown'`, `co2g: null`, `energyWh: null` (ne pas planter).

### Output

```js
{
  model: string,
  inputTokens: number,
  outputTokens: number,
  totalTokens: number,       // inputTokens + outputTokens
  energyWh: number | null,   // null si modèle inconnu
  co2g: number | null,       // null si modèle inconnu
  co2Label: string,          // "estimation indicative (non certifiée)" — anti-greenwashing
  carbonIntensityUsed: number,
  method: 'estimated' | 'unknown'
}
```

### Cas limites

- **Modèle inconnu** : `method: 'unknown'`, `co2g: null`, pas d'exception — permet d'ajouter des modèles sans casser le hook.
- **Tokens négatifs** : clamper à 0 (protection contre données corrompues du harness).
- **`eco-models.json` absent** : lever `EcoModelsNotFoundError` avec le chemin attendu — fail-fast à l'import, pas au moment de l'appel.
- **`AIAD_CARBON_INTENSITY_G_KWH` invalide** (non-numérique) : utiliser la valeur par défaut 475 et émettre un avertissement sur `process.stderr`.
- **Appel avec `inputTokens: 0, outputTokens: 0`** : retourner `co2g: 0, energyWh: 0, method: 'estimated'` — valide.

## 3. Critères d'Acceptation

- [ ] `estimerImpact({ model: 'claude-sonnet-4-6', inputTokens: 1000, outputTokens: 500 })` retourne `co2g > 0`, `energyWh > 0`, `method: 'estimated'`.
- [ ] `estimerImpact({ model: 'modele-inconnu', inputTokens: 100, outputTokens: 100 })` retourne `co2g: null`, `method: 'unknown'`, sans lever d'exception.
- [ ] `co2Label` vaut `"estimation indicative (non certifiée)"` quelle que soit la valeur de `model`, `inputTokens` ou `outputTokens` — y compris pour les modèles inconnus.
- [ ] `AIAD_CARBON_INTENSITY_G_KWH=200` est pris en compte : `co2g_200 / co2g_475 ≈ 0.421 (± 1 %)` sur un même jeu de tokens.
- [ ] `eco-models.json` contient au moins les 4 modèles Claude actifs : `claude-sonnet-4-6`, `claude-opus-4-8`, `claude-haiku-4-5-20251001`, `claude-fable-5`.
- [ ] Tokens négatifs clampés à 0 — aucune valeur négative en sortie.
- [ ] `eco-models.json` absent → `EcoModelsNotFoundError` levée à l'import (pas au call-time).
- [ ] Zéro dépendance de production ajoutée à `package.json`.

## 4. Interface / API

```js
// lib/eco-estimator.js (ESM)
export function estimerImpact({ model, inputTokens, outputTokens }): EcoResult
export class EcoModelsNotFoundError extends Error {}

// lib/eco-models.json — schéma d'un enregistrement
{
  "claude-sonnet-4-6": {
    "energyPerInputToken": 2.8e-7,    // Wh/token — source EcoLogits
    "energyPerOutputToken": 1.1e-6,   // Wh/token — source EcoLogits
    "source": "ecologits-v0.x",
    "updatedAt": "2026-06-24"
  }
}
```

## 5. Dépendances

- Aucune dépendance de production — Node 18+ ESM natif uniquement.
- Source des valeurs énergétiques : EcoLogits model database (Apache-2.0) — à versionner dans le JSON.

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~300 tokens
- Cette SPEC : ~500 tokens
- Fichiers source à lire : `package.json`, `lib/score.js` (pattern existant)
- **Total estimé** : ~1 000 tokens — session légère, pas de PRD nécessaire

## 7. Definition of Output Done (DoOD)

- [x] `lib/eco-estimator.js` — fonction `estimerImpact` exportée, ESM
- [x] `lib/eco-models.json` — 4 modèles Claude au minimum, valeurs sourcées EcoLogits
- [x] `test/eco-estimator.test.js` — couverture des 8 critères d'acceptation avec `node:test`
- [x] `@spec SPEC-030-1-eco-estimator` posé sur `estimerImpact`
- [x] Lint passing (`node --check lib/eco-estimator.js`)
- [x] SPEC mise à jour si écart (Drift Lock)
- [x] Gouvernance : libellé anti-greenwashing vérifié (AIAD-AI-ACT)
