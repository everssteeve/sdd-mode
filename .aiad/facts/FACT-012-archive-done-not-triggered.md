# FACT-012 — `archive done` non déclenché après clôture INTENT-030 + SPECs

**Date** : 2026-06-25
**Auteur** : Steeve Evers
**SPEC concernée** : SPEC-026-1-archive-done
**Statut** : résolu (patch immédiat)

## Écart constaté

**Livré** : Après que INTENT-030 et ses 4 SPECs ont été basculées en `done`
(drift-check OK, commit `878bc80`), les fichiers restent dans les répertoires actifs :
- `.aiad/intents/INTENT-030-ecologits-impact-ecologique.md`
- `.aiad/specs/SPEC-030-1-eco-estimator.md`
- `.aiad/specs/SPEC-030-2-hook-stop.md`
- `.aiad/specs/SPEC-030-3-validate-badge.md`
- `.aiad/specs/SPEC-030-4-dashboard-eco.md`

`npx aiad-sdd archive done --dry-run` détecte 4 candidats (SPEC-030-2 absente
car fichier encore à `review` — drift de statut, cf. ci-dessous) mais n'archive
rien sans `--apply`.

**Désiré** : Après un drift-check validé (`done`), les artefacts devraient soit
être archivés automatiquement, soit déclencher un signal clair invitant le PE à
lancer `archive done --apply`.

## Anomalie secondaire — drift statut SPEC-030-2

**Livré** : `SPEC-030-2-hook-stop.md` contient `**Statut** : review`.
**Désiré** : `done` (cohérent avec `specs/_index.md` et la livraison effective).
**Action immédiate** : patch du fichier SPEC-030-2 → `done`.

## Impact qualifié

- **Type** : fonctionnel (UX cycle SDD — friction post-drift-check)
- **Sévérité** : mineur — pas de bug ni de drift de code ; encombrement progressif
  des répertoires actifs et risque d'oubli d'archivage

## Relation avec FACTs antérieurs

- **FACT-006** (2026-06-23) — même symptôme sur INTENT-018. Action décidée : INTENT-026.
- **SPEC-026-1** implémentée : commande `archive done` disponible mais toujours manuelle.
- Ce FACT prouve que le problème persiste cycle après cycle → l'intention d'auto-archivage
  (INTENT-029 ou extension) reste prioritaire.

## Décision d'action

**Action choisie** : deux actions
1. **Patch immédiat** — corriger `SPEC-030-2` statut `review → done` + lancer
   `npx aiad-sdd archive done --apply` pour archiver les 5 artefacts INTENT-030.
2. **Nouveau Intent Statement** — étendre INTENT-029 (archivage FACTs résolus)
   ou créer un intent dédié : déclencher `archive done --apply` automatiquement
   après un drift-check `OK` (hook post-drift-check).

**Justification** : L'archivage manuel fonctionne mais n'est pas déclenché
naturellement dans le cycle. Un hook ou une invite post-drift-check supprimerait
cette friction sans changer la sémantique de la commande.

**Lien SPEC** : SPEC-026-1 (existante) + INTENT-029 (à étendre) ou nouvel Intent
