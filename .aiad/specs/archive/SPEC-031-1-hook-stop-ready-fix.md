---
id: SPEC-031-1
title: "Correctif hook Stop — exclusion du gap spec_validated_not_implemented pour statut ready"
intent: INTENT-031
author: Steeve Evers
date: 2026-06-25
status: done
format: prose
sqs: 5/5
research: RESEARCH-031 (CONDITIONAL GO 85%, C2 accepté)
---

# SPEC-031-1 — Correctif hook Stop : exclusion gap `spec_validated_not_implemented` pour statut `ready`

**Intent parent** : INTENT-031  
**Auteur** : Steeve Evers  
**Date** : 2026-06-25  
**Statut** : draft  
**Format** : prose  
**SQS** : À évaluer via /sdd gate  

---

## 1. Contexte

Le hook Stop (`drift-lock`) calcule les gaps bloquants via `specsValideesNonImplementees` (lib/sdd-trace.js:560). Ce filtre inclut actuellement les SPECs au statut `ready` — état normal signifiant « gate passée, exécution non démarrée ». Une SPEC `ready` sans annotation `@spec` dans le code est une situation **attendue**, pas un drift. Résultat : le PE reçoit un faux-positif bloquant dès qu'une SPEC passe la Gate et doit corriger manuellement le statut (FACT-010).

La correction est chirurgicale : retirer `'ready'` du filtre. Risque accepté (C2 Research) : la détection « SPEC stuck-in-ready depuis N jours » est sacrifiée — traçable via FACT si besoin.

---

## 2. Comportement Attendu

### Input

Une matrice de traçabilité contenant au moins une SPEC au statut `ready` sans annotation `@spec` dans le code.

### Processing

`lib/sdd-trace.js:560` — filtre `specsValideesNonImplementees` :

**Avant (comportement actuel bugué) :**
```js
specsValideesNonImplementees: specs
  .filter((s) => ['ready', 'validation', 'done'].includes(s.status))
  .filter((s) => !codeParSpec.has(shortSpecId(s.id)))
  .filter((s) => !estExempte(s)),
```

**Après (correction) :**
```js
specsValideesNonImplementees: specs
  .filter((s) => ['validation', 'done'].includes(s.status))
  .filter((s) => !codeParSpec.has(shortSpecId(s.id)))
  .filter((s) => !estExempte(s)),
```

`lib/drift-verdict.js` : aucune modification — `compterGapsBloquants` et `listerGaps` consomment la matrice telle quelle, le fix en amont suffit.

### Output

- `specsValideesNonImplementees` n'inclut plus les SPECs au statut `ready`.
- Le hook Stop et `npx aiad-sdd trace --fail-on-gap` retournent `PASS` (ou le verdict réel sans faux-positif).
- Les SPECs `validation` et `done` sans code restent bloquantes — comportement inchangé.

### Cas limites

1. **SPEC `ready` sans code ET sans exemption** → n'est plus comptée comme gap bloquant ; ne disparaît pas de la matrice (visible dans le rapport complet mais non bloquante).
2. **SPEC `ready` avec code annoté** → comportement inchangé (codeParSpec.has = true → filtrée de toute façon).
3. **SPEC `validation` sans code** → reste gap bloquant (inchangé).
4. **SPEC `done` sans code non exemptée** → reste gap bloquant (inchangé).
5. **Aucune SPEC dans le projet** → aucun effet, verdict `PASS` inchangé.

---

## 3. Critères d'Acceptation

- [ ] CA-1 : Une SPEC au statut `ready` sans annotation `@spec` dans le code ne génère aucun gap `spec_validated_not_implemented` lors d'un appel à `npx aiad-sdd trace --fail-on-gap`.
- [ ] CA-2 : Une SPEC au statut `validation` sans annotation `@spec` génère toujours un gap bloquant (régression interdite).
- [ ] CA-3 : Une SPEC au statut `done` sans annotation `@spec` (non exemptée) génère toujours un gap bloquant (régression interdite).
- [ ] CA-4 : `test/drift-verdict.test.js` passe avec un cas de test explicite pour statut `ready` (gap absent) et `validation` (gap présent).
- [ ] CA-5 : `test/trace.test.js` passe sans modification de comportement sur les statuts `validation`/`done`.

---

## 4. Interface / API

Aucune nouvelle API publique. Modification interne de `lib/sdd-trace.js` uniquement.

```
// lib/sdd-trace.js:560
// Avant : ['ready', 'validation', 'done']
// Après : ['validation', 'done']
```

---

## 5. Dépendances

- `lib/sdd-trace.js` — seul fichier modifié (prod)
- `test/drift-verdict.test.js` — test à adapter (cas `ready`)
- `test/trace.test.js` — vérifier non-régression

Aucune dépendance vers SPEC-031-2 ou SPEC-031-3.

---

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~200 tokens
- Cette SPEC : ~350 tokens
- `lib/sdd-trace.js` (zone 550–570) : ~100 tokens
- `test/drift-verdict.test.js` (zone pertinente) : ~150 tokens
- **Total estimé** : ~800 tokens — très faible (largement sous le seuil de 40%)

---

## 7. Definition of Output Done (DoOD)

- [ ] `lib/sdd-trace.js:560` : filtre corrigé (`'ready'` retiré)
- [ ] `test/drift-verdict.test.js` : cas `ready` → assert aucun gap `spec_validated_not_implemented`
- [ ] `test/trace.test.js` : non-régression sur `validation`/`done`
- [ ] `npx aiad-sdd trace --fail-on-gap` : exit 0 sur un projet avec SPEC `ready` sans code
- [ ] Annotations `@intent INTENT-031 @spec SPEC-031-1-hook-stop-ready-fix` posées dans les fichiers modifiés
- [ ] Drift Lock : SPEC mise à jour si écart constaté pendant l'implémentation
- [ ] Gouvernance : non applicable (pas de données personnelles, pas d'UI, pas de composant IA)

---

## Notes

Décision C2 (RESEARCH-031) : accepter le sacrifice de la détection « stuck-in-ready ». Si cette situation s'avère problématique à l'usage, tracer via `/sdd fact` et rouvrir un INTENT dédié.
