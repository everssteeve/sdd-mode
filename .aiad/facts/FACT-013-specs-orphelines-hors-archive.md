# FACT-013 — SPECs done/split hors du dossier archive

**Date** : 2026-06-25
**Auteur** : Steeve Evers (PE)
**SPEC concernée** : SPEC-013-1, SPEC-013-1b, SPEC-013-4, SPEC-017-3, SPEC-026-1
**Statut** : résolu

## Écart constaté

**Livré** : 5 SPECs physiquement dans `.aiad/specs/` alors que leur INTENT parent est archivé et leur statut dans l'index est `done`, `archived` ou `split` (toutes sous-SPECs livrées).

**Désiré** : toute SPEC dont le statut est `done`, `archived` ou `split-terminé` doit résider dans `.aiad/specs/archive/` pour que l'archivage INTENT → SPEC soit cohérent.

| Fichier | Statut index | INTENT parent archivé |
|---------|-------------|----------------------|
| `SPEC-013-1-deploiement-site-valeurs.md` | `split` | INTENT-013 ✓ |
| `SPEC-013-1b-unification-7-valeurs.md` | `archived` | INTENT-013 ✓ |
| `SPEC-013-4-deploy-site-workflow.md` | `split` | INTENT-013 ✓ |
| `SPEC-017-3-digest-delta.md` | `done` | INTENT-017 ✓ |
| `SPEC-026-1-archive-done.md` | `done` | INTENT-026 ✓ |

## Impact qualifié

- **Type** : conformité artefact (artefact-state-inconsistency)
- **Sévérité** : mineur (pas d'impact fonctionnel, mais bruit dans le dossier actif et risque de confusion lors d'un `/sdd drift-check`)

## Décision d'action

**Action choisie** : patch immédiat — déplacement vers `.aiad/specs/archive/`
**Justification** : les SPECs sont terminées, leur INTENT est archivé ; le seul écart est leur emplacement physique. Aucun nouveau Intent requis.
**Lien SPEC** : SPEC-026-1 (commande `archive done` — ce FACT révèle que le déclenchement automatique n'a pas couvert les SPECs parentes `split` ni les SPECs `done` dont l'INTENT seul avait été archivé manuellement).

## Cause racine

La commande `/aiad archive done` (SPEC-026-1 / FACT-012) archive correctement les INTENTs et leurs SPECs directement liées, mais ne couvre pas :
1. Les SPECs parentes marquées `split` quand toutes leurs sous-SPECs sont livrées.
2. Les SPECs dont le statut index est `archived` mais dont le fichier n'a pas été déplacé physiquement.
