# Index des Research (gate GO/NO-GO)

> La phase Research (§3.5) s'intercale entre l'Intent et la SPEC. Elle valide la
> **viabilité de l'intention** ancrée dans le code (Discovery obligatoire), pas
> la qualité d'une SPEC. La Research informe ; l'humain tranche le GO/NO-GO.
> Format : `RESEARCH-NNN-[nom-court].md` · Commande : `/sdd research`
> Verdict machine : `npx aiad-sdd research RESEARCH-NNN` (exit 0/1/2).

| ID | Titre | Intent | Auteur | Date | Verdict | Statut |
|----|-------|--------|--------|------|---------|--------|
| | | | | | | |

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
