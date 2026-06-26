# Changelog des Artefacts AIAD

> Ce fichier trace les mises à jour significatives des artefacts SDD Mode.
> Il permet de vérifier la synchronisation artefacts/code lors du Drift Check.

## 2026-06-25 — SPEC-021-2 — Drift Lock OK (done) + INTENT-021 → done

**Auteur** : Steeve Evers
**Raison** : `/sdd drift-check INTENT-021` après validation SPEC-021-2 — toutes les SPECs liées sont done (SPEC-021-1 + SPEC-021-2), 0 gap de traçabilité bloquant, `trace --fail-on-gap` exit 0.
**Impact** : `lib/empreinte-artefact.js` (formaterEmpreinte + collecterEmpreinteParArtefact — CA-001 à CA-010), `bin/aiad-sdd.js` (sous-commande `footprint`), `.claude/sdd/context.md` (étape empreinte mesurée), 3 suites de tests nouvelles (footprint-cli, footprint-context-directive, footprint-formatter — 16 cas). SPEC-021-2 → `done`. INTENT-021 → `done`.

## 2026-06-25 — INTENT-020 — Clôture + archivage (spec-anchored deltas + redevabilité bidirectionnelle)

**Auteur** : Steeve Evers
**Raison** : INTENT-020 complété — 2 SPECs livrées (`done`, trace-exempt car livrables 100 % éditoriaux) :
- SPEC-020-1 : modèle deltas/archive (specs = état courant) — templates + AGENT-GUIDE
- SPEC-020-2 : redevabilité bidirectionnelle (FACT enrichi + signal `constraint-violated`)
**Action** : passage `status: active → done`, case SPEC-020-2 cochée, puis `archive` des 3 artefacts (INTENT-020 + SPEC-020-1/2) via la CLI (audit + `archivedAt/By/Reason`).
**Impact** : fichiers déplacés vers `.aiad/intents/archive/` et `.aiad/specs/archive/` ; index mis à jour (`archived`). INTENT-020 → `archived`.

## 2026-06-25 — INTENT-031 — Chaînage automatique conditionnel + correctif hook Stop (Drift Lock)

**Auteur** : Steeve Evers
**Raison** : INTENT-031 complété — 3 SPECs livrées et validées :
- SPEC-031-1 : exclusion du statut `ready` des gaps bloquants `spec_validated_not_implemented` dans `lib/sdd-trace.js`
- SPEC-031-2 : moteur de chaînage automatique `lib/auto-chain.js` + intégration dans `lib/command-hooks.js:executerAfter` + retrait guard bin
- SPEC-031-3 : paramètre `auto_chain` dans `.aiad/config.yml` + `templates/.aiad/config.yml` + parser zero-dep `lib/auto-chain-config.js`
**Résultat** : cycle SDD `spec→gate→exec→validate→drift-check` réduit de 5-7 à ≤ 2 interruptions manuelles.
**Vérification** : 4137 tests pass, `trace --fail-on-gap` exit 0, RGESN CONFORME, zéro TODO-JNSP.
**Impact** : `lib/auto-chain.js` (new), `lib/auto-chain-config.js` (new), `lib/command-hooks.js`, `bin/aiad-sdd.js`, `lib/sdd-trace.js`, configs. INTENT-031 → `done`.

## 2026-06-25 — INTENT-032 — Archivage rattrapé (FACT-016)

**Auteur** : Steeve Evers
**Raison** : FACT-016 — SPEC-032-1 avait été archivée manuellement (commit `17ffd9d`) sans passer par `archive done`, laissant INTENT-032 hors archive. `npx aiad-sdd archive done --apply` exécuté. INTENT-032 → `archived`.
**Impact** : `.aiad/intents/archive/INTENT-032-model-recommendation-actionnable.md`. `_index.md` mis à jour.

## 2026-06-25 — SPEC-032-1 — `/model` actionnable dans 33 commandes `/sdd` et `/aiad` (Drift Lock)

