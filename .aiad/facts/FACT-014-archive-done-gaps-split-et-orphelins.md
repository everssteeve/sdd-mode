# FACT-014 — `archive done` ne couvre pas les SPECs `split` ni les originaux orphelins

**Date** : 2026-06-25
**Auteur** : Steeve Evers (PE)
**SPEC concernée** : SPEC-026-1 (`archive done`)
**Statut** : résolu (2026-06-25 — SPEC-026-2 implémentée)

## Écart constaté

**Livré** : `aiad-sdd archive done` évalue l'éligibilité sur le critère `status: done` + `safe: true` (frontmatter du fichier physique).

**Désiré** : deux cas supplémentaires doivent déclencher l'archivage automatique :

1. **SPECs parentes `split`** — une SPEC dont le frontmatter est `status: split` est éligible à l'archivage dès lors que toutes ses sous-SPECs sont `done` ou `archived`. Aujourd'hui ce statut l'exclut silencieusement de la liste des candidats.

2. **Originaux orphelins** — un fichier peut être copié dans `archive/` sans que l'original soit supprimé (cas du commit `4e8a02f` pour SPEC-030-x). La commande ne détecte pas cette incohérence (fichier tracké en `_index.md` avec statut `archived` mais présent hors archive).

Les deux gaps ont été constatés lors de la résolution de FACT-013 : 5 SPECs ont dû être déplacées manuellement.

## Impact qualifié

- **Type** : conformité spec (SPEC-026-1 CA-001 non exhaustif)
- **Sévérité** : mineur (pas d'impact fonctionnel, mais accumulation de bruit dans le dossier actif à chaque cycle d'archivage)

## Décision d'action

**Action choisie** : ajustement SPEC (extension de SPEC-026-1) via `/sdd spec`
**Justification** : l'intention d'INTENT-026 est bien couverte dans sa version actuelle ; il s'agit d'étendre la définition des candidats éligibles, pas de créer une nouvelle intention. La SPEC-026-1 est archivée → une nouvelle sous-SPEC SPEC-026-2 est préférable à une modification rétroactive.
**Lien SPEC** : SPEC-026-1 (à étendre via SPEC-026-2)

## Critères de résolution

- [x] SPEC-026-2 rédigée et passant SQS ≥ 4/5
- [x] `archive done` liste les SPECs `split` dont toutes les sous-SPECs sont `done`/`archived`
- [x] `archive done` détecte les originaux orphelins (présents en `_index.md` avec `status: archived` mais hors `archive/`) et les signale (sans archivage auto — décision PE)
- [x] Tests unitaires couvrant les deux nouveaux cas (9 tests, 45/45 pass)
