---
id: SPEC-030-3
title: validate-badge — badge CO₂ dans /sdd validate
parent_intent: INTENT-030
status: archived
format: prose
sqs: 5
author: Steeve Evers
date: "2026-06-24"
traceability: exempt
traceability_reason: Livrable = directive agent .claude/sdd/validate.md (répertoire .claude/ exclu de EXTENSIONS_CODE par design). Implémentation vérifiée manuellement via /sdd validate — SPEC-024-1 / FACT-004.
archivedAt: "2026-06-25T07:45:25.829Z"
archivedBy: evers.steeve@gmail.com
archivedReason: archive done
---
# SPEC-030-3-validate-badge

**Intent parent** : INTENT-030
**Auteur** : Steeve Evers
**Date** : 2026-06-24
**Statut** : done
**Format** : prose
**SQS** : 5/5 — Gate OUVERTE (2026-06-25)

---

## 1. Contexte

INTENT-030 exige qu'EcoLogits soit visible dans le rapport `/sdd validate` (critère de drift). Cette SPEC enrichit la directive agent `.claude/sdd/validate.md` pour qu'elle lise les dernières entrées de `.aiad/metrics/hook-runs.jsonl` et émette un badge CO₂ dans le rapport de validation. C'est une modification de directive (prompt engineering), pas de code Node.js.

## 2. Comportement Attendu

### Input

- Directive enrichie `.claude/sdd/validate.md` invoquée lors d'un `/sdd validate`.
- Données : `.aiad/metrics/hook-runs.jsonl` — dernières entrées avec champ `ecoMetrics`.

### Processing

1. Lors d'un `/sdd validate`, après les checks habituels (drift, SQS, gouvernance), lire les **5 dernières entrées** de `.aiad/metrics/hook-runs.jsonl` contenant un champ `ecoMetrics`.
2. Calculer :
   - `co2Total` : somme des `co2g` non-null (en g)
   - `tokensTotal` : somme des `totalTokens`
   - `sessionCount` : nombre d'entrées lues
3. Émettre le bloc badge dans le rapport de validation :

```
## Impact écologique (estimation indicative — non certifiée)

| Métrique        | Valeur              |
|-----------------|---------------------|
| Sessions        | N                   |
| Tokens totaux   | X                   |
| CO₂ estimé      | Y.YY g CO₂eq        |
| Méthode         | estimation indicative (EcoLogits JS port) |

> ⚠ Ces valeurs sont des estimations indicatives basées sur des modèles
> d'énergie publiés. Elles ne constituent pas une mesure certifiée.
```

4. Si `.aiad/metrics/hook-runs.jsonl` est absent ou sans entrée `ecoMetrics` : émettre un avertissement `⚠ Aucune donnée EcoLogits — hook Stop non configuré ou sessions insuffisantes.` et poursuivre la validation (ne pas la bloquer).

### Output

- Bloc `## Impact écologique` ajouté au rapport `/sdd validate` après la section gouvernance.
- Si données absentes : avertissement non-bloquant.

### Cas limites

- **Toutes les entrées ont `method: 'unknown'`** : afficher `CO₂ estimé : N/D (modèle non référencé)`.
- **Mix `estimated` / `unknown`** : sommer uniquement les `co2g` non-null, indiquer `(N sessions sur M ont pu être estimées)`.
- **`hook-runs.jsonl` malformé** (lignes non-JSON) : ignorer les lignes invalides, continuer avec les lignes valides.
- **`co2g` = 0** (session vide, tokens = 0) : inclure dans le compte mais ne pas distordre la somme.

## 3. Critères d'Acceptation

- [x] Après une session avec hook Stop actif, `/sdd validate` affiche un bloc `## Impact écologique` avec `CO₂ estimé`, `Tokens totaux` et `Sessions`.
- [x] Le libellé `estimation indicative (non certifiée)` est présent dans le badge — même quand `co2g: null` ou `method: 'unknown'`.
- [x] `.aiad/metrics/hook-runs.jsonl` absent → avertissement non-bloquant, validation poursuit normalement.
- [x] Entrées `method: 'unknown'` → `CO₂ estimé : N/D` (pas de valeur inventée).
- [x] Le bloc `## Impact écologique` apparaît **après** la section gouvernance dans le rapport.
- [x] Les sections drift-check, SQS et gouvernance retournent les mêmes verdicts avec ou sans `ecoMetrics` disponible dans `hook-runs.jsonl`.

## 4. Interface / API

Modification de `.claude/sdd/validate.md` — ajout d'une section à la fin de la procédure de validation :

```markdown
## Badge EcoLogits (§ INTENT-030)

Après la section gouvernance, lis `.aiad/metrics/hook-runs.jsonl`.
Filtre les 5 dernières entrées avec `ecoMetrics` présent.
Calcule co2Total (somme co2g non-null), tokensTotal, sessionCount.
Émets le bloc `## Impact écologique` avec les valeurs et le libellé
obligatoire "estimation indicative (non certifiée)".
Si fichier absent ou vide → avertissement non-bloquant.
```

## 5. Dépendances

- **SPEC-030-1** — format `EcoResult` (champs `co2g`, `totalTokens`, `method`, `co2Label`).
- **SPEC-030-2** — alimentation de `.aiad/metrics/hook-runs.jsonl` (la directive lit ce fichier).
- `.claude/sdd/validate.md` — directive existante à enrichir.

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~300 tokens
- SPEC-030-1 (format EcoResult) : ~100 tokens
- Cette SPEC : ~350 tokens
- Fichiers à lire : `.claude/sdd/validate.md`, `.aiad/metrics/hook-runs.jsonl` (exemple)
- **Total estimé** : ~900 tokens — session courte (directive uniquement)

## 7. Definition of Output Done (DoOD)

- [x] `.claude/sdd/validate.md` enrichi avec la section `## Badge EcoLogits` (Étape 6c)
- [ ] Test manuel : `/sdd validate` sur un projet avec hook Stop actif → badge visible
- [ ] Test manuel : `/sdd validate` sans `hook-runs.jsonl` → avertissement non-bloquant, pas d'erreur
- [x] `@spec SPEC-030-3-validate-badge` posé dans le commentaire de la directive
- [x] Gouvernance : libellé anti-greenwashing vérifié (AIAD-AI-ACT), libellé indicatif présent (AIAD-RGPD)
- [x] SPEC mise à jour (Drift Lock — traceability: exempt, FACT-004 / SPEC-024-1)
