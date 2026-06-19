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

## 2026-06-19 — SPEC-015-3 — Drift Check OK (matrice garde-fous + veto non-bypassable)

**Auteur** : Steeve Evers
**Raison** : Drift Lock vérifié pour SPEC-015-3 (INTENT-015) — heuristique git OK
(SPEC + `lib/guardrails.js` + correctif `.aiad/hooks/veto.js` + test annotés
`@spec SPEC-015-3` dans le même changeset) + traçabilité machine sans gap
(`trace --fail-on-gap` exit 0). RESEARCH-018 avait révélé que le veto Tier 1 était
**bypassable** via `AIAD_HOOK_SILENT=1` (veto.js:28) ; le correctif retire ce
bypass (C3) et l'audit `test/guardrails.test.js` empêche sa réintroduction
(C-MATRICE). Matrice publiée via `aiad-sdd guardrails` (17 garde-fous, 11
enforced / 6 advisory). Reste : code review + PR avant `done`.
**Impact** : `.aiad/hooks/veto.js` (bypass retiré), `lib/guardrails.js` (matrice +
audit), `bin/aiad-sdd.js` (commande `guardrails`), `lib/commands-registry.js` +
`test/commands-registry.test.js` (`guardrails` au registre, snapshot MAJ),
`test/guardrails.test.js` (8/8), `.aiad/specs/SPEC-015-3-…md`,
`.aiad/research/RESEARCH-018-…md`, `DOCUMENTATION.md` + badge régénérés.

## 2026-06-19 — SPEC-015-2-2 → done — Clôture de board

