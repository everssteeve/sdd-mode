---
id: INTENT-024
title: Traçabilité honnête des SPECs sans code applicatif — exemption explicite
status: archived
author: Steeve Evers
date: "2026-06-19"
specs: SPEC-024-1
origin: FACT-004
archivedAt: "2026-06-24T07:17:03.704Z"
archivedBy: evers.steeve@gmail.com
archivedReason: archive done
---
# INTENT-024 — Traçabilité honnête des SPECs sans code applicatif

## Pourquoi maintenant

**Origine : [[FACT-004]]** (ouvert depuis 2026-06-12). `lib/sdd-trace.js` ne
reconnaît `@spec` que dans du **code applicatif** (`EXTENSIONS_CODE` —
`.js/.ts/.py/…`), jamais dans `.md`, `.html`, `.yml`. Conséquence : une SPEC dont
le livrable est **documentaire** (013-2), **du contenu de site** (013-1a) ou **un
workflow CI** (013-4a) ne peut pas être marquée `done` sans déclencher un faux gap
`specsValideesNonImplementees` (sdd-trace.js:535) — et le Stop hook bloque la clôture.

Le contournement actuel (tenir le frontmatter à `in-progress` et porter le « done »
au niveau INTENT) produit un **signal trompeur récurrent** : `/aiad status` et le
trace affichent des SPECs « in-progress » qui sont en réalité **livrées**. C'est
précisément ce qui a fait remonter un faux positif d'incohérence sur INTENT-013.
Un framework dont la valeur n°2 est « Honnêteté sur les Contradictions » ne peut pas
laisser son propre outil de traçabilité afficher du faux WIP.

## Pour qui

- **Nous-mêmes** (dogfooding) : pouvoir clôturer honnêtement une SPEC doc/site/CI.
- **Les utilisateurs du CLI** : toute SPEC dont le livrable n'est pas du code
  applicatif scanné (docs, infra, config, contenu) — piège systématique aujourd'hui.

## Objectif

- Permettre de marquer `done` une SPEC **réalisée mais sans code applicatif
  annotable**, via une **exemption explicite et tracée** au frontmatter — sans
  affaiblir la détection de drift pour les SPECs qui, elles, doivent porter du code.
- Faire disparaître le faux gap `specsValideesNonImplementees` pour ces SPECs.

## Contraintes

- **Fail-honest, pas fail-open** : l'exemption doit être **explicite** (champ +
  raison obligatoire), jamais un défaut silencieux. Une SPEC sans exemption et sans
  code reste un gap (comportement actuel préservé).
- **Zéro dépendance** (contrainte structurante du projet).
- Rétro-compatible : les SPECs existantes sans le champ se comportent comme avant.

## Critère de réussite (drift)

Après le fix : une SPEC `done` portant `traceability: exempt` + raison ne figure
**plus** dans `specsValideesNonImplementees` ; une SPEC `done` **sans** ce champ et
sans code y figure **toujours**. Vérifiable par test `node --test`.

---

## SPECs liées

- [ ] SPEC-024-1 — Exemption de traçabilité pour SPECs sans code applicatif (EARS)