**Auteur** : Steeve Evers
**Raison** : FACT-015 — les commandes documentaient un modèle recommandé en texte libre sans instruction `/model <id>` copiable. SPEC-032-1 implémentée : ligne `👉 /model <id>` ajoutée après chaque `**Recommandation modèle**` dans les 33 fichiers `.claude/sdd/*.md` + `.claude/aiad/*.md`. 4 doubles modèles résolus avec critère de choix explicite (`audit` / `security` / `gouvernance` / `research`). Vérification : `grep -rL '/model ' .claude/sdd/ .claude/aiad/` → 0 fichier.
**Impact** : 33 fichiers Markdown éditoriaux. SPEC-032-1 → `done (trace-exempt)`. FACT-015 → résolu. INTENT-032 → done.

## 2026-06-25 — SPEC-026-2 — `listerLivrables(split)` + `listerOrphelins` + tests (Drift Lock)

**Auteur** : Steeve Evers
**Raison** : FACT-014 — `archive done` ne couvrait pas les SPECs `split` ni les originaux orphelins. SPEC-026-2 implémentée : `listerSousSpecs` interne, extension de `listerLivrables`, nouvelle fonction `listerOrphelins` exportée, affichage section orphelins dans CLI (warning uniquement, jamais déplacés). 9 tests ajoutés (CA-001 à CA-007b), 45/45 pass.
**Impact** : `lib/archive.js` + `bin/aiad-sdd.js` + `test/archive.test.js`. SPEC-026-2 → `done`. FACT-014 → résolu.

## 2026-06-25 — FACT-014 — Gap `archive done` : SPECs `split` + originaux orphelins

**Auteur** : Steeve Evers
**Raison** : Cause racine identifiée lors de FACT-013 — `archive done` ne couvre ni les SPECs `split` (toutes sous-SPECs done) ni les originaux orphelins (copiés en archive sans suppression). Action : SPEC-026-2 à rédiger.
**Impact** : FACT-014 ouvert → déclenche `/sdd spec` pour SPEC-026-2.

## 2026-06-25 — SPEC-013-1/1b/4, SPEC-017-3, SPEC-026-1 — Archivage (FACT-013)

**Auteur** : Steeve Evers
**Raison** : `/sdd fact` — FACT-013 : 5 SPECs `done`/`archived`/`split` physiquement hors du dossier archive alors que leurs INTENTs parents (INTENT-013, INTENT-017, INTENT-026) étaient archivés. Patch immédiat.
**Impact** : SPEC-013-1, SPEC-013-1b, SPEC-013-4, SPEC-017-3, SPEC-026-1 → `.aiad/specs/archive/`. Dossier `.aiad/specs/` maintenant propre (aucune SPEC active orpheline).

## 2026-06-25 — INTENT-030 + SPEC-030-x — Archivage (FACT-012)

**Auteur** : Steeve Evers
**Raison** : `/sdd fact` — FACT-012 : artefacts `done` non archivés. Patch SPEC-030-2 (`review → done`). Archivage des 5 artefacts INTENT-030 via `archive done --apply`.
**Impact** : INTENT-030 + SPEC-030-1/2/3/4 → `.aiad/intents/archive/` + `.aiad/specs/archive/`. FACT-012 résolu (patch immédiat). Problème structurel (absence de déclenchement auto) → INTENT-029 à étendre.

## 2026-06-25 — INTENT-030 — Drift Lock artefact → done

**Auteur** : Steeve Evers
**Raison** : `/sdd drift-check INTENT-030` — drift artefact détecté : INTENT-030 restait `draft` alors que les 4 SPECs liées (030-1/2/3/4) étaient toutes `done` dans `specs/_index.md`. Mise à jour du fichier INTENT-030 (statut + tableau SPECs) et de `intents/_index.md`.
**Impact** : INTENT-030 → `done`. `intents/_index.md` mis à jour.

## 2026-06-25 — SPEC-030-4 — Drift Lock OK → done

