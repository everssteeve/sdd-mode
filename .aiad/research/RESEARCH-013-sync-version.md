---
id: RESEARCH-013
title: Synchronisation automatique des en-têtes de version + check CI
intent: INTENT-013
target_spec: SPEC-013-3
author: Steeve Evers
date: 2026-06-11
verdict: CONDITIONAL GO
confidence: 80
---

# RESEARCH-013 — Sync auto des en-têtes de version + check CI

**Intent parent** : INTENT-013 — Zéro drift sur soi-même
**SPEC visée** : SPEC-013-3
**Question** : peut-on garantir mécaniquement que toute version annoncée dans les
docs/site reste égale à `package.json`, et faire échouer la CI sinon — vu le code réel ?

## Discovery

Discovery réalisé par un agent `Explore` read-only le 2026-06-11. Ancrages
`chemin:ligne` ci-dessous, regroupés à plat (parser-friendly).

**Source de vérité de la version**

- `package.json:3` définit `"version"` (source unique).
- Lue à l'exécution, déjà, à trois endroits : `bin/aiad-sdd.js:129` (constante
  `VERSION`, handler `--version` en `bin/aiad-sdd.js:544`).
- `lib/emit-rules.js:35` expose `lirePackageVersion()`, appelée en `lib/emit-rules.js:739`.
- `lib/docs.js:29` expose la même fonction, appelée en `lib/docs.js:238`.

**Mécanisme de stamping existant (réutilisable)**

- `lib/emit-rules.js:40` définit `sha256()` ; frontmatter `generated-by` + `source-hash`
  posés en `lib/emit-rules.js:221` et `lib/emit-rules.js:331` ; sentinelle DO-NOT-EDIT en `lib/emit-rules.js:158`.
- `lib/docs.js:43` génère `DOCUMENTATION.md` avec frontmatter `version:` + `source-hash` + sentinelle, mode `--check`.
- Le motif « zone marquée + hash + `--check` + auto-commentaire PR » est donc déjà éprouvé deux fois.

**Surface de drift (cœur de la faisabilité)**

- ~546 occurrences de versions (markdown + HTML), réparties en deux tiers.
- Tier automatisable (zones stampables) : `DOCUMENTATION.md:5` (frontmatter + titre, déjà auto),
  headers `CLAUDE.md`/`AGENTS.md` (déjà auto via emit-rules), footers du site, ex. `site/fr/nouveautes.html:265`.
- Tier prose (NON stampable sans risque) : phrases narratives, ex. `README.md:155` — un remplacement regex naïf corromprait des faits historiques.

**CI existante**

- `.github/workflows/aiad-emit-rules-check.yml:48` lance `emit-rules --check` (parité multi-runtime).
- `.github/workflows/aiad-docs-check.yml:31` lance `docs --check` (parité DOCUMENTATION.md).
- Aucun check de cohérence de version site/prose vs `package.json` : c'est le gap à combler.
- Tests réutilisables comme modèle : `test/docs.test.js:43` (sentinelle + source-hash), `test/emit-rules.test.js:37`.

## Faisabilité

**Réalisable avec l'architecture actuelle**, en réutilisant le motif `emit-rules`/`docs` :
nouveau `lib/version-sync.js` (lit `package.json`, injecte dans des **zones marquées**
`<!--VERSION:START/END-->`, mode `--check` + `--dry-run`) + commande
`aiad-sdd version-sync` + workflow CI (extension de `aiad-docs-check.yml` ou nouveau).
Coût estimé : ~1 sprint (core + tests), ~2-3 j de plus pour l'intégration CI/release.

## Risques & inconnues

- **R1 — Périmètre prose** : la version apparaît dans des phrases narratives. Stamper
  naïvement corromprait le sens. → Décision de périmètre nécessaire (cf. condition C1).
- **R2 — Site statique sans build** : pas de moteur de template dans `site/`. Soit
  zones marquées dans les footers, soit étape `site:sync` avant publication.
- **R3 — Fragilité regex** : si le format des docs change, les ancres doivent suivre.
  Mitigation : ancres stables (frontmatter `version:`, sentinelles), `version-sync.js`
  petit et très testé.
- **R4 — CHANGELOG** : titres de sections gérés par `scripts/release.js` — ne pas y
  toucher (déjà stable).

## Conditions (si CONDITIONAL GO)

- **C1** : restreindre le stamping aux **zones marquées** (frontmatter, titres,
  footers site) ; exclure explicitement la prose narrative, documentée comme
  « contexte historique, pas une promesse de version ».
- **C2** : le check CI compare uniquement ces zones marquées à `package.json`
  (exit 1 sur écart) ; il n'analyse pas la prose.

## Verdict : CONDITIONAL GO (confidence: 80 %)

Tranché par **Steeve Evers** (gardien), 2026-06-11. `/sdd spec` est autorisé pour
SPEC-013-3, **sous réserve** des conditions C1 et C2 ci-dessus (périmètre restreint
aux zones marquées, exclusion de la prose narrative). Faisabilité élevée : le motif
`emit-rules`/`docs` (zone marquée + `source-hash` + `--check` + auto-commentaire PR)
est déjà éprouvé deux fois dans le repo.
