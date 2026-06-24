---
status: archived
archivedAt: "2026-06-24T09:49:36.997Z"
archivedBy: evers.steeve@gmail.com
archivedReason: FACT-008 — SPECs done sans frontmatter YAML détectées via fallback body
---
# SPEC-018-2 — Aires EBM + Investment Balance

**Intent parent** : INTENT-018
**Auteur** : Steeve Evers
**Date** : 2026-06-23
**Statut** : done
**Format** : prose
**SQS** : 5/5
**Dépend de** : SPEC-018-1

---

## 1. Contexte

Les 4 aires EBM (Evidence-Based Management) permettent de mesurer la valeur réalisée selon 4 dimensions complémentaires. L'Investment Balance complète le tableau en montrant comment le budget d'effort est réparti (features / enabler / expérimentation / conformité). Ces métriques sont actuellement absentes du dashboard — elles constituent le cœur de INTENT-018 « juger sur la valeur réalisée ».

## 2. Comportement Attendu

### Input

- `donnees.matriceOutcomesIntents` (depuis SPEC-018-1) — pour Current/Unrealized Value
- `donnees.outcomeAttribution` — ratios outcomes livrés
- `donnees.discoveryDeliveryBalance` — `pcts.discovery` pour Ability to Innovate
- `donnees.intents` — pour Time-to-Market (Intents en delivery actifs) et Investment Balance
- `donnees.velocity` — throughput hebdomadaire si disponible

### Processing

**4 aires EBM** :

1. **Current Value (CV)** : ratio d'outcomes dont `ratio >= 0.8` parmi l'ensemble des outcomes du PRD. Si aucun outcome mesuré → affiche `JNSP` (pas de faux 100 %).
2. **Unrealized Value (UV)** : ratio d'outcomes dont `0 < ratio < 0.8`. Représente le potentiel non capturé.
3. **Time-to-Market (T2M)** : nombre d'Intents `statut in [active, in-progress]` de `kind=delivery` / nombre total. Indicateur de vitesse de livraison.
4. **Ability to Innovate (A2I)** : `discoveryDeliveryBalance.pcts.discovery` (déjà calculé). Capacité à explorer de nouvelles valeurs.

**Investment Balance** :
- `features` : count Intents `kind=delivery` ou `kind=experiment` (non archivés)
- `enabler` : count Intents `kind=enabler` (dette technique, infra)
- `conformite` : count Intents avec tag contenant `rgpd`, `ai-act`, `rgaa`, `rgesn` (insensible à la casse)
- `inconnu` : count Intents sans `kind` ni tag conformité
- Calculer les pourcentages sur le total non archivé.
- Cibles indicatives (non bloquantes) : features 65 %, enabler 25 %, conformité + inconnu 10 %.

### Output

```js
donnees.ebmAires = {
  currentValue:       { valeur: number|null, label: string, jnsp: boolean },
  unrealizedValue:    { valeur: number|null, label: string, jnsp: boolean },
  timeToMarket:       { valeur: number|null, label: string, jnsp: boolean },
  abilityToInnovate:  { valeur: number|null, label: string, jnsp: boolean },
}

donnees.investmentBalance = {
  buckets: { features: number, enabler: number, conformite: number, inconnu: number },
  pcts:    { features: number, enabler: number, conformite: number, inconnu: number },
  total:   number,
  sante:   'ok' | 'attention' | 'critique',  // vs cibles indicatives
}
```

### Cas limites

- **Aucun outcome dans PRD** : `currentValue.jnsp = true`, `unrealizedValue.jnsp = true` — afficher « Aucun outcome défini dans PRD.md » sans faux 0 %.
- **Aucun Intent delivery actif** : `timeToMarket.valeur = 0`, pas de crash.
- **`discoveryDeliveryBalance` absent** : `abilityToInnovate.jnsp = true`.
- **Tous les Intents archivés** : `investmentBalance.total = 0` → buckets tous à 0, santé `critique`.
- **Division par zéro dans les pourcentages** : retourner `0` (pas `NaN`).

## 3. Critères d'Acceptation

- [ ] `calculerEbmAires(donnees)` retourne un objet avec les 4 aires, chacune avec `valeur` (number 0–1 ou null) et `jnsp` (boolean).
- [ ] Quand aucun outcome n'est défini dans PRD.md, `currentValue.jnsp === true` et `unrealizedValue.jnsp === true`.
- [ ] `calculerInvestmentBalance(donnees)` retourne `buckets`, `pcts` et `sante` corrects pour un jeu de 6 Intents (2 delivery, 2 enabler, 1 conformité, 1 inconnu).
- [ ] `blocEbmAires(donnees)` produit une grille 2×2 HTML avec 4 cellules KPI, aucune couleur utilisée comme seule information (label textuel toujours présent).
- [ ] `blocInvestmentBalance(donnees)` produit un tableau ou barres avec légendes textuelles + aria-label sur les zones colorées.
- [ ] La santé `critique` est affichée avec un indicateur non coloré uniquement (texte ou icône avec aria-label).
- [ ] Tests unitaires couvrent : CV avec 0 outcome, UV avec 1 outcome livré sur 3, A2I depuis balance existante.

## 4. Interface / API

```js
// lib/dashboard/ebm-aires.js (nouveau fichier)

/**
 * @intent INTENT-018
 * @spec SPEC-018-2-aires-ebm-investment-balance
 */
export function calculerEbmAires(donnees) { /* … */ }
export function calculerInvestmentBalance(donnees) { /* … */ }
export function blocEbmAires(donnees) { /* → string HTML */ }
export function blocInvestmentBalance(donnees) { /* → string HTML */ }
```

Injection dans `model/index.js` (après SPEC-018-1) :
```js
donnees.ebmAires = calculerEbmAires(donnees);
donnees.investmentBalance = calculerInvestmentBalance(donnees);
```

## 5. Dépendances

- **SPEC-018-1** — `donnees.matriceOutcomesIntents` requis pour CV/UV
- `lib/dashboard/discovery-delivery-balance.js:80` — `pcts.discovery` consommé
- `lib/dashboard/model/index.js` — injection
- `lib/dashboard/schema/data-v2.schema.json` — déclarer `ebmAires` et `investmentBalance`

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~400 tokens
- Cette SPEC : ~600 tokens
- Fichiers source : `discovery-delivery-balance.js` (~200 lignes), `outcome-attribution.js` (existant, ~150 lignes), `model/index.js:177-195` (~20 lignes)
- **Total estimé** : ~1 800 tokens

## 7. Definition of Output Done (DoOD)

- [ ] `lib/dashboard/ebm-aires.js` créé avec 4 exports (calculer×2, bloc×2)
- [ ] Injection dans `model/index.js`
- [ ] Schéma `data-v2.schema.json` étendu (`ebmAires`, `investmentBalance`)
- [ ] Tests unitaires dans `test/dashboard-ebm-aires.test.js` — CV/UV/T2M/A2I + balance
- [ ] Rendu axe-core AA : 0 violation RGAA (grille 2×2 + tableau balance)
- [ ] `@spec SPEC-018-2` posé dans tous les fichiers touchés
- [ ] `_index.md` mis à jour
- [ ] `npx aiad-sdd drift-check` OK