**Auteur** : Steeve Evers
**Raison** : `/sdd drift-check SPEC-030-4` — heuristique git OK, matrice trace exit 0, 12/12 tests. Tous les critères d'acceptation vérifiés : `dashboard/eco.html` généré, widget EcoLogits dans `metrics.html`, RGAA `<th scope="col">` présent, libellé anti-greenwashing obligatoire, cas limites couverts. Annotations `@intent INTENT-030`, `@spec SPEC-030-4-dashboard-eco`, `@governance AIAD-RGAA,AIAD-RGESN` posées sur `lib/eco-dashboard.js`.
**Impact** : SPEC-030-4 → `done`. `_index.md` mis à jour (PR : 2026-06-25).

## 2026-06-25 — INTENT-030 / SPEC-030-3 — Gate OUVERTE + Drift Lock (done)

**Auteur** : Steeve Evers
**Raison** : `/sdd gate SPEC-030-3` — SQS 5/5, Gate OUVERTE. Exécution immédiate (session courte, directive uniquement). `.claude/sdd/validate.md` enrichi avec la section `## Badge EcoLogits` (Étape 6c) : lecture de `hook-runs.jsonl`, calcul co2Total/tokensTotal/sessionCount, émission du bloc `## Impact écologique` avec libellé anti-greenwashing obligatoire. Annotation `@spec SPEC-030-3-validate-badge` posée dans la directive.
**Impact** : `.claude/sdd/validate.md` — section Étape 6c ajoutée (~35 lignes). SPEC-030-3 → `done`.


## 2026-06-25 — INTENT-031 — Chaînage automatique conditionnel du cycle SDD + correctif hook Stop (draft)

**Auteur** : Steeve Evers
**Raison** : `/sdd intent` — couvre FACT-010 + FACT-011. Objectif : ≤ 2 interruptions manuelles/cycle (de 5-7). Transitions auto : spec→gate, exec→validate, validate→drift-check, drift-check→trace. Confirmation légère conservée pour research→spec et gate→exec. Seuil contexte 40% partout. Paramètre `auto_chain.enabled = true` par défaut.
**Impact** : `.aiad/intents/INTENT-031-auto-chaining-cycle-sdd.md` créé. `_index.md` mis à jour.

## 2026-06-25 — FACT-011 — Absence de chaînage automatique conditionnel entre étapes SDD (ouvert)

**Auteur** : Steeve Evers
**Raison** : `/sdd fact` — lacune structurelle : chaque étape du cycle SDD requiert une intervention manuelle du PE même quand la décision est algorithmiquement déterminable. Généralisation de FACT-010. → Intent INTENT-031 à créer (peut couvrir FACT-010 + FACT-011 conjointement).
**Impact** : `.aiad/facts/FACT-011-auto-chaining-sdd-steps.md` créé.

## 2026-06-25 — FACT-010 — Friction gate → exec (ouvert)

**Auteur** : Steeve Evers
**Raison** : `/sdd fact` — écart constaté entre prescription gate.md (MAJ statut → `ready` + `_index.md`) et comportement réel (statut non mis à jour, étape manuelle requise avant `/sdd exec`). → Intent INTENT-031 à créer pour fiabiliser + explorer chaînage gate → exec.
**Impact** : `.aiad/facts/FACT-010-gate-to-exec-friction.md` créé.

## 2026-06-24 — INTENT-030 / SPEC-030-1 — Drift Lock OK (done)

**Auteur** : Steeve Evers
**Raison** : `/sdd validate SPEC-030-1` après exec — 8/8 CA verts, lint OK, 4 075/4 075 tests, `trace --fail-on-gap` exit 0, gouvernance PASS (AI-ACT NON · RGPD NON · RGAA NON · RGESN PASS). CO2_LABEL anti-greenwashing constant. Zéro dépendance production.
**Impact** : `lib/eco-estimator.js` — `estimerImpact()` + `EcoModelsNotFoundError`, annotations @intent/@spec/@governance ; `lib/eco-models.json` — 4 modèles Claude (haiku/sonnet/opus/fable) valeurs EcoLogits Apache-2.0 ; `test/eco-estimator.test.js` CA-1→CA-8. SPEC-030-1 → `done`.

## 2026-06-24 — INTENT-026 / SPEC-026-1 — Drift Lock OK (done)

