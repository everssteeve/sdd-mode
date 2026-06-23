# PRD : aiad-sdd — Framework Spec Driven Development assisté par IA

> Source de vérité produit. Auteur : Steeve Evers — Date : 2026-06-23

## 1. Contexte et Problème

**Situation actuelle** : Les agents IA utilisés pour générer du code exposent des effets de bord non maîtrisés — dérive par rapport à l'intention, décisions implicites, code hors spec. En parallèle, les organisations entières (développeurs, PMs, architectes, équipes produit) ne disposent pas d'un workflow structuré autour de ces agents : pas de gouvernance, pas de cycle clair, pas de traçabilité de qui décide quoi.

**Qui ressent le problème** : Product Managers, Product Engineers, Tech Leads — toute organisation qui adopte des agents IA pour développer des produits.

**Impact** : Perte de temps en réunions pour collecter et redistribuer l'information, dérives silencieuses de l'architecture, qualité de code non maîtrisée, intention humaine trahie sans signal visible.

## 2. North Star / Product Goal

Toute organisation peut adopter un process Spec Driven Development assisté par IA sans friction — l'intention humaine reste maîtrisée du début à la fin.

## 3. Personas et Use Cases

| Persona | Besoin | Résultat attendu |
|---------|--------|------------------|
| Alex — Product Manager | Clarté sur ce qui est développé et ce qui reste à faire | Accès direct à l'état du produit sans réunions de collecte |
| Sam — Product Engineer | Générer du code de haute qualité en respectant l'intention du PM | Cycle Intent → Spec → Code tracé et vérifiable |
| Jordan — Tech Lead | Assurer la cohérence technique et architecturale | Aucune décision technique silencieuse introduite par un agent |

## 4. Outcome Criteria (Mesurables)

| Critère | Baseline | Cible | Méthode |
|---------|----------|-------|---------|
| Temps d'onboarding | Non mesuré | < 4h | Mesure lors des onboardings utilisateurs |
| Trafic aiad.ovh | 14 vues/jour | 1 000 vues/jour | Analytics site |
| Intents issus du feedback utilisateurs | 0/mois | 5/mois | Tag source dans `_index.md` |

## 5. Périmètre

### In Scope (v1)
- CLI `aiad-sdd` avec un jeu de commandes limité et optimisé
- Cycle SDD complet : Intent → Research → Spec → Gate → Exec → Validation → Drift Lock
- Commandes rituels AIAD : standup, retro, demo, dashboard, métriques DORA/Flow
- Gouvernance réglementaire Tier 1 (AI-ACT, RGPD, RGAA, RGESN)
- Zéro dépendance npm runtime ou dev

### Out of Scope (v1)
- Agents préconfigurés livrés — reporté en v2 (complexité d'infrastructure prématurée)
- Serveurs MCP — reporté en v2 (même raison)

## 6. User Stories (Prioritaires)

```
US-001 | MUST   | Alex peut connaître l'état du produit en moins de 5 minutes → Outcome : 0 réunion de collecte d'information
US-002 | MUST   | Sam peut coder une feature avec une SPEC validée en contexte → Outcome : 0 dérive d'intention non détectée
US-003 | MUST   | Jordan peut vérifier qu'aucune décision technique silencieuse n'a été introduite → Outcome : Drift Lock vert sur chaque PR
US-004 | SHOULD | Alex peut onboarder un nouveau membre en moins de 4h → Outcome : onboarding autonome sans assistance
US-005 | COULD  | Toute l'équipe peut visualiser la valeur livrée vs. l'intention initiale → Outcome : dashboard EBM opérationnel
```

## 7. Trade-offs et Décisions Clés

| Décision | Raison | Coût / Bénéfice |
|----------|--------|-----------------|
| Zéro dépendance npm | Contrainte structurante — portabilité maximale, auditabilité | Coût : réimplémentation maison de certains utilitaires / Bénéfice : installation instantanée, surface d'attaque nulle |
| Pas d'agents ni MCP en v1 | Sobriété intentionnelle — maîtriser le noyau avant d'étendre | Coût : certains workflows restent manuels / Bénéfice : v1 livrable et stable |
| Multi-runtime (Claude Code, Cursor, Codex, Gemini) | Les organisations n'ont pas toutes le même runtime IA | Coût : maintenance de 17 rendus via emit-rules / Bénéfice : adoption large |

## 8. Dépendances et Risques

**Dépendances externes** : Runtimes IA tiers (Claude Code, Cursor, Copilot, Codex) — non maîtrisés, peuvent changer leur API ou comportement sans préavis.

**Risques** :
- Changement de comportement d'un runtime IA → Mitigation : couche d'abstraction emit-rules, canary suite cross-model
- Adoption lente faute de contenu (trafic bas) → Mitigation : rayonnement honnête, site aiad.ovh, feedback loop utilisateurs

## 9. Évolution Prévue (v2)

3-6 mois post-lancement v1 : agents préconfigurés livrés + serveurs MCP — permettre aux organisations d'aller au-delà du CLI et d'intégrer aiad-sdd dans leurs pipelines d'infrastructure IA.
