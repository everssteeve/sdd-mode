# Reviews cross-model — index (§3.12)

> Review **additive-only** : un modèle tiers (Codex/Gemini) en **contexte frais**
> insère des Findings cités, **sans jamais réécrire** le code ni la SPEC. Le
> verdict final reste déterministe ; des findings hauts non résolus forcent au
> plus `CONDITIONAL`.

## Cycle

```bash
# 1. Émettre le prompt contexte-frais et le passer au reviewer tiers :
npx aiad-sdd cross-model prompt SPEC-NNN-x --reviewer codex --diff /tmp/diff.patch | codex ... > .aiad/reviews/REVIEW-SPEC-NNN-x-codex.json

# 2. Agréger (dédup) + influence sur le verdict + artefact additif :
npx aiad-sdd cross-model merge SPEC-NNN-x --base PASS
```

Les sorties reviewer brutes sont des `.json` (schéma `review.schema.json`) ; le
rapport mergé est écrit dans `REVIEW-<spec>.md`. Le reviewer est restreint à des
Findings (allowlist read-only — même principe que les agents de gouvernance §3.1).