**Auteur** : Steeve Evers
**Raison** : `/sdd drift-check` après validation SPEC-026-1 — code + SPEC synchronisés, 0 violation EARS, 64/64 tests verts, `trace --fail-on-gap` exit 0. Correction RGPD Art. 6.1.f ajoutée sur `detecterActeur()` (base légale `archivedBy`).
**Impact** : `lib/archive.js` — `archiverTous()` + commentaire RGPD (l.88–97) ; `bin/aiad-sdd.js:2562` — branche `archive done` ; `lib/sdd-trace.js:230,256` — guard `archive/` dans `lireIntents()` et `lireSpecs()` ; `test/archive.test.js` CA-001→CA-008 ; `test/trace.test.js` CA-009 ; `test/dashboard-collect.test.js` CA-010. SPEC-026-1 → `done`. INTENT-026 → `done`.

## Format

```
## [Date] — [Artefact] — [Type de changement]

**Auteur** : [Qui]
**Raison** : [Pourquoi cette mise à jour]
**Impact** : [SPECs ou code affectés]
```

---

<!-- Ajoutez vos entrées ci-dessous, les plus récentes en haut -->

## 2026-06-23 — INTENT-018 → done — Drift Lock cycle complet

**Auteur** : Steeve Evers + Claude (Sonnet 4.6)
**Raison** : Toutes les 5 SPECs de INTENT-018 validées et commitées — drift-check final OK
**Impact** :
- `INTENT-018-valeur-boussole.md` : `status: active → done`, 5 SPECs cochées
- SPEC-018-1 à SPEC-018-5 : toutes `done`, SQS 5/5, DoOD 100 %
- Traces : 0 gap bloquant, annotations `@spec` + `@intent` + `@governance` en place
- Tests : 23/23 (SPEC-018-4) + 15/15 (SPEC-018-5), suite globale 4039/4040
- Pa11y WCAG2AA : 0 issues sur toutes les pages nouvelles

## 2026-06-23 — SPEC-018-1 → done — Matrice outcomes ↔ Intents

**Auteur** : Steeve Evers + Claude (Sonnet 4.6)
**Raison** : Implémenter la liaison inverse Intent → outcomes absente de `calculerOutcomeAttribution()` (INTENT-018 Wave 1)
**Impact** :
- `lib/dashboard/outcome-attribution.js` — +2 exports : `calculerMatriceOutcomesIntents`, `blocMatriceOutcomesIntents`
- `lib/dashboard/model/index.js:236` — injection `donnees.matriceOutcomesIntents` après `outcomeAttribution`
- `test/dashboard-matrice-outcomes.test.js` — 8 cas, fixture 2 outcomes × 3 Intents
- `@spec SPEC-018-1-matrice-outcomes-intents` posé dans 3 fichiers
- SQS 5/5 · Gouvernance PASS · Drift OK

## 2026-06-22 — INTENT-016 → done — Dashboard exemplaire (toutes SPECs clôturées)

**Auteur** : Steeve Evers
**Raison** : Clôture de l'intent après livraison des 4 SPECs. SPEC-016-1 et SPEC-016-2 livrées lors du commit `85b8415` et `0a186d4` — DoODs vérifiés rétrospectivement (lint ✓, tests ✓, coverage ✓). _index.md resté en `in-progress` par omission.
**Impact** : INTENT-016 → `done` · SPEC-016-1 → `done` · SPEC-016-2 → `done` · _index.md synchronisé

## 2026-06-22 — SPEC-016-1 → done — Architecture 4 couches (drift lock rétroactif)

**Auteur** : Steeve Evers
**Raison** : DoOD cochés rétrospectivement — livrables vérifiés : render.js 112 LOC, views/ ≤ 299 LOC, lint:size/esm/deps ✓, tests 3919 pass, coverage 92 %/83 %/91 %, cycle toléré documenté.
**Impact** : `lib/dashboard/{model,views,ui}/` — 10 fichiers extraits de render.js

## 2026-06-22 — SPEC-016-2 → done — Design system accessible + axe-core CI (drift lock rétroactif)

