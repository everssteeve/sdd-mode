# Changelog des Artefacts AIAD

> Ce fichier trace les mises à jour significatives des artefacts SDD Mode.
> Il permet de vérifier la synchronisation artefacts/code lors du Drift Check.

## Format

```
## [Date] — [Artefact] — [Type de changement]

**Auteur** : [Qui]
**Raison** : [Pourquoi cette mise à jour]
**Impact** : [SPECs ou code affectés]
```

---

<!-- Ajoutez vos entrées ci-dessous, les plus récentes en haut -->

## 2026-06-15 — SPEC-014-1 — Drift Check OK (gates bloquants + badge)

**Auteur** : Steeve Evers
**Raison** : Drift Lock vérifié pour SPEC-014-1 (INTENT-014) — heuristique git OK
(SPEC + code annoté `@spec` dans la même PR #5) + traçabilité machine sans gap
(`trace --fail-on-gap` exit 0 : 0 SPEC validée non-implémentée, 0 orphelin).
**Impact** : `package.json`, `.github/workflows/{ci,release}.yml`,
`scripts/coverage-threshold.js`, `test/coverage-threshold.test.js`,
`.aiad/metrics/coverage/badge.json`, `README.md`. Statut SPEC `validation` →
`done` à la fusion de la PR #5 (non encore mergée).

## 2026-06-15 — SPEC-002-1 → 012-1 + INTENT-002 → 012 — Rattrapage de board (done)

**Auteur** : Steeve Evers
**Raison** : Board drift inverse — la vague §3.x (gouvernance enforced, research,
exécution phasée, gouvernance pull, canary, memory, cycle-graph, observabilité,
cross-model, hooks toggles, garde-fous) était livrée et testée sans que les
statuts d'index/frontmatter n'aient été mis à jour. Réalité du code : 11
implémentations `lib/` + 11 tests dédiés présents. Alignement des artefacts.
**Impact** : `.aiad/specs/_index.md` (11 lignes in-progress → done),
`.aiad/intents/_index.md` (11 lignes active → done), 11 frontmatters SPEC + 11
frontmatters INTENT (002→012). `SPEC-013-1a` et la légende laissés inchangés.
**Réserve traçabilité** : `SPEC-005-1` (gouvernance pull) est implémentée
(`lib/emit-rules.js`, `.claude/rules/`, `emit-rules-pull.test.js`) mais ne porte
**aucune annotation `@spec`** dans le code → gap `/sdd trace` à combler.

## 2026-06-12 — INTENT-013 + SPEC-013-1a — done (site v1.18 publié)

**Auteur** : Steeve Evers
**Raison** : site aiad.ovh **déployé en v1.18** via `site-deploy.yml` (gh-pages
`df34283`, gate version OK, vérifié sur la branche live). Les 3 objectifs de
l'intention sont atteints (0 écart de version, site v1.18, valeurs unifiées).
Clôture décidée par le gardien.
**Impact** : INTENT-013 → `done`. SPEC-013-1a : objectif atteint (site publié),
frontmatter tenu `in-progress` car le trace ne sait pas marquer `done` une SPEC
sans code applicatif (FACT-004) ; audit RGAA AA délégué à 013-4b. Résidu : 013-4b
gate RGAA, renforcement hors périmètre original, conservé en `draft`.

## 2026-06-11 — SPEC-013-4a — Drift Lock OK (done)

**Auteur** : Steeve Evers
**Raison** : `/sdd drift-check` après VALIDÉ — workflow + SPEC synchronisés,
0 gap bloquant, `@spec SPEC-013-4a` tracé.
**Impact** : `.github/workflows/site-deploy.yml` (nouveau) — déploiement
`site/` → `gh-pages` sous gate `version-sync --check`. SPEC-013-4 découpée
(013-4a done · 013-4b draft RGAA). 1er run de publication = merge `main` (humain).

## 2026-06-11 — SPEC-013-2 — Drift Lock OK (done)

**Auteur** : Steeve Evers
**Raison** : `/sdd drift-check` après VALIDÉ — code/docs + SPEC synchronisés,
0 gap bloquant. SPEC documentaire (pas d'annotation `@spec` requise).
**Impact** : `SDDMode.md` → `docs/archive/SDDMode.md` (+ en-tête historique) ;
`GUIDE.md` et corps `CLAUDE.md` rendus version-agnostiques ; provenance historique
préservée. SPEC-013-2 → `done`.

## 2026-06-11 — SPEC-013-3 — Drift Lock OK (done)

**Auteur** : Steeve Evers
**Raison** : `/sdd drift-check` après validation — code + SPEC synchronisés dans
la même PR, 0 gap de traçabilité bloquant, `@spec SPEC-013-3` tracé, CI 7/7 verte.
**Impact** : `lib/version-sync.js` (nouveau), `bin/aiad-sdd.js` (handler
`version-sync`), `.github/workflows/aiad-version-check.yml` (nouveau),
`test/version-sync.test.js`, 57 pages `site/` (zones marquées), `package.json`
bumpé 1.17.0 → 1.18.0 + cascade emit-rules/docs. SPEC-013-3 → `done`.
