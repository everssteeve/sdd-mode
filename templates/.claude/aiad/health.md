---
name: health
description: Diagnostiquer la santé des artefacts AIAD (obsolescence, orphelins, incohérences)
---

# AIAD — Santé des Artefacts

Tu es un Product Engineer AIAD. L'utilisateur veut un diagnostic approfondi de la santé des artefacts AIAD du projet — au-delà de l'état des lieux macro de `/aiad status`.

**Recommandation modèle** : Sonnet 4.6 — diagnostic de pathologies artefacts, raisonnement de cohérence.

## Contexte AIAD

Les artefacts AIAD sont des **invariants vivants** : ils doivent rester synchronisés avec le code et entre eux. Avec le temps, des incohérences, des orphelins et de l'obsolescence apparaissent silencieusement. Cette commande détecte ces pathologies avant qu'elles ne dégradent la qualité.

## Différence avec `/aiad status`

| | `/aiad status` | `/aiad health` |
|---|---|---|
| **Focus** | Vue macro (existe/absent, compteurs) | Diagnostic profond (cohérence, qualité) |
| **Granularité** | Projet entier | Artefact par artefact |
| **Sortie** | Niveau de maturité + prochaines étapes | Pathologies détectées + corrections |
| **Fréquence** | À chaque session | En fin d'itération ou quand quelque chose "sent mauvais" |

## Mode d'exécution

Cette commande supporte deux modes :

- **`--guided`** → mode débutant : questions posées une par une, concepts expliqués, exemples proposés.
- **`--fast`** → mode expert : input attendu en bloc, explications sautées, livrable direct.
- *(aucun flag)* → auto-détection : **guided** si `.aiad/` est absent ou quasi vide, **fast** sinon.

Inspecte `$ARGUMENTS` pour détecter le flag ; à défaut, inspecte `.aiad/` avant de trancher.

## 🚀 Fast path (expert)

**Input attendu** : aucun (scan complet) ou périmètre spécifique (fondamentaux uniquement, Intents uniquement, etc.).
**Output produit** : rapport de santé avec pathologies détectées (🔴 / 🟡 / 🟢) + actions correctives priorisées.
**Actions** :
1. Scanne artefacts fondamentaux (PRD / ARCHITECTURE / AGENT-GUIDE) + Intents + SPECs.
2. Détecte orphelins, zombies, SQS manquants, drifts, incohérences d'index.
3. Livre le rapport + top 3 actions par priorité (Haute / Moyenne / Basse).

Si tout est clair, saute directement à **Règles**. Sinon, suis le **Mode guidé** ci-dessous.

## 📖 Mode guidé (pas à pas)

### Étape 1 — Scanner les artefacts fondamentaux

Lis et évalue chaque artefact fondamental :

**PRD.md :**

| Check | Résultat |
|-------|----------|
| Dernière modification | [date] — il y a [X] jours |
| Outcome Criteria mesurables | [X] sur [Y] ont une baseline ET une cible |
| Cohérent avec les Intents actifs | OUI / DRIFT DÉTECTÉ |
| Personas encore pertinents | OUI / À REVOIR |

**ARCHITECTURE.md :**

| Check | Résultat |
|-------|----------|
| Stack décrite correspond au code réel | OUI / DÉCALAGE |
| Patterns documentés utilisés dans le code | OUI / OBSOLÈTES |
| Résumé condensable en < 500 tokens | OUI / TROP LONG |

**AGENT-GUIDE.md :**

| Check | Résultat |
|-------|----------|
| Règles TOUJOURS/JAMAIS respectées dans le code | OUI / VIOLATIONS |
| Conventions de code à jour | OUI / DÉCALÉES |
| Lessons Learned depuis la dernière rétro | [X] nouvelles entrées |
| Human Learnings documentés | [X] entrées — [date] dernière |
| Vocabulaire métier complet | OUI / TERMES MANQUANTS |

### Étape 2 — Auditer les Intent Statements

Scanne `.aiad/intents/` et vérifie :

| Pathologie | Détection | Impact |
|-----------|-----------|--------|
| **Intent orphelin** | Intent sans aucune SPEC liée | Intention capturée mais jamais spécifiée |
| **Intent zombie** | Intent en statut `active` depuis > 30 jours sans activité | Encombre l'index, crée du bruit |
| **Intent sans auteur** | Champ "Auteur" vide ou = agent | Violation du Human Authorship |
| **Intent sans Critère de Drift** | Section vide ou générique | Pas de garde-fou contre la dérive |

### Étape 3 — Auditer les SPECs

Scanne `.aiad/specs/` et vérifie :

| Pathologie | Détection | Impact |
|-----------|-----------|--------|
| **SPEC orpheline** | SPEC sans Intent parent | Code non traçable à une intention |
| **SPEC bloquée** | Statut `in-progress` depuis > 7 jours | Session agent probablement échouée |
| **SPEC sans SQS** | Passée en exécution sans Gate | Anti-pattern — qualité non vérifiée |
| **SPEC draft oubliée** | Statut `draft` depuis > 14 jours | À compléter ou à archiver |
| **SPEC done non archivée** | Statut `done` mais pas dans `/archive/` | Index encombré |

### Étape 4 — Vérifier la cohérence croisée

| Vérification | Résultat |
|-------------|----------|
| Tous les Intents actifs ont au moins 1 SPEC | OUI / [X] Intents sans SPEC |
| Toutes les SPECs ont un Intent parent valide | OUI / [X] SPECs orphelines |
| Le CHANGELOG-ARTEFACTS est à jour | OUI / Dernière entrée il y a [X] jours |
| Les agents de gouvernance sont installés | [X]/4 présents |
| L'_index.md des Intents est synchronisé | OUI / [X] entrées manquantes |
| L'_index.md des SPECs est synchronisé | OUI / [X] entrées manquantes |

### Étape 5 — Rapport de santé

```
RAPPORT DE SANTÉ ARTEFACTS AIAD
════════════════════════════════
Date : [YYYY-MM-DD]

Santé globale : [SAIN / ATTENTION / CRITIQUE]

Artefacts fondamentaux :
  PRD.md          [SAIN / ATTENTION / OBSOLÈTE]
  ARCHITECTURE.md [SAIN / ATTENTION / DÉCALÉ]
  AGENT-GUIDE.md  [SAIN / ATTENTION / INCOMPLET]

Pathologies détectées : [X]
  🔴 Critiques :  [X] — [liste]
  🟡 Attention :  [X] — [liste]
  🟢 Mineures :   [X] — [liste]

Intent Statements :
  Actifs : [X] | Orphelins : [X] | Zombies : [X]

SPECs :
  Actives : [X] | Orphelines : [X] | Bloquées : [X] | À archiver : [X]

Actions correctives prioritaires :
1. [Action — priorité HAUTE]
2. [Action — priorité MOYENNE]
3. [Action — priorité BASSE]
```

### Règles

- La santé des artefacts est un **leading indicator** — les problèmes détectés ici prédisent des problèmes de livraison
- Les orphelins (Intent sans SPEC, SPEC sans Intent) sont le signe d'un workflow interrompu
- Les zombies (artefacts actifs sans activité) encombrent le contexte et confondent les agents
- Un AGENT-GUIDE sans Human Learnings récents est suspect — les erreurs humaines ne s'arrêtent pas
- Archiver n'est pas supprimer — les SPECs `done` vont dans `/archive/`, pas à la poubelle

$ARGUMENTS
