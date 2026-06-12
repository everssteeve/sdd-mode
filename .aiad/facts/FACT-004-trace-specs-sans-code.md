# FACT-004 — Le trace ne sait pas marquer `done` une SPEC sans code applicatif

**Date** : 2026-06-12
**Auteur** : Steeve Evers
**SPEC concernée** : SPEC-013-1a / 013-2 / 013-4a (INTENT-013)
**Statut** : ouvert

## Écart constaté

**Livré** : `lib/sdd-trace.js` classe toute SPEC en statut **`ready` / `validation`
/ `done`** sans annotation `@spec` dans un fichier **scanné** comme gap bloquant
`specsValideesNonImplementees`. Or `EXTENSIONS_CODE` (sdd-trace.js:70) ne couvre
**que du code applicatif** (.js/.ts/.py/.rs/.go/.java/…) — **pas** `.md`, `.html`,
ni `.yml`/`.yaml`.

Conséquence : une SPEC dont le livrable est **documentaire** (013-2 : GUIDE/CLAUDE,
docs/archive), **du contenu de site** (013-1a : `site/`) ou **un workflow CI**
(013-4a : `site-deploy.yml`) n'a aucun fichier scanné où poser `@spec`. Passer son
frontmatter à `done` déclenche donc un **faux gap** « validée non implémentée », et
le Stop hook bloque la clôture.

**Désiré** : pouvoir marquer `done` une SPEC réalisée mais sans code applicatif.

## Diagnostic

- 013-1a (frontmatter `done`) → flaggée.
- 013-2 et 013-4a paraissaient OK uniquement parce que leur **frontmatter était
  resté `review`** (incohérent avec leur index/corps `done`) — donc hors de la
  liste déclencheuse `[ready, validation, done]`. Inconsistance, pas conformité.
- `.yml` n'est pas scanné : l'`@spec SPEC-013-4a` de `site-deploy.yml` n'est pas vu.

## Impact qualifié

- **Type** : conformité (outillage de traçabilité)
- **Sévérité** : mineur — mais piège systématique pour toute SPEC doc/déploiement/CI.

## Décision d'action

**Action choisie (contournement)** : le « done » des SPECs sans code est porté au
niveau **INTENT** (CHANGELOG + statut intent, qui ne gappent pas) ; le frontmatter
de la SPEC reste à un statut non-déclencheur (`in-progress`) avec note explicite.
Le travail EST livré (site publié, docs unifiées) — seul le frontmatter est tenu.

**Fix propre (à cadrer)** : ajouter au trace une **exemption explicite** — soit un
champ frontmatter `traceability: exempt` (+ raison), soit l'inclusion de `.yml`/
`.md`/`.html` dans la reconnaissance d'`@spec` pour les SPECs non-applicatives.
Signal versé à INTENT-002 (gouvernance enforced). Voir [[FACT-002]] (même famille :
statut figé sans `@spec` = gap).
