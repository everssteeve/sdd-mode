---
id: FACT-011
title: Absence de chaînage automatique conditionnel entre étapes SDD
date: 2026-06-25
author: Steeve Evers
specs: N/A (lacune structurelle)
status: ouvert
---

# FACT-011 — Absence de chaînage automatique conditionnel entre étapes SDD

**Date** : 2026-06-25
**Auteur** : Steeve Evers
**SPEC concernée** : N/A — lacune transverse au cycle SDD (toutes les étapes)
**Statut** : ouvert

## Écart constaté

**Livré** : chaque étape du cycle SDD (intent → research → spec → gate → exec → validate →
drift-check) requiert une intervention manuelle du Product Engineer, même quand la décision
est algorithmiquement déterminable (ex. SQS ≥ 4/5 → gate ouverte, contexte < 40% → exec
sûr, pas de gap drift → validate OK). Aucune continuité automatique n'est proposée entre
deux étapes consécutives dont les préconditions sont satisfaites.

**Désiré** : sous des conditions à définir (exemple : budget contexte < 40%, SQS ≥ 4/5,
aucune dimension Human Authorship requise, aucun veto gouvernance), les étapes suivantes
pourraient s'enchaîner sans intervention humaine. Un paramètre (activé par défaut) permet
de désactiver ce comportement projet par projet.

## Impact qualifié

- **Type** : fonctionnel (friction cognitive répétée + latence cumulative sur un cycle complet)
- **Sévérité** : majeur — chaque cycle complet nécessite 5 à 7 interruptions manuelles même
  pour des décisions déterministes, ce qui ralentit le flux et décourage l'usage sur des tâches
  routinières

## Contexte & liens

Ce FACT est la généralisation de **FACT-010** (chaînage gate → exec), dont les causes racines 3
identifiaient déjà l'absence d'un mécanisme de chaînage. FACT-011 étend la demande à l'ensemble
du cycle, avec une taxonomie explicite des conditions de continuité automatique.

## Conditions de chaînage automatique possibles (à valider humainement)

| Transition | Condition proposée | Raison d'arrêt obligatoire |
|------------|-------------------|---------------------------|
| `intent` → `research` | Toujours manuel | Human Authorship requis |
| `research` → `spec` | GO vérifié, contexte < 60% | Décision GO/NO-GO = humain |
| `spec` → `gate` | SPEC rédigée, EARS 0 violations | — |
| `gate` → `exec` | SQS ≥ 4/5, Gate ouverte, contexte < 40% | Humain peut vouloir réviser |
| `exec` → `validate` | Exec terminé sans erreur fatale | — |
| `validate` → `drift-check` | Validate PASS | — |
| `drift-check` → `trace` | Drift OK | — |

**Colonnes à compléter par le PE** : quelles transitions sont acceptables en auto ? Seuil contexte
différent ? Comportement si condition limite (ex. SQS = 4.0 exact) ?

## Paramétrage envisagé

```yaml
# .aiad/config.yml (proposal)
auto_chain:
  enabled: true          # ON par défaut
  max_context_pct: 40    # stop si budget > 40 %
  require_confirmation:  # étapes qui demandent toujours confirmation
    - research_verdict   # GO/NO-GO research → spec
    - gate_open          # gate → exec (confirmation légère)
```

## Décision d'action

**Action choisie** : nouveau Intent Statement
**Justification** : la fonctionnalité implique (a) une taxonomie des conditions de continuité
(design de gouvernance), (b) un mécanisme de configuration projet, (c) une intégration dans
les commandes existantes (`/sdd gate`, `/sdd exec`, `/sdd validate`…) sans régression sur
le principe d'Human Authorship. La portée justifie un Intent + SPEC(s) dédiées plutôt qu'un
patch.
**Lien SPEC** : → `/sdd intent` à créer (INTENT-031, à vérifier avec FACT-010 : les deux
peuvent partager le même Intent si le PE le décide)

## Questions ouvertes (Human Authorship)

- Quelles transitions sont acceptables en mode auto ? La liste ci-dessus est une proposition,
  pas une décision.
- Le seuil contexte de 40% est-il pertinent pour toutes les transitions, ou faut-il des
  seuils par étape ?
- En cas de chaînage auto interrompu (condition non satisfaite mid-cycle), comment notifier
  le PE sans friction (message inline ? hook Stop ?) ?
- FACT-010 et FACT-011 méritent-ils un Intent commun ou deux Intents distincts ?
