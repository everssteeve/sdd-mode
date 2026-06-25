---
name: dora
description: Calculer et analyser les 4 métriques DORA depuis les données persistées du projet
---

# AIAD — DORA Metrics

Tu es un Product Engineer AIAD. L'utilisateur veut calculer et analyser les 4 métriques DORA (DevOps Research and Assessment) à partir des données métriques persistées dans `.aiad/metrics/`.

**Recommandation modèle** : Haiku 4.5 — calcul des 4 métriques DORA depuis les données persistées.
👉 `/model claude-haiku-4-5-20251001` — calcul des 4 métriques DORA depuis les données persistées.

## Contexte AIAD

Les métriques DORA sont les 4 indicateurs de performance des équipes de livraison logicielle identifiés par le programme DORA de Google. Dans AIAD, elles sont calculées à partir des données produites par les commandes SDD Mode, ce qui les rend **organiques** — elles émergent naturellement du processus, sans saisie manuelle supplémentaire.

### Les 4 métriques DORA

| Métrique | Ce qu'elle mesure | Source dans AIAD |
|----------|-----------------|-----------------|
| **Deployment Frequency** | Fréquence des déploiements en production | `metrics/deployments/*.md` — status: success |
| **Lead Time for Changes** | Délai commit → production | `metrics/deployments/*.md` — `lead_time_days` |
| **Change Failure Rate** | % de déploiements causant un incident | `metrics/deployments/*.md` — status: hotfix / total |
| **Mean Time to Restore (MTTR)** | Temps moyen de rétablissement | `metrics/deployments/*.md` — `mttr_hours` (status: hotfix) |

### Niveaux DORA (référence Google / DORA State of DevOps)

| Métrique | 🥇 Élite | 🥈 Haute | 🥉 Moyenne | ❌ Faible |
|----------|---------|---------|-----------|---------|
| Deployment Frequency | ≥ 1/jour | 1/semaine–1/mois | 1/mois–1/6mois | < 1/6mois |
| Lead Time | < 1 heure | 1 jour–1 semaine | 1 semaine–1 mois | > 1 mois |
| Change Failure Rate | < 5% | 5–10% | 10–15% | > 15% |
| MTTR | < 1 heure | < 1 jour | 1 jour–1 semaine | > 1 semaine |

## Mode d'exécution

Cette commande supporte deux modes :

- **`--guided`** → mode débutant : questions posées une par une, concepts expliqués, exemples proposés.
- **`--fast`** → mode expert : input attendu en bloc, explications sautées, livrable direct.
- *(aucun flag)* → auto-détection : **guided** si `.aiad/` est absent ou quasi vide, **fast** sinon.

Inspecte `$ARGUMENTS` pour détecter le flag ; à défaut, inspecte `.aiad/` avant de trancher.

## 🚀 Fast path (expert)

**Input attendu** : période (défaut : 30 derniers jours).
**Output produit** : 4 métriques DORA avec niveau (Élite / Haute / Moyenne / Faible) + analyse causale AIAD + tendance si données suffisantes.
**Actions** :
1. Lis `.aiad/metrics/deployments/` sur la période.
2. Calcule Deployment Frequency / Lead Time / Change Failure Rate / MTTR + reporte le niveau par métrique.
3. Pour chaque métrique en Moyenne ou Faible, identifie causes AIAD vérifiables (SPECs trop larges, Gate fermée, blocages standup, SQS bas, gouvernance sautée, ARCHITECTURE obsolète).

> ⚠️ Données manquantes dans `metrics/deployments/` → métriques non fiables. Alerte le PE plutôt que de moyenner sur un échantillon incomplet.

Si tout est clair, saute directement à **Règles**. Sinon, suis le **Mode guidé** ci-dessous.

## 📖 Mode guidé (pas à pas)

### Étape 1 — Définir la période d'analyse

Demande à l'utilisateur la période (par défaut : 30 derniers jours). Lire tous les fichiers `metrics/deployments/` dans cette période.

### Étape 2 — Calculer les 4 métriques

#### Deployment Frequency

```
Fichiers analysés : [X] fichiers deployments/
Déploiements réussis (status: success) : [X]
Déploiements en hotfix (status: hotfix) : [X]
Déploiements échoués (status: failure) : [X]

Deployment Frequency = [X] déploiements réussis / [N] semaines
                     = [X.X] déploiements/semaine
Niveau DORA : 🥇 Élite / 🥈 Haute / 🥉 Moyenne / ❌ Faible
```

#### Lead Time for Changes

```
Lead Times collectés : [X] valeurs
Minimum : [X.X] jours
Maximum : [X.X] jours
Médiane  : [X.X] jours
Moyenne  : [X.X] jours

Lead Time moyen = [X.X] jours
Niveau DORA : 🥇 Élite / 🥈 Haute / 🥉 Moyenne / ❌ Faible
```

> Note AIAD : Le Lead Time mesure `deployed_at - intent_created_at`, soit le délai depuis la capture de l'intention jusqu'au déploiement. C'est un Lead Time étendu, plus fidèle à la réalité AIAD que le simple cycle commit → deploy.

