# Index des Research (gate GO/NO-GO)

> La phase Research (§3.5) s'intercale entre l'Intent et la SPEC. Elle valide la
> **viabilité de l'intention** ancrée dans le code (Discovery obligatoire), pas
> la qualité d'une SPEC. La Research informe ; l'humain tranche le GO/NO-GO.
> Format : `RESEARCH-NNN-[nom-court].md` · Commande : `/sdd research`
> Verdict machine : `npx aiad-sdd research RESEARCH-NNN` (exit 0/1/2).

| ID | Titre | Intent | Auteur | Date | Verdict | Statut |
|----|-------|--------|--------|------|---------|--------|
| RESEARCH-013 | Sync auto des en-têtes de version + check CI | INTENT-013 | Steeve Evers | 2026-06-11 | CONDITIONAL GO (80 %) | tranché — /sdd spec autorisé (C1, C2) |
| RESEARCH-014 | Déploiement site/ → gh-pages automatisé | INTENT-013 | Steeve Evers | 2026-06-11 | CONDITIONAL GO (85 %) | déclaré GO → durci CONDITIONAL (R2/R3/R4) — /sdd spec autorisé |
| RESEARCH-015 | Empirisme prouvé — gates bloquants + claims sourcés | INTENT-014 | Steeve Evers | 2026-06-12 | CONDITIONAL GO (85 %) | tranché — /sdd spec autorisé (C-R1, C-R2, C-R3, C-R5) ; prémisse Intent corrigée |
| RESEARCH-016 | Sobriété du CLI — noyau assumé, longue traîne extraite | INTENT-015 | Steeve Evers | 2026-06-16 | CONDITIONAL GO (85 %) | tranché — /sdd spec autorisé (C1, C2, C3) ; télémétrie opt-in déjà en place |
| RESEARCH-017 | Tiering CLI core/extended/plugin + plan de dépréciation | INTENT-015 | Steeve Evers | 2026-06-17 | CONDITIONAL GO (80 %) | tranché — /sdd spec autorisé (C1, C2, C-DATA, C-SCOPE) ; donnée d'usage polluée écartée comme preuve |
| RESEARCH-018 | Matrice enforced/advisory + resserrage des bypass | INTENT-015 | Steeve Evers | 2026-06-19 | CONDITIONAL GO (85 %) | tranché — /sdd spec autorisé (C3, C-MATRICE, C-SCOPE) ; **veto bypassable aujourd'hui** (veto.js:28) à fermer |
| RESEARCH-019 | Gate RGAA AA avant publication du site aiad.ovh | INTENT-013 | Steeve Evers | 2026-06-22 | GO (100 %) | tranché — /sdd spec autorisé ; pa11y-ci recommandé, Chromium CI-only assumé |
| RESEARCH-020 | Dashboard exemplaire : fondations accessibles, sobres, maintenables | INTENT-016 | Steeve Evers | 2026-06-22 | GO (100 %) | tranché — /sdd spec autorisé ; 4 SPECs prévues (architecture + RGAA + data.json v2 + RGESN) |
| RESEARCH-021 | data.json v2 versionné — Discovery post SPEC-016-1/2 | INTENT-016 / SPEC-016-3 | Steeve Evers | 2026-06-22 | CONDITIONAL GO (100 %) | tranché — /sdd exec autorisé ; C1 levée (SPEC-016-3 § Processing corrigée) |
| RESEARCH-022 | RGESN budgets de poids par page : Discovery pré-exec SPEC-016-4 | INTENT-016 / SPEC-016-4 | Steeve Evers | 2026-06-22 | GO (100 %) | tranché — /sdd exec autorisé ; D1-B (extension parseur) · D2-B (budgets calibrés réel +20 %) |
| RESEARCH-023 | Dashboard quotidien : Aujourd'hui, triage, digest | INTENT-017 | Steeve Evers | 2026-06-22 | CONDITIONAL GO (90 %) | tranché — /sdd spec autorisé (C1 localStorage, C2 polling RGESN explicite) ; 4 SPECs au lieu de 6 |
| RESEARCH-024 | La valeur réalisée comme boussole — outcomes, EBM, bilan humains/agents | INTENT-018 | Steeve Evers | 2026-06-23 | GO (90 %) | tranché — /sdd spec autorisé ; R1 (executor: frontmatter vs git-blame) à trancher avant SPEC-018-4 ; R2 (≥ 3 snapshots) à vérifier avant SPEC-018-3 |
| RESEARCH-025 | Verification-first — dériver des squelettes de tests depuis des SPECs EARS | INTENT-019 | Steeve Evers | 2026-06-23 | GO (80 %) | tranché — /sdd spec autorisé ; R3 (node:test par défaut, --framework en phase 2) |
| RESEARCH-026 | Trace EARS gap — earsSpecsSansTests dans compterGapsBloquants | INTENT-019 | Steeve Evers | 2026-06-23 | GO (95 %) | tranché — /sdd gate autorisé sur SPEC-019-2 |
| RESEARCH-027 | Archivage automatique des artefacts done (Intents + SPECs) | INTENT-026 | Steeve Evers | 2026-06-24 | GO (90 %) | tranché — /sdd spec autorisé ; option A (safe: false ignorés silencieusement) |
| RESEARCH-028 | EcoLogits — mesure et réduction impact écologique cycle SDD | INTENT-030 | Steeve Evers | 2026-06-24 | CONDITIONAL GO (80 %) | tranché — périmètre B (harness Stop hook) · stratégie B (JS natif, JSON modèles) · /sdd spec autorisé |
| RESEARCH-031 | Chaînage automatique conditionnel + correctif hook Stop | INTENT-031 | Steeve Evers | 2026-06-25 | CONDITIONAL GO (85 %) | tranché — /sdd spec autorisé (C1 afterCommand, C2 stuck-in-ready accepté) |
| RESEARCH-032 | Recommandation modèle actionnable dans toutes les commandes /sdd et /aiad | INTENT-032 | Steeve Evers | 2026-06-25 | GO (95 %) | tranché — /sdd spec autorisé |
| RESEARCH-033 | Spec-anchored par construction : deltas et redevabilité bidirectionnelle | INTENT-020 | Steeve Evers | 2026-06-25 | CONDITIONAL GO (85 %) | tranché — /sdd spec autorisé (C1 FACT enrichi sans écriture directe SPEC, C2 frontière delta quantifiée) |

## Verdicts du gate Research

| Décision (humaine) | Verdict machine | Exit | Effet sur le cycle |
|--------------------|-----------------|------|--------------------|
| `GO` | PASS | 0 | `/sdd spec` autorisé |
| `CONDITIONAL GO` | CONDITIONAL | 0 | `/sdd spec` autorisé, conditions à lever |
| `DEFER` | FAIL | 1 | Reporté — nouvelle Research requise |
| `NO-GO` | FAIL | 1 | Abandonné — nouvelle Research requise |
| Discovery vide · `TODO-JNSP` ouvert · verdict humain absent | JNSP | 2 | Décision humaine requise (fail-closed) |

## Pourquoi une phase Research ?

Le cycle SDD scorait la qualité de la SPEC (SQS) mais jamais la viabilité de
l'intention elle-même. Sans Discovery codebase obligatoire, on tombe dans le
piège « specs-to-code » : spécifier sans regarder le code réel. La Research
ancre chaque intention dans des fichiers existants (`chemin:ligne`) **avant**
de rédiger la moindre SPEC.
