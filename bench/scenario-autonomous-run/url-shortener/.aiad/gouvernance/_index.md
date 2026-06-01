# Agents de Gouvernance AIAD — Tier 1

> Ces agents ont un **droit de veto** sur toute implémentation non conforme.
> Ils sont injectés dans chaque session de développement via le CLAUDE.md.

## Agents installés

| Agent | Fichier | Périmètre |
|-------|---------|-----------|
| **EU AI Act** | `AIAD-AI-ACT.md` | Conformité Règlement (UE) 2024/1689 |
| **RGPD** | `AIAD-RGPD.md` | Privacy by Design, conformité RGPD |
| **RGAA** | `AIAD-RGAA.md` | Accessibilité numérique RGAA 4.1 / WCAG 2.1 |
| **RGESN** | `AIAD-RGESN.md` | Écoconception de services numériques |
| **CRA** | `AIAD-CRA.md` | Cyber Resilience Act — Règlement (UE) 2024/2847 (application 2027) |

## Activation

Les agents de gouvernance sont activés par défaut dans le CLAUDE.md.
Pour désactiver temporairement un agent, commentez la ligne correspondante dans CLAUDE.md.

## Hiérarchie

```
Constitution AIAD (valeurs immuables)
  └── Agents de Gouvernance Tier 1 (droit de veto)
       ├── AIAD-AI-ACT    → Tout composant IA
       ├── AIAD-RGPD      → Toute donnée personnelle
       ├── AIAD-RGAA      → Toute interface utilisateur
       ├── AIAD-RGESN     → Toute décision technique
       └── AIAD-CRA       → Tout produit logiciel mis sur le marché EU (2027)
            └── AGENT-GUIDE projet (contexte permanent)
                 └── SPEC (activation par tâche)
```

## Mise à jour

Les agents de gouvernance suivent le cycle ALIS (mise à jour à chaque pleine lune).
Pour mettre à jour : `npx aiad-sdd gouvernance --force`