**Auteur** : Steeve Evers
**Raison** : PR #12 (cycle de dépréciation soft) mergée dans `main` (squash
`8562b92`), CI verte du premier coup, code review OK. Troisième brique de
INTENT-015 : mécanisme de dépréciation soft livré dormant (warning stderr non
bloquant au dispatch, exécution préservée). Reste SPEC-015-3 (matrice
enforced/advisory) pour clore l'intent.
**Impact** : SPEC-015-2-2 `in-progress → done` (PR #12). INTENT-015 reste `active`
(SPEC-015-3 matrice garde-fous à venir).

## 2026-06-19 — SPEC-015-2-2 — Drift Check OK (cycle de dépréciation)

**Auteur** : Steeve Evers
**Raison** : Drift Lock vérifié pour SPEC-015-2-2 (INTENT-015) — heuristique git OK
(SPEC + `lib/deprecation.js` + test annotés `@spec SPEC-015-2-2` dans le même
changeset) + traçabilité machine sans gap bloquant (`trace --fail-on-gap` exit 0).
Cycle : research (RESEARCH-017) → spec (EARS 5/5) → gate (OUVERTE) → exec →
validate (VALIDÉ, RGESN PASS). Mécanisme de dépréciation soft livré **dormant**
(0 commande dépréciée) : warning stderr non bloquant au dispatch, exécution
préservée (C2). Première dépréciation concrète = décision humaine séparée
(C-DATA). Reste : code review + PR avant `done`.
**Impact** : `lib/deprecation.js` (formatDeprecationNotice/deprecationNotice/
emitDeprecation/validateDeprecation), `bin/aiad-sdd.js` (émission au dispatch),
`lib/commands-registry.js` (rendu d'une entrée dépréciée), `test/deprecation.test.js`
(8/8), `.aiad/specs/SPEC-015-2-2-…md`.

## 2026-06-19 — SPEC-015-2-1 → done — Clôture de board

**Auteur** : Steeve Evers
**Raison** : PR #10 (registre catégorisé des commandes) mergée dans `main` (squash
`2b53fbc`), CI verte du premier coup (doc + badge régénérés au commit), code review
OK. Deuxième brique de INTENT-015 livrée : noyau de 25 commandes assumé, longue
traîne (48) et experimental (8) identifiés, figés par snapshot test (drift guard
exécutoire).
**Impact** : SPEC-015-2-1 `in-progress → done` (PR #10). INTENT-015 reste `active`
(SPEC-015-2-2 cycle de dépréciation + SPEC-015-3 matrice garde-fous à venir).

## 2026-06-17 — SPEC-015-2-1 — Drift Check OK (registre des commandes)

**Auteur** : Steeve Evers
**Raison** : Drift Lock vérifié pour SPEC-015-2-1 (INTENT-015) — heuristique git OK
(SPEC + `lib/commands-registry.js` + test annotés `@spec SPEC-015-2-1` dans le même
changeset) + traçabilité machine sans gap bloquant (`trace --fail-on-gap` exit 0).
Cycle : research (RESEARCH-017 CONDITIONAL GO 80 %) → spec (EARS 5/5, découpée
depuis 015-2) → gate (OUVERTE) → exec → validate (VALIDÉ, RGESN PASS). Le snapshot
test (CA-007) rend le critère de drift de l'intent exécutoire : 25 core / 48
extended / 8 experimental figés, re-tiering non tracé = CI rouge. Reste : code
review + PR avant `done`.
**Impact** : `lib/commands-registry.js` (COMMANDS_REGISTRY, tierOf/listByTier/
showCommands), `bin/aiad-sdd.js` (commande `commands [--tier] [--json]` + AIDE +
COMMANDES_VALIDES + OPTIONS_SCHEMA `--tier`), `test/commands-registry.test.js`
(8/8), `.aiad/specs/SPEC-015-2-1-…md`, `.aiad/research/RESEARCH-017-…md`,
`DOCUMENTATION.md` + badge couverture régénérés.

## 2026-06-17 — SPEC-015-1 → done — Clôture de board

**Auteur** : Steeve Evers
**Raison** : PR #8 (`telemetry usage`) mergée dans `main` (squash `fcad893`), CI
verte (tests Node 18/20/22 × ubuntu/macos, builds reproductibles, parité
emit-rules/doc, traçabilité, couverture+badge, Bun), code review OK. Première
brique de INTENT-015 livrée : la donnée d'usage réelle est désormais lisible
localement pour ancrer le tiering (condition C1 de RESEARCH-016 servie).
**Impact** : SPEC-015-1 `in-progress → done` (PR #8). INTENT-015 reste `active`
(SPEC-015-2 tiering + SPEC-015-3 matrice garde-fous à venir).

## 2026-06-16 — SPEC-015-1 — Drift Check OK (telemetry usage)

**Auteur** : Steeve Evers
**Raison** : Drift Lock vérifié pour SPEC-015-1 (INTENT-015) — heuristique git OK
(SPEC créée + code annoté `@spec SPEC-015-1-telemetrie-usage` / `@intent INTENT-015`
/ `@verified-by` / `@governance AIAD-RGPD` dans le même changeset) + traçabilité
machine sans gap bloquant (`trace --fail-on-gap` exit 0 : SPECs validées
non-implémentées = 0, orphelins = 0, code annoté sans tests = 0). Cycle parcouru
intent → research (RESEARCH-016 CONDITIONAL GO) → spec (EARS 5/5) → gate (OUVERTE)
→ exec → validate (VALIDÉ, gouvernance RGPD/RGESN PASS). Reste : code review + PR
avant passage `done`.
**Impact** : `lib/telemetry.js` (readEvents/aggregateUsage/showUsage),
`bin/aiad-sdd.js` (sous-commande `telemetry usage [--json]` + AIDE),
`test/telemetry-usage.test.js` (10/10), `.aiad/specs/SPEC-015-1-…md`,
`.aiad/research/RESEARCH-016-…md`. Rendus emit-rules régénérés (intent actif).

## 2026-06-16 — INTENT-014 + SPEC-014-1/2 → done — Clôture de board

**Auteur** : Steeve Evers
**Raison** : PR #5 (gates bloquants + badge) et PR #6 (sourcing + guard lint:claims)
mergées dans `main`, CI verte (21/21), Drift Lock OK sur les deux SPECs. INTENT-014
« Empirisme prouvé » réalisé : gates couverture/taille bloquants au publish, badge
zéro-dep, 50K requalifié en heuristique assumée (FACT-001 clôturé), claims externes
figés, guard `lint:claims` anti-régression.
**Impact** : SPEC-014-1 `validation → done`, SPEC-014-2 `validation → done`,
INTENT-014 `active → done`. Rendus emit-rules régénérés (intent actif).

## 2026-06-15 — SPEC-014-2 — Drift Check OK (sourcing + guard lint:claims)

**Auteur** : Steeve Evers
**Raison** : Drift Lock vérifié pour SPEC-014-2 (INTENT-014) — heuristique git OK
(SPEC + code annoté `@spec SPEC-014-2` dans la même PR #6) + traçabilité machine
sans gap (`trace --fail-on-gap` exit 0). Le guard `lint:claims` rend le sourcing
anti-régression (critère de drift INTENT-014 détecté en CI).
**Impact** : `.claude/sdd/{gate,exec,split}.md`,
`.claude/skills/context-budget/SKILL.md`, `.aiad/facts/FACT-001-…md` (clôturé),
`scripts/lint-claims.js`, `test/lint-claims.test.js`, `package.json`, `ci.yml`.
Statut SPEC `validation` → `done` à la fusion de la PR #6.

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