**Auteur** : Steeve Evers
**Raison** : DoODs déjà cochés dans la SPEC, statut `done`, _index.md resté en `in-progress` par omission.
**Impact** : `lib/dashboard/assets.js`, `lib/dashboard/ui/sparklines.js`, job CI `a11y` — 0 violation WCAG2AA / 17 pages

## 2026-06-22 — SPEC-016-4 → done — Budgets de poids RGESN par page + CI

**Auteur** : Steeve Evers
**Raison** : SPEC-016-4 (INTENT-016) — cycle complet Research (RESEARCH-022) → Gate 5/5 → Exec → Validate → Drift Lock. Extension parseur `perf-budgets.js` (D1-B), fichier de budgets calibrés × 1,2 (D2-B), script de vérification et job CI bloquant.
**Impact** :
- `lib/dashboard/perf-budgets.js` — extension D1-B : colonnes Page/Fichier/Budget HTML, champ `fichier` dans le retour (rétrocompat)
- `.aiad/perf-budgets.md` — nouveau fichier, 19 budgets calibrés (RESEARCH-022)
- `scripts/check-page-budgets.js` — nouveau script ESM zero-dep (fichiers / répertoires / globs), exit 0/1
- `test/check-page-budgets.test.js` — 10 tests (CA-001 → CA-006b), 100 % verts
- `.github/workflows/ci.yml` — job `rgesn-budgets` (needs: validate-schema)
- `RESEARCH-022-rgesn-budgets-page-check.md` — GO (100 %), ancre D1-B + D2-B

## 2026-06-22 — SPEC-016-3 → done — data.json v2 versionné (JSON schema publié)

**Auteur** : Steeve Evers
**Raison** : SPEC-016-3 (INTENT-016) — cycle complet Research → Gate → Exec → Validate → Drift Lock. Livraison de `_meta.schema_version: "2.0"`, bloc `_schema`, JSON Schema draft 2020-12, script de validation inline et job CI `validate-schema`.
**Impact** :
- `lib/dashboard.js:343-353` — `serializerDonnees()` injecte `schema_version` + `_schema`
- `lib/dashboard/schema/data-v2.schema.json` — nouveau fichier (schéma publié)
- `scripts/validate-data-schema.js` — nouveau script CI (exit 0/1, zero dep)
- `test/dashboard.test.js` — assertions `schema_version` + `_schema` ajoutées
- `test/validate-data-schema.test.js` — 6 tests de validation
- `.github/workflows/ci.yml` — job `validate-schema` (needs: test)
- `dashboard/data.json` — régénéré avec les nouveaux champs

## 2026-06-19 — INTENT-024 + SPEC-024-1 → done — Exemption de traçabilité (FACT-004 résolu)

