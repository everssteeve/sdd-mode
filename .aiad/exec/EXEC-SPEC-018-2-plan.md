# EXEC-SPEC-018-2 — Plan d'exécution phasé

> Exécution phasée (§3.6) — découpe la SPEC en **tranches verticales testables**.
> Interdiction de coder horizontalement : chaque tranche livre un incrément
> **et ses tests**. À la fin de chaque tranche : `npx aiad-sdd mini-gate SPEC-018-2 --phase N`.
>
> Marqueurs de statut : `[ ]` à faire · `[~]` en cours · `[x]` validé · `[!]` bloqué · `[-]` hors-scope.

**SPEC** : SPEC-018-2-aires-ebm-investment-balance
**Intent** : INTENT-018
**Mode phasé** : activé

---

## Phase 1 — Calcul des 4 aires EBM  [ ]

- Objectif : `calculerEbmAires(donnees)` retourne les 4 aires avec `valeur`/`jnsp`, tous cas limites couverts (aucun outcome, A2I absent, etc.)
- Fichiers : `lib/dashboard/ebm-aires.js` (nouveau)
- Tests : `test/dashboard-ebm-aires.test.js` — CV/UV/T2M/A2I + cas limites JNSP
- Done : `npm test -- dashboard-ebm-aires` passe, toutes les assertions §3 C1/C2 vértes
- Conditions :

## Phase 2 — Calcul Investment Balance  [ ]

- Objectif : `calculerInvestmentBalance(donnees)` retourne `buckets`, `pcts`, `sante` corrects pour le jeu de 6 Intents de §3 C3
- Fichiers : `lib/dashboard/ebm-aires.js` (ajout dans le même fichier)
- Tests : `test/dashboard-ebm-aires.test.js` — balance 2 delivery / 2 enabler / 1 conformité / 1 inconnu
- Done : tests balance passent, `sante` calculée correctement, division par zéro safe
- Conditions :

## Phase 3 — Blocs HTML accessibles  [ ]

- Objectif : `blocEbmAires` (grille 2×2) + `blocInvestmentBalance` (tableau) — 0 violation axe-core, aria-labels présents, aucune couleur seule
- Fichiers : `lib/dashboard/ebm-aires.js` (ajout blocs HTML)
- Tests : `test/dashboard-ebm-aires.test.js` — assertions HTML (aria-label, labels textuels, santé critique non-couleur seule)
- Done : axe-core AA 0 violation sur les deux blocs
- Conditions :

## Phase 4 — Injection + schéma  [ ]

- Objectif : injection dans `model/index.js` après `discoveryDeliveryBalance` (l.238) + déclaration `ebmAires`/`investmentBalance` dans `data-v2.schema.json`
- Fichiers : `lib/dashboard/model/index.js`, `lib/dashboard/schema/data-v2.schema.json`
- Tests : test d'intégration model (si existant) ou assertion manuelle `npm run build && node -e "const d=require('./lib/dashboard/model/index.js'); console.log(Object.keys(d.build()))" | grep ebmAires`
- Done : `donnees.ebmAires` et `donnees.investmentBalance` présents dans l'objet `donnees` après build, schéma valide
- Conditions :