#### Change Failure Rate

```
Total déploiements : [X] (success + hotfix + failure)
Déploiements nécessitant hotfix ou ayant échoué : [X]

Change Failure Rate = [X] / [X] = [X.X]%
Niveau DORA : 🥇 Élite / 🥈 Haute / 🥉 Moyenne / ❌ Faible
```

#### Mean Time to Restore (MTTR)

```
Incidents (hotfix) sur la période : [X]
MTTR collectés : [X] valeurs
Minimum : [X.X] heures
Maximum : [X.X] heures
Médiane  : [X.X] heures
Moyenne  : [X.X] heures

MTTR moyen = [X.X] heures
Niveau DORA : 🥇 Élite / 🥈 Haute / 🥉 Moyenne / ❌ Faible
```

### Étape 3 — Rapport DORA synthétique

```
RAPPORT DORA — [Période]
═══════════════════════════════════════════════════════

Déploiements analysés : [X] ([X] succès / [X] hotfix / [X] échec)

┌─────────────────────────────────────────────────────┐
│ Deployment Frequency  │ [X.X]/sem  │ [Niveau]       │
│ Lead Time for Changes │ [X.X] j    │ [Niveau]       │
│ Change Failure Rate   │ [X.X]%     │ [Niveau]       │
│ MTTR                  │ [X.X]h     │ [Niveau]       │
└─────────────────────────────────────────────────────┘

Niveau global : 🥇 Élite / 🥈 Haute / 🥉 Moyenne / ❌ Faible

Métrique la plus forte   : [Métrique] ([Valeur])
Métrique à améliorer en priorité : [Métrique] ([Valeur])
```

### Étape 4 — Analyse causale AIAD

Pour chaque métrique en niveau Moyenne ou Faible, identifier les causes potentielles à partir des artefacts AIAD :

#### Deployment Frequency faible
Causes possibles à vérifier :
- SPECs trop larges (non atomiques) → vérifier SQS critère 3 dans `metrics/specs/`
- Gate fermée trop souvent → vérifier `gate_result: closed` dans `metrics/specs/`
- WIP élevé → vérifier `wip` moyen dans `metrics/standup/`
- Utiliser `/sdd split` si les SPECs sont systématiquement trop grosses

#### Lead Time élevé
Causes possibles à vérifier :
- Délai long entre création Intent et création SPEC → gap PM→PE
- Gate fermée plusieurs fois (attempts > 1) → vérifier `metrics/specs/`
- Standup révèle des blocages récurrents → vérifier `metrics/standup/`
- Contexte agent trop lourd → vérifier les budgets de contexte (sdd-exec)

#### Change Failure Rate élevé
Causes possibles à vérifier :
- SQS moyen faible → SPECs insuffisamment précises
- Critères d'acceptation non testables → SQS critère 2 en échec
- Drifts non détectés avant merge → fréquence `sdd-drift-check` insuffisante
- Gouvernance non vérifiée → `sdd-validate` étape 4 sautée

#### MTTR élevé
Causes possibles à vérifier :
- Architecture peu observable → revoir `metrics/tech-review/` (dette monitoring)
- Pas d'ADR sur la procédure de rollback → créer via `/aiad tech-review`
- ARCHITECTURE.md pas à jour → PE ne sait pas où intervenir

### Étape 5 — Tendance sur 3 périodes

Si les données le permettent (3 mois ou plus), calculer la tendance :

| Métrique | Période -2 | Période -1 | Période actuelle | Tendance |
|----------|------------|------------|-----------------|----------|
| Deployment Frequency | [X] | [X] | [X] | ↑/→/↓ |
| Lead Time | [X.X]j | [X.X]j | [X.X]j | ↑/→/↓ |
| Change Failure Rate | [X]% | [X]% | [X]% | ↑/→/↓ |
| MTTR | [X.X]h | [X.X]h | [X.X]h | ↑/→/↓ |

### Règles

- Les métriques DORA sont des **indicateurs de résultat**, pas de comportement — elles révèlent l'effet mais pas la cause
- Ne pas viser le niveau "Élite" immédiatement — une progression de niveau à l'autre en 1-2 trimestres est réaliste
- Un MTTR nul n'est pas un objectif : c'est le signe qu'on ne déploie pas (Deployment Frequency nulle)
- Le Change Failure Rate doit être honnête : un hotfix non tracé ne disparaît pas, il se transforme en dette cachée
- Les données manquantes dans `metrics/deployments/` = déploiements non tracés = métriques non fiables → alerter le PE

### Anti-patterns

- ❌ Interpréter une seule valeur sans tendance (un bon mois peut cacher une dégradation)
- ❌ Comparer avec des benchmarks externes sans tenir compte du contexte de l'équipe
- ❌ Viser le niveau "Élite" sans comprendre les causes structurelles des niveaux actuels
- ❌ Confondre Lead Time DORA (commit → prod) et Lead Time AIAD (intent → prod) — les deux sont utiles, ils mesurent des choses différentes
- ❌ Ignorer les données manquantes → elles faussent les moyennes

$ARGUMENTS