**Auteur** : Steeve Evers
**Raison** : Cause racine du faux signal « SPEC in-progress alors que livrée »
(remonté lors de l'audit INTENT-013). `lib/sdd-trace.js` ne reconnaissait `@spec`
que dans du code applicatif (`EXTENSIONS_CODE`), forçant les SPECs doc/site/CI à
rester `in-progress` ([[FACT-004]]). Ajout d'une **exemption explicite** :
frontmatter `traceability: exempt` + `traceability_reason` (non vide, sinon inerte —
fail-honest) exclut la SPEC du gap `specsValideesNonImplementees` et l'expose dans
`specsExemptees`. SPEC EARS, Gate SQS 5/5 (0 violation EARS), exec tranche unique.
**Impact** :
- Code : `lib/sdd-trace.js` (parsing + gaps + modèle, annoté `@spec SPEC-024-1`),
  `lib/cli-schema.js` + `.aiad/schema/cli-openapi.yaml` (champ `specsExemptees`).
- Tests : `test/trace.test.js` (5 CA → 11/11 verts). Suite : 3892/3893, 0 fail.
  Lints : lint/deps/esm/size/claims tous verts. `trace --fail-on-gap` exit 0.
- Artefacts : INTENT-024 + SPEC-024-1 `done` ; SPEC-013-1a (`in-progress`→`done`+exempt),
  013-2 et 013-4a (`review`→`done`+exempt), 013-3 (`review`→`done`, a du code) ;
  FACT-004 `ouvert → résolu`. Index intents + specs MAJ.

## 2026-06-19 — AGENT-GUIDE.md — Remplissage initial (sortie du template)

**Auteur** : Steeve Evers
**Raison** : L'AGENT-GUIDE était resté au stade template (placeholders non remplis)
alors qu'il est injecté en contexte permanent dans chaque session agent. Contenu
ancré sur le code réel : CLI Node.js ESM zéro-dépendance, verdicts déterministes
(`lib/verdict.js`), tests `node --test`, annotations `@intent`/`@spec`, conventions
`lib/` kebab-case. Lessons Learned amorcées depuis la mémoire projet vérifiée
(emit-rules ↔ intent actif, doc/badge à régénérer, flaky perf scanCode).
**Impact** : `.aiad/AGENT-GUIDE.md` (contexte permanent injecté à chaque session).
Aucun code applicatif modifié. PRD.md et ARCHITECTURE.md restent au stade template.

## 2026-06-19 — INTENT-015 + SPEC-015-3 → done — Clôture de l'intention

**Auteur** : Steeve Evers
**Raison** : PR #14 (matrice garde-fous + veto non-bypassable) mergée dans `main`
(squash `b6451cf`), CI verte (21/21), code review OK. **INTENT-015 « Sobriété du
CLI » entièrement réalisé** — 4 SPECs done : 015-1 (télémétrie d'usage locale,
#8), 015-2-1 (registre 25 core / 48 extended / 8 experimental, #10), 015-2-2
(cycle de dépréciation soft dormant, #12), 015-3 (matrice 17 garde-fous + veto
non-bypassable, #14). Le noyau ~25 est assumé et figé par snapshot, la longue
traîne est identifiée et outillée pour la dépréciation, le veto Tier 1 n'est plus
bypassable. Décision pilotée par la donnée différée honnêtement (donnée d'usage
polluée écartée — RESEARCH-017 C-DATA).
**Impact** : SPEC-015-3 `in-progress → done` (PR #14), INTENT-015 `active → done`.
Rendus emit-rules régénérés (l'intent actif a changé).

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

## 2026-06-23 — INTENT-017 — Drift Lock OK (done)

**Auteur** : Steeve Evers
**Raison** : `/sdd drift-check INTENT-017` après validation SPEC-017-2 + SPEC-017-3 — toutes les SPECs liées sont done, 0 gap traçabilité bloquant, `trace --fail-on-gap` exit 0.
**Impact** : `lib/dashboard/views/inbox.js` (nouveau, 173 LOC), `lib/dashboard/digest-delta.js` (nouveau, 171 LOC), `test/dashboard-inbox.test.js` (11 cas), `test/dashboard-digest.test.js` (10 cas), `render.js` + `today.js` + `model/index.js` (wiring additif), `.aiad/metrics/digest/` (répertoire snapshot créé). INTENT-017 → `done`.

## 2026-06-11 — SPEC-013-3 — Drift Lock OK (done)

**Auteur** : Steeve Evers
**Raison** : `/sdd drift-check` après validation — code + SPEC synchronisés dans
la même PR, 0 gap de traçabilité bloquant, `@spec SPEC-013-3` tracé, CI 7/7 verte.
**Impact** : `lib/version-sync.js` (nouveau), `bin/aiad-sdd.js` (handler
`version-sync`), `.github/workflows/aiad-version-check.yml` (nouveau),
`test/version-sync.test.js`, 57 pages `site/` (zones marquées), `package.json`
bumpé 1.17.0 → 1.18.0 + cascade emit-rules/docs. SPEC-013-3 → `done`.

---

## 2026-06-25 — Archivage INTENT-031 + SPEC-031-1/2/3

**Artefacts archivés** : INTENT-031, SPEC-031-1, SPEC-031-2, SPEC-031-3.
**Motif** : toutes les SPECs liées sont `done`, implémentation livrée et validée (chaînage auto conditionnel + correctif hook Stop).
