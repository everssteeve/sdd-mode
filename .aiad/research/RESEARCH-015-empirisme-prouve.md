---
id: RESEARCH-015
title: Empirisme prouvé — gates qualité bloquants + claims sourcés
intent: INTENT-014
target_spec: SPEC-014-1, SPEC-014-2
author: Steeve Evers
date: 2026-06-12
verdict: CONDITIONAL GO
confidence: 85
---

# RESEARCH-015 — Empirisme prouvé

**Intent parent** : INTENT-014 — Empirisme prouvé (gates qualité actifs et claims sourcés)
**SPECs visées** : SPEC-014-1 (gates CI/publish + badge) · SPEC-014-2 (protocole `bench/` + sourcing claims)
**Question** : nos gates de qualité (taille, couverture) bloquent-ils vraiment, et nos
chiffres publics sont-ils sourcés — vu le code réel ? À quel coût pour les rendre
empiriquement défendables sans alourdir le cycle ?

> ⚠ **La prémisse de l'Intent est partiellement fausse — corrigée par le Discovery.**
> INTENT-014 §15-22 affirme que `lint:size --strict` et `test:coverage:threshold`
> « ne s'exécutent **jamais** en CI ». Le Discovery prouve le contraire : les deux
> tournent en CI (`ci.yml`). Le trou réel est plus étroit (publication + badge +
> caractère bloquant + sourcing du 50K), ce qui **réduit** le coût de l'intention.

## Discovery

Ancrages `chemin:ligne` (investigation 2026-06-12, ce repo, agent Explore read-only).

**Gates : existent, tournent en CI, mais ne bloquent pas la publication**

- `package.json:41` — `test:coverage:threshold` = `node scripts/coverage-threshold.js`.
- `package.json:44` — `lint:size` = `node scripts/lint-size.js --strict`.
- `package.json:51` — `prepublishOnly` = `lint && lint:deps && test` → **n'invoque
  NI `lint:size --strict` NI `test:coverage:threshold`** : une publication peut
  passer même si un gate échoue.
