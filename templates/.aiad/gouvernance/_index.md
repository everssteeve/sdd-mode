# Index — Agents de Gouvernance Tier 1

> Les agents de gouvernance ont un **droit de veto** sur tout livrable non conforme.
> En cas de conflit entre une SPEC et un agent de gouvernance, l'agent de gouvernance prévaut.

## Agents actifs

| Agent | Référentiel | Déclenché quand... |
|-------|-------------|-------------------|
| [AIAD-AI-ACT.md](AIAD-AI-ACT.md) | Règlement (UE) 2024/1689 — EU AI Act | Le code implique un composant IA (ML, LLM, scoring, recommandation) |
| [AIAD-RGPD.md](AIAD-RGPD.md) | RGPD (UE) 2016/679 | Le code traite des données personnelles |
| [AIAD-RGAA.md](AIAD-RGAA.md) | RGAA 4.1 / WCAG 2.1 | Le code produit une interface utilisateur |
| [AIAD-RGESN.md](AIAD-RGESN.md) | RGESN v2 | Toute décision technique (performance, ressources, dépendances) |

## Hiérarchie de priorité

En cas de conflit entre référentiels :

1. **Art. 5 AI Act (interdictions)** — priorité absolue
2. **RGPD + Art. 9** — base légale requise si données sensibles
3. **AI Act haut risque** — obligations procédurales (documentation, supervision, enregistrement)
4. **RGAA** — les interfaces AI Act (divulgation, supervision, recours) doivent être accessibles
5. **RGESN** — optimisation énergétique dans le respect des quatre ci-dessus

## Commandes associées

- `/aiad-gouvernance` — Vérifier la conformité Tier 1 sur une SPEC ou un code
- `/sdd-security` — Audit sécurité (inclut conformité AI-ACT et RGPD si applicable)
- `/sdd-validate` — Validation incluant la gouvernance

---

*Framework AIAD v1.6 — aiad.ovh*
