---
name: context-budget
description: Use when estimating or auditing a Context Engineering Budget. Computes the 5 health metrics (M1-M5), produces a health score 0–5/5 and actionable recommendations. Triggered by /sdd context, /sdd exec budget check, /sdd resume.
---

# Skill — Context Engineering Budget

> Le Context Engineering Budget sert la **Sobriété Intentionnelle** : il ne s'agit pas de maximiser le contexte, mais de l'optimiser.
> Cette skill clôt la boucle de feedback (estimé → réel → leçon).

## Quand l'utiliser

- Audit post-session agent (`/sdd context`)
- Estimation préalable au lancement (`/sdd exec` — section 6 de la SPEC)
- Reconstruction du contexte minimal pour reprendre une session (`/sdd resume`)

## Les 5 métriques de santé

| Métrique | Méthode de calcul | Seuil sain |
|----------|-------------------|-----------|
| **M1 — Taux d'utilisation utile** | % du contexte réellement référencé par l'agent / contexte total injecté | ≥ 70 % |
| **M2 — Fréquence de relances** | Nombre de `/compact` ou reprises | 0 (idéal), 1 acceptable |
| **M3 — Ratio estimation/réel** | Réel / estimé | 0.8 – 1.3 |
| **M4 — Score de cohérence** | Contraintes AGENT-GUIDE respectées / total | ≥ 90 % |
| **M5 — Durée de session** | Minutes actives | < 35 min |

## Score de santé

```
Score = (M1 ≥ 70%  : 1pt)
      + (M2 = 0    : 1pt | M2 = 1 : 0.5pt)
      + (M3 ∈ [0.8;1.3] : 1pt)
      + (M4 ≥ 90%  : 1pt)
      + (M5 < 35min: 1pt)

5/5 OPTIMAL    → répliquer ce pattern
3-4/5 ACCEPTABLE → quelques améliorations
1-2/5 À AMÉLIORER → corriger avant la prochaine session
0/5 CRITIQUE   → reprendre les fondamentaux
```

## Procédure

### Étape 1 — Récupérer l'estimation initiale (SPEC §6)

| Composant | Estimé | Réel | Écart |
|-----------|--------|------|-------|
| AGENT-GUIDE (condensé) | ~X tokens | ~X tokens | ±X% |
| SPEC | ~X tokens | ~X tokens | ±X% |
| Fichiers source injectés | ~X tokens | ~X tokens | ±X% |
| Ajouts en cours de session | 0 | ~X tokens | N/A |
| **Total** | **~X tokens** | **~X tokens** | **±X%** |

### Étape 2 — Calculer M1 → M5

### Étape 3 — Diagnostic

| Pattern | Cause probable | Action corrective |
|---------|---------------|-------------------|
| Écart M3 > +30 % | Fichiers source surestimés | Condenser en amont |
| Écart M3 > -30 % | Dépendances non anticipées | Améliorer SPEC §5 |
| Context rot (M4 ↓) | Contexte permanent volumineux | Condenser AGENT-GUIDE |
| M2 > 1 | SPEC imprécise / contexte insuffisant | Vérifier SQS, envisager `/sdd split` |
| M4 < 90 % | Contraintes noyées dans le bruit | Restructurer prompt (contraintes en premier) |
| M5 > 35 min | Objectif trop large | `/sdd split` |
| M1 < 70 % | Contexte injecté en excès | Isolation de contexte |

## Output

```
AUDIT CONTEXT BUDGET — SPEC-NNN
═══════════════════════════════
Estimation : ~X tokens
Réel       : ~X tokens
Écart      : ±X %

M1 Taux utile     : X%      [✅/⚠️/❌]
M2 Relances       : X       [✅/⚠️/❌]
M3 Ratio est/réel : X.X     [✅/⚠️/❌]
M4 Cohérence      : X/Y     [✅/⚠️/❌]
M5 Durée          : X min   [✅/⚠️/❌]

Score santé : X/5 — [OPTIMAL / ACCEPTABLE / À AMÉLIORER / CRITIQUE]

Recommandations :
1. [...]
2. [...]

Apprentissage pour futures estimations :
- [pattern à retenir]
```

## Règles

- Le but : devenir meilleur en estimation, pas atteindre la perfection.
- Garder les audits courts et actionnables (pas de rapport de 5 pages).
- Pattern qui se répète → AGENT-GUIDE § Lessons Learned.
- Mauvaise estimation humaine → AGENT-GUIDE § Human Learnings.
- Au-dessus de 50K tokens projetés → réduire AVANT de lancer l'agent.