- `.github/workflows/ci.yml:32-33` — `lint:size` **tourne en CI** (contredit la
  prémisse de l'Intent).
- `.github/workflows/ci.yml:41-50` — job `coverage` exécute bien
  `test:coverage:threshold` sur Node 22.
- `release.yml:34-35` — la publication npm ne lance que `lint` + `test` → **mêmes
  gates absents** au moment du release.

**Seuils : définis et documentés (zéro-dep)**

- `scripts/coverage-threshold.js:33-37` — seuils explicites `lines 75 / branches 70
  / funcs 65 %`, dérivés de la baseline mesurée v1.14.0 (80/75/68), volontairement
  conservateurs. Outil = `node --test --experimental-test-coverage` natif (aucun
  c8/nyc/vitest).
- `scripts/lint-size.js:31` — seuil 700 LOC ; `:9-10,206-212` — `--strict` ⇒ exit 1 ;
  whitelist `.aiad-size-budget.json` (5 modules exceptés aujourd'hui).
- **Badge de couverture : absent** — aucun upload codecov/coveralls/shields, aucune
  persistance historique.

**Claims chiffrés : les deux cités par l'Intent sont DÉJÀ des citations externes datées**

- `frameworkAIAD.md:114` — « −41,7 % de tokens » est attribué à **R2Code (arXiv,
  avril 2026)** ; « AWS Strands (2026) −96 % » idem. Répliqués dans
  `templates/frameworkAIAD.md:114`, `docs/archive/SDDMode.md:55,208`,
  `templates/SDDMode.md:50,203`. → la branche « requalifié en citation externe
  datée » de l'objectif est **déjà satisfaite** pour ces deux claims.
- Le claim réellement **non sourcé** est ailleurs : le **seuil 50K tokens** codé en
  dur dans `.claude/sdd/gate.md`, `.claude/sdd/exec.md`, `.claude/sdd/split.md`,
  `.claude/skills/context-budget/SKILL.md` — déjà tracé par
  [FACT-001](../facts/FACT-001-seuil-50k-non-source.md). Le 60-70 % de fenêtre, lui,
  est sourcé ; le 50K n'en dérive pas (35 % de 130k ≠ 50k).

**`bench/` : protocole reproductible pour la PERF, pas pour les TOKENS**

- `bench/comparison.md:44-70` — protocole N-runs reproductible via
  `node scripts/bench-comparison.js --runs 10 --files 1000` (cold-start, init, scan
  trace, doctor). **Aucun protocole de mesure de tokens.**
- `bench/scenario-autonomous-run/REPORT.md` — run SDD complet 10 itérations
  (25 findings) = test d'exécution du framework, **pas** une mesure de tokens.

**Surface de test : large et zéro-dep**

- `test/` — 242 fichiers `*.test.js`, runner natif `node --test` (`package.json:38,40`).
  Baseline couverture connue v1.14.0 : 80/75/68 %.

## Faisabilité

**SPEC-014-1 (gates bloquants + badge) — faible coût, élevée faisabilité.** Le gros
est déjà là (scripts, seuils, jobs CI). Travail réel :
1. ajouter `lint:size --strict` + `test:coverage:threshold` à `prepublishOnly`
   (`package.json:51`) **et** au `release.yml` ;
2. garantir que les jobs CI **font échouer** la PR (capturer l'exit code, pas le
   mode warn) ;
3. publier un badge de couverture sans introduire de dépendance (générer un badge
   shields.io statique depuis la sortie du script, ou un endpoint JSON committé).
Coût estimé ~0,5 j. Contrainte dure : **ne pas casser `prepublishOnly`**, rester
zéro-dep (cohérent INTENT-015 « sobriété du CLI »).

**SPEC-014-2 (sourcing) — coût moyen, faisabilité moyenne, dépend d'un choix humain.**
Deux sous-trous distincts :
- (a) **50K tokens** (FACT-001) : soit le **dériver** (instrumenter une mesure dans
  `bench/`), soit le **requalifier** en heuristique non sourcée assumée. C'est une
  décision, pas un coût technique.
- (b) **protocole `bench/` tokens** : créer un scénario reproductible mesurant la
  consommation tokens spec-anchored vs non — coût réel et non trivial (instrumenter
  une vraie session agent de façon déterministe est difficile). À ne PAS confondre
  avec « sourcer 41,7 % / −96 % » : ces deux-là sont déjà des citations externes ;
  un protocole interne serait une *corroboration*, pas une obligation.

## Risques & inconnues

- **R1** — rendre `prepublishOnly`/CI bloquants peut **casser un release en cours**
  si la couverture courante est sous le seuil. À vérifier : mesurer la couverture
  réelle actuelle avant d'armer le gate (sinon la prochaine release casse).
  Pas une inconnue humaine — vérifiable techniquement, à faire en SPEC (→ C-R1).
- **R2** — choix de la **mécanique de badge** sans dépendance runtime : décision
  technique (RGESN) — endpoint JSON shields vs badge SVG committé. Condition, pas
  bloquant.
- **R3 (TRANCHÉ — Steeve Evers, 2026-06-12)** — le **50K tokens** est **requalifié
  en heuristique opérationnelle assumée non sourcée** (documenté comme tel, sans
  prétention de dérivation). Le 60-70 % de fenêtre reste la donnée sourcée. Pas de
  bench dédié au 50K. → devient C-R3.
- **R4 (TRANCHÉ — Steeve Evers, 2026-06-12)** — SPEC-014-2 = **sourcing seul** :
  vérifier/figer le sourcing externe existant (41,7 % R2Code, −96 % AWS Strands déjà
  OK) + requalifier le 50K. **Pas de nouveau protocole `bench/` de mesure tokens**
  (coût/faisabilité jugés non justifiés à ce stade). → réduit le périmètre de 014-2.
- **R5 (gouvernance RGESN)** — toute mécanique de badge / job CI supplémentaire doit
  rester zéro-dep et sobre (pas d'action tierce lourde). Qualification au moment de
  la SPEC.

## Verdict : CONDITIONAL GO (confidence: 85 %)

**Déclaré CONDITIONAL GO par Steeve Evers (gardien), 2026-06-12.** SPEC-014-1
(gates bloquants + badge) est viable et peu coûteuse — l'essentiel existe déjà. Les
décisions de fond R3 (50K → heuristique assumée) et R4 (014-2 = sourcing seul) ont
été tranchées par l'humain et **réduisent** le périmètre. Les risques techniques
restants (R1/R2/R5) deviennent les conditions à lever pendant `/sdd spec`.
`/sdd spec` autorisé (CONDITIONAL = exit 0).

## Conditions (à lever dans SPEC-014-1 / SPEC-014-2)

- **C-R1** (014-1) : mesurer la couverture réelle courante **avant** d'armer le gate
  bloquant dans `prepublishOnly`/`release.yml` (ne pas casser la prochaine release).
- **C-R2** (014-1) : badge de couverture **sans dépendance runtime** — RGESN
  (endpoint JSON shields ou SVG committé, pas d'action tierce lourde).
- **C-R3** (014-2) : requalifier explicitement le seuil **50K en heuristique
  assumée non sourcée** dans les 4 fichiers (FACT-001), sans prétendre le dériver.
- **C-R5** (gouvernance) : qualification RGESN de tout job CI / mécanique de badge
  ajouté (zéro-dep, sobriété — cohérent INTENT-015).

> **Note de périmètre** : SPEC-014-2 est volontairement **sourcing seul** (R4) — pas
> de protocole `bench/` tokens. Les claims 41,7 % (R2Code) et −96 % (AWS Strands)
> sont déjà des citations externes datées ; 014-2 les fige et requalifie le 50K.
