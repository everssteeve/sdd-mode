# Index des plans d'exécution phasés

> L'exécution phasée (§3.6) découpe une SPEC en **tranches verticales testables**.
> Chaque tranche livre un incrément + ses tests, validé par un **mini-gate**.
> Format : `EXEC-<SPEC-id>-plan.md` · Commande : `/sdd exec` · Reprise : `/sdd resume`.
> Verdict machine : `npx aiad-sdd mini-gate <SPEC-id> --phase N` (exit 0/1/2).

| Plan | SPEC | Tranches | Avancement | Statut |
|------|------|----------|------------|--------|
| | | | | |

## Verdicts mini-gate

| Verdict | Exit | Sens |
|---------|------|------|
| `PASS` | 0 | Tranche livrée : tests présents, aucune dette ouverte |
| `CONDITIONAL` | 0 | Tranche acceptable avec dette explicitée (conditions à lever avant la gate finale) |
| `FAIL` | 1 | Tranche bloquée, sans test (code horizontal) ou tests non livrés/rouges |
| `JNSP` | 2 | Tranche/plan indécidable (introuvable, non parsable) |

## Marqueurs de statut

`[ ]` à faire · `[~]` en cours · `[x]` validé · `[!]` bloqué · `[-]` hors-scope

## Pourquoi l'exécution phasée ?

`/sdd exec` lançait l'agent en une passe avec une gate unique en amont, puis
laissait filer — le modèle « code horizontalement » (beaucoup de lignes avant
le moindre test). Découper en tranches verticales testables, chacune gatée,
détecte la dérive **tôt** et rend l'avancement machine-vérifiable.
