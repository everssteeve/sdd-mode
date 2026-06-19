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
