---
id: FACT-010
title: Friction gate → exec — boucle ready/review causée par le hook Stop
date: 2026-06-25
author: Steeve Evers
specs: .claude/sdd/gate.md (ligne 36 et 69)
status: ouvert
---

# FACT-010 — Friction gate → exec — boucle ready/review causée par le hook Stop

**Date** : 2026-06-25
**Auteur** : Steeve Evers
**SPEC concernée** : `.claude/sdd/gate.md` (fast path ligne 36 + mode guidé étape 5 ligne 69)
**Statut** : ouvert

## Cycle de friction complet (tel qu'observé)

```
/sdd gate → Gate OUVERTE → statut SPEC → ready
           ↓
   hook Stop détecte gap spec_validated_not_implemented
   (SPEC ready mais aucun @spec dans le code — normal avant exec)
           ↓
   Pour débloquer la session : statut manuellement repassé → review
           ↓
   /sdd exec refusé : statut != ready
           ↓
   Statut manuellement restauré → ready
           ↓
   /sdd exec peut démarrer
```

## Écart constaté

**Livré** : le hook Stop (`aiad-sdd` Stop hook) émet un gap `spec_validated_not_implemented`
dès qu'une SPEC est en statut `ready` sans annotation `@spec` dans le code. C'est
**sémantiquement correct** après le développement, mais **prématuré entre gate et exec** —
phase où le code n'existe pas encore. Pour supprimer ce faux-positif bloquant, l'utilisateur
repasse le statut en `review`, ce qui verrouille `/sdd exec` (prérequis statut `ready` non
satisfait). Il faut donc restaurer `ready` juste avant chaque `/sdd exec`.

**Désiré** : le gap `spec_validated_not_implemented` ne devrait pas être émis pour une SPEC
qui n'a pas encore démarré son exécution agent. La fenêtre `ready` (gate validée, exec pas
encore lancé) est un état légitime où l'absence d'annotations `@spec` est attendue — pas
un drift.

## Impact qualifié

- **Type** : fonctionnel (faux-positif du hook Stop + boucle manuelle 2 éditions de fichier)
- **Sévérité** : majeur — bloque le flux nominatif gate → exec à chaque cycle

## Causes racines identifiées

1. Le hook Stop ne distingue pas `ready` (gate passée, exec non démarré) de `ready` +
   annotations `@spec` absentes après un exec en cours ou terminé. Les deux cas
   déclenchent le même gap `spec_validated_not_implemented`.
2. La fenêtre temporelle `ready` (entre gate et exec) n'est pas modélisée dans la logique
   de détection de gap — elle est traitée comme un drift au même titre qu'une SPEC `done`
   sans code.
3. Aucun mécanisme de chaînage gate → exec n'existe : même si le statut était correctement
   géré, l'utilisateur doit relancer `/sdd exec` dans une session séparée.

## Décision d'action

**Action choisie** : nouveau Intent Statement
**Justification** : Deux corrections nécessaires mais de nature différente :
  (a) **correctif hook Stop** — exclure le gap `spec_validated_not_implemented` pour les SPECs
  en statut `ready` sans exec démarré (heuristique : pas de fichier en `in-progress`, pas
  d'annotations `@spec` existantes liées). Décision de design sur l'heuristique à valider.
  (b) **fluidification gate → exec** — proposition : confirmation interactive en fin de Gate
  OUVERTE ou option `--chain-exec`. L'humain conserve le dernier mot (Human Authorship).
  Ces deux sous-problèmes méritent une SPEC commune plutôt qu'un patch aveugle.
**Lien SPEC** : → `/sdd intent` à créer (INTENT-031 probable)

## Questions ouvertes (Human Authorship)

- L'heuristique d'exclusion du gap pour `ready` doit-elle être basée sur le statut seul,
  ou sur l'absence conjointe de statut `in-progress` ET d'annotations `@spec` ?
- Le chaînage gate → exec doit-il être opt-in (`--chain-exec`) ou proposé par défaut
  avec confirmation ?
- Faut-il un statut intermédiaire explicite (`gate-passed` ?) entre `ready` et `in-progress`
  pour rendre la fenêtre temporelle machine-vérifiable ?
