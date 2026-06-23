---
id: RESEARCH-024
intent: INTENT-018
title: La valeur réalisée comme boussole — outcomes, EBM, bilan humains/agents
author: Steeve Evers
date: 2026-06-23
verdict: GO
confidence: 90
---

# RESEARCH-024 — La valeur réalisée comme boussole

> Phase Research (§3.5) — Discovery ancré dans le code réel. Verdict tranché par l'humain.

## Contexte

INTENT-018 veut faire du dashboard le reflet de la **valeur réalisée** (outcomes, EBM, hill charts,
bilan humains/agents, Investment Balance, Impact × Effort) plutôt que la seule activité (specs fermées, throughput).

Dépendances déclarées : INTENT-016 (fondations dashboard) + INTENT-017 (quotidien).
Statut dépendances : INTENT-016 (`active`, SPECs 016-1 à 016-4 livrées, commit `57247b7`) ✅ — INTENT-017 (`active`, SPEC-017-4 livrée, commit `e742301`) ✅. Fondations en place.

## Discovery

- `lib/dashboard/outcome-attribution.js:34` — `calculerOutcomeAttribution()` déjà implémenté (SPEC-018-1)
- `lib/dashboard/outcome-attribution.js:102` — `blocOutcomeAttribution()` rendu existant (SPEC-018-1)
- `lib/dashboard/outcomes.js:80` — `lireOutcomes()` parse outcomes du PRD (SPEC-018-1, SPEC-018-2)
- `lib/dashboard/collect.js:243` — champs frontmatter Intent (`outcomes`, `owner`, `auteur`…)
- `lib/dashboard/collect.js:264` — fin bloc champs Intent parsés
- `lib/dashboard/discovery-delivery-balance.js:80` — `calculerDiscoveryDeliveryBalance()` source Ability to Innovate (SPEC-018-2)
- `lib/dashboard/discovery-delivery-balance.js:152` — `blocDiscoveryDeliveryBalance()` rendu (SPEC-018-2)
- `lib/dashboard/cumulative-flow.js:43` — pattern CFD/SVG réutilisable comme template hill chart (SPEC-018-3)
- `lib/dashboard/pm-diff.js` — diff inter-snapshots, source temporelle pour hill charts (SPEC-018-3)
- `lib/leadership-metrics.js:47` — `calculerHumanAuthorship()` heuristique formulateur (SPEC-018-4)
- `lib/dashboard/model/index.js:177` — point d'injection `donnees.outcomes` (SPEC-018-4)
- `lib/dashboard/rice-matrix.js:22` — `scoreImpact()` déjà implémenté (SPEC-018-5)
- `lib/dashboard/rice-matrix.js:44` — `scoreEffort()` déjà implémenté (SPEC-018-5)
- `lib/dashboard/schema/data-v2.schema.json` — schema à étendre (5 nouveaux champs)
- `test/dashboard.test.js:21` — test principal 12 pages + data.json (couverture à étendre)
- `test/dashboard-outcomes.test.js` — `lireOutcomes()` couvert
- `test/dashboard-pm-v25.test.js` — `calculerDiscoveryDeliveryBalance()` couvert

### Constat par SPEC

**SPEC-018-1 (Matrice outcomes ↔ Intents)** : 80 % déjà implémenté. Manque la liaison inverse Intent → outcomes. Effort faible (jointure supplémentaire).

**SPEC-018-2 (Aires EBM + Investment Balance)** : données sources présentes (`outcomes.ratio`, `discoveryDeliveryBalance`). Nouveau fichier `ebm-aires.js` à créer. Pas de blocage architectural.

**SPEC-018-3 (Hill charts)** : pattern SVG + diff inter-snapshots existants. Nouveau fichier `hill-charts.js`. Note : afficher JNSP si < 3 points temporels par Intent (dégradé gracieux).

**SPEC-018-4 (Bilan humains/agents)** : champ `executor`/`validator` absent du frontmatter. Décision à prendre à la phase spec : Option A (nouveau champ frontmatter, fiable) vs Option B (heuristique git-blame, automatique mais fragile). Non bloquant pour le GO — à trancher dans SPEC-018-4.

**SPEC-018-5 (Impact × Effort en attente)** : filtre additionnel `statut != done && statut != archived` sur `rice-matrix.js` existant. Effort minimal.

## Risques & inconnues

- R1 — Champ `executor`/`validator` absent du frontmatter Intent (Gravité : Moyenne) — à trancher Option A/B dans SPEC-018-4, non bloquant pour le GO global
- R2 — Historique pm-snapshots potentiellement court pour hill charts significatifs (Gravité : Faible) — dégradé gracieux prévu (JNSP si < 3 points)
- R3 — 5 SPECs = charge totale non négligeable (Gravité : Faible) — SPECs indépendantes et parallélisables, SPEC-018-1 et -5 légères
- R4 — INTENT-016/017 non fermés officiellement (Gravité : Très faible) — commits de clôture présents, fondations stables

## Faisabilité

Élevée. Architecture 4-couches stable. Patterns établis (SVG, calcul pure, rendu HTML). 4/5 SPECs sans modification structurelle. Une inconnue de design (R1) à trancher dans SPEC-018-4.

## Verdict

```
Verdict : GO (confidence: 90%)
Auteur : Steeve Evers  |  Date : 2026-06-23
```
