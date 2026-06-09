# Recettes `/goal` — boucles convergentes sur verdict déterministe (§3.13)

> `/goal` (Claude Code) itère une boucle évaluée jusqu'à ce qu'une **condition**
> soit remplie (pattern « Ralph Wiggum loop »). Couplé aux **verdicts CLI
> déterministes** de SDD (§3.4), la condition n'est pas un jugement flou du
> modèle mais une **sortie machine-vérifiable** (exit code / champ JSON).

## Pourquoi déterministe

« Itérer jusqu'à SQS ≥ 4/5 » devient sûr **uniquement** si la condition d'arrêt
est calculée hors-modèle. Sinon la boucle s'auto-félicite et s'arrête sur une
illusion de succès. On branche donc `/goal` sur `aiad-sdd <cmd> --output-format
verdict` (exit `0` PASS / `1` FAIL / `2` JNSP).

## Recettes

### Atteindre une Gate ouverte (SQS ≥ 4/5)

```
/goal "npx aiad-sdd gate <SPEC-id> --output-format verdict renvoie verdict=PASS"
```

La condition lit le champ `verdict` du JSON déterministe. Tant qu'il vaut
`FAIL`/`JNSP`, la boucle améliore la SPEC (remédiation R1–R7) puis re-score.

### Zéro gap de traçabilité (Drift Lock)

```
/goal "npx aiad-sdd trace --fail-on-gap sort en exit 0"
```

Itère jusqu'à ce que chaque SPEC/Intent/Code/Test soit relié (matrice §3.10).

### Canary stable

```
/goal "npx aiad-sdd canary --output-format verdict renvoie verdict ∈ {PASS, CONDITIONAL}"
```

## Garde-fous

- **Plafond d'itérations** : fixe un maximum (ex. 5). Au-delà sans convergence →
  bascule en **JNSP** (décision humaine requise) plutôt que de boucler à
  l'infini — cohérent avec le cap de rewake (§3.6).
- **Condition machine-vérifiable obligatoire** : ne jamais formuler une
  condition `/goal` comme « le code semble correct » — toujours un exit code ou
  un champ JSON d'un verdict CLI.
- **Veto non contournable** : une boucle `/goal` ne peut pas désactiver un veto
  de gouvernance Tier 1 (§3.1) ni un hook protégé (§3.13 `hooks-config`).
