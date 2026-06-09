# Canary suite — index (§3.10)

> Set **figé** de cas rejoués régulièrement contre une baseline pour distinguer
> une **régression réelle** d'un **bruit de serving** (« frozen weights ≠ frozen
> behavior », variance ±8-14 %).

## Lancer

```bash
npx aiad-sdd canary                    # rapport humain
npx aiad-sdd canary --output-format verdict   # JSON + exit 0/1/2
```

## Deux régimes d'attente

| `kind` | Attente | Écart |
|--------|---------|-------|
| `deterministic` | verdict CLI **100 % reproductible** (et = baseline) | tout écart = **bug code** → FAIL |
| `generative` | dispersion dans la **bande ±tolerance %** | hors bande → **DRIFT** (CONDITIONAL) |

## Snapshot modèle figé

La référence modèle est épinglée dans `.aiad/config.yml` (bloc `canary:`) :
`model`, `effort`, `claude_code_version`, `tolerance_pct`. Le canary enregistre
ce snapshot dans chaque rapport (`.aiad/metrics/canary/<date>.json`) → comparaisons
à modèle constant.

## Cas

| Cas | Nature | Invariant |
|-----|--------|-----------|
| CANARY-001 | deterministic | fail-closed du gate Discovery (JNSP sans Research) |
| CANARY-010 | generative | dispersion du score SQS (réf. 4, ±14 %) |
