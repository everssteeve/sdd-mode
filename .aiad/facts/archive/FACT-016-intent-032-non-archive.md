---
status: archived
archivedAt: "2026-06-30T07:28:53.255Z"
archivedBy: evers.steeve@gmail.com
archivedReason: archive done
---
# FACT-016 — INTENT-032 non archivé après archivage manuel de SPEC-032-1

**Date** : 2026-06-25
**Auteur** : Steeve Evers
**SPEC concernée** : SPEC-026-1 (archive done), SPEC-026-2 (archive done split/orphelins)
**Statut** : résolu

## Écart constaté

**Livré** : commit `17ffd9d` archive SPEC-032-1 manuellement (move + `_index.md`) sans passer par `npx aiad-sdd archive done`. INTENT-032 reste dans `.aiad/intents/`.

**Désiré** : INTENT-032 (status `done` dans le frontmatter) archivé dans `.aiad/intents/archive/` dans la même opération.

## Impact qualifié

- Type : conformité spec (Drift Lock — SPEC-026-1)
- Sévérité : mineur
- `listerLivrables` détecte correctement INTENT-032 comme archivable (`safe: true`) — le code est sain, le workflow a été court-circuité.

## Cause racine

Archivage manuel d'une SPEC (move + patch index) au lieu de `npx aiad-sdd archive done`. Pattern identique à FACT-012.

## Décision d'action

**Action choisie** : patch immédiat + lien vers FACT-012 (pattern récurrent).
**Justification** : `archive done` traite INTENT-032 correctement ; il suffit de l'exécuter. La récurrence du pattern (FACT-012 + FACT-016) mérite un guard en aval (voir INTENT-029 — archivage FACTs résolus).
**Lien SPEC** : SPEC-026-1 — la commande `archive done` est la voie normale, l'archivage manuel est le vrai problème.
