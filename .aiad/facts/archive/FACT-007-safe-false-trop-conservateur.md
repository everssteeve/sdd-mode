---
status: archived
archivedAt: "2026-06-30T07:28:53.231Z"
archivedBy: evers.steeve@gmail.com
archivedReason: archive done
---
# FACT-007 — `safe: false` trop conservateur bloque l'archivage des specs done

**Date** : 2026-06-24
**Auteur** : Steeve Evers
**SPEC concernée** : SPEC-026-1-archive-done
**Statut** : résolu

## Écart constaté

**Livré** : `aiad-sdd archive done --apply` n'archive aucun artefact.
`listerLivrables()` retourne 17 specs `done` toutes marquées `safe: false`
car elles possèdent une annotation `@spec SPEC-NNN-N` dans `lib/`.

**Désiré** : Les specs `done` annotées dans le code devraient être archivables —
les annotations `@spec` sont des marqueurs permanents qui documentent QUELLE spec
un morceau de code implémente ; elles ne disparaissent pas quand la spec est réalisée.

## Cause racine

`scannerSpecsVivantes(racine)` ne scanne que `lib/` et collecte tout `@spec`
référencé. `listerLivrables()` pose `safe: false` si l'ID de la spec est dans
ce set. La logique suppose que "présent dans le code = encore actif", mais :

1. Les annotations `@spec` sont permanentes par design (traçabilité).
2. Depuis le commit `78d3b9b`, `construireMatrice()` inclut les artefacts dans
   `archive/` dans `specsConnus` et `intentsConnus` — archiver une spec annotée
   ne déclenche plus d'"orphelin" dans la matrice de traçabilité.

La garde était valide avant `78d3b9b` ; elle est devenue caduque après ce fix.

## Impact qualifié

- **Type** : fonctionnel — la commande `archive done` ne remplit pas son rôle
- **Sévérité** : majeur — aucun spec ne peut être archivé automatiquement ;
  l'accumulation dans les dossiers actifs ne peut pas être résolue par la commande

## Décision d'action

**Action choisie** : patch immédiat — modifier `listerLivrables()` dans `lib/archive.js`
**Justification** : La définition de `safe` doit être mise à jour : une spec `done`
est `safe: true` indépendamment de ses annotations `@spec` dans le code, puisque
le trace system gère correctement les artefacts archivés depuis `78d3b9b`.
**Lien SPEC** : SPEC-026-1-archive-done (patch de la logique `safe` existante)

## Plan de patch

Dans `listerLivrables()` (`lib/archive.js`) :
- Supprimer la condition `safe: false` basée sur `specsVivantes`
- Conserver la condition `archivable` (exclusion de `research/`)
- Mettre à jour `raison` pour refléter le nouveau comportement

Critère de validation : `aiad-sdd archive done` affiche les specs et intents
`done` comme candidats, et `--apply` les déplace dans `archive/`.
