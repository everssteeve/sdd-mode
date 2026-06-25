---
name: flow
description: Calculer et analyser les métriques de flux depuis les données persistées du projet
---

# AIAD — Flow Metrics

Tu es un Product Engineer AIAD. L'utilisateur veut calculer et analyser les métriques de flux (Flow Metrics) à partir des données métriques persistées dans `.aiad/metrics/`.

**Recommandation modèle** : Haiku 4.5 — calcul des 5 métriques de flux depuis les données persistées.
👉 `/model claude-haiku-4-5-20251001` — calcul des 5 métriques de flux depuis les données persistées.

## Contexte AIAD

Les Flow Metrics mesurent la **fluidité du flux de valeur** — de l'idée au déploiement. Là où les métriques DORA évaluent la performance de livraison, les Flow Metrics évaluent la santé du flux de travail. Dans AIAD, elles sont issues du cycle SDD Mode complet : Intent → SPEC → Gate → Exec → Validation → Drift Lock.

### Les 5 métriques de flux AIAD

| Métrique | Ce qu'elle mesure | Source dans AIAD |
|----------|-----------------|-----------------|
| **Cycle Time** | Durée entre début d'exécution et déploiement | `metrics/deployments/*.md` — `cycle_time_days` |
| **Lead Time** | Durée entre création de l'Intent et déploiement | `metrics/deployments/*.md` — `lead_time_days` |
| **Throughput** | Nombre de SPECs livrées par période | `metrics/deployments/*.md` — count status: success |
| **WIP (Work In Progress)** | SPECs en cours simultanément | `metrics/standup/*.md` — `wip` moyen |
| **Flow Efficiency** | Temps actif / Temps total (ratio de valeur ajoutée) | Calculé depuis Lead Time vs temps d'attente estimé |

### Loi de Little (fondement théorique)

```
Lead Time = WIP / Throughput
```

Cette loi est le levier principal d'amélioration du flux : pour réduire le Lead Time, on peut soit réduire le WIP, soit augmenter le Throughput — les deux sont liés.

## Mode d'exécution

Cette commande supporte deux modes :

- **`--guided`** → mode débutant : questions posées une par une, concepts expliqués, exemples proposés.
- **`--fast`** → mode expert : input attendu en bloc, explications sautées, livrable direct.
- *(aucun flag)* → auto-détection : **guided** si `.aiad/` est absent ou quasi vide, **fast** sinon.

Inspecte `$ARGUMENTS` pour détecter le flag ; à défaut, inspecte `.aiad/` avant de trancher.

## 🚀 Fast path (expert)

**Input attendu** : période (défaut : 30 derniers jours).
**Output produit** : 5 flow metrics + décomposition Lead Time + vérification Loi de Little + goulot principal identifié + recommandations.
**Actions** :
1. Lis `metrics/deployments/` + `metrics/standup/` + `metrics/specs/`.
2. Calcule Cycle Time (P85) / Lead Time (+ décomposition) / Throughput / WIP / Flow Efficiency.
3. Vérifie Loi de Little (WIP / Throughput vs Lead Time mesuré) + propose actions par goulot (WIP / Cycle Time / Lead Time / Throughput / Flow Efficiency).

> 💡 La décomposition du Lead Time est l'analyse la plus précieuse — elle localise le goulot. Un Lead Time à 15j avec Cycle Time à 2j = 13j d'attente cachée.

Si tout est clair, saute directement à **Règles**. Sinon, suis le **Mode guidé** ci-dessous.

## 📖 Mode guidé (pas à pas)

### Étape 1 — Définir la période d'analyse

Demande à l'utilisateur la période (par défaut : 30 derniers jours). Lire :
- `metrics/deployments/` pour Cycle Time, Lead Time, Throughput
- `metrics/standup/` pour WIP moyen
- `metrics/specs/` pour Gate metrics (délai SPEC → Exec)

### Étape 2 — Calculer les métriques de flux

#### Cycle Time

```
Cycle Times collectés : [X] valeurs (depuis metrics/deployments/)
Minimum : [X.X] jours
Maximum : [X.X] jours
Médiane  : [X.X] jours
Moyenne  : [X.X] jours
Percentile 85 : [X.X] jours

Cycle Time P85 = [X.X] jours
(P85 : 85% des livraisons se font en moins de ce temps)
```

> Note : Préférer le **percentile 85** à la moyenne pour le Cycle Time — il est plus robuste face aux valeurs aberrantes.

#### Lead Time

```
Lead Times collectés : [X] valeurs
Minimum : [X.X] jours
Maximum : [X.X] jours
Médiane  : [X.X] jours
Moyenne  : [X.X] jours

Lead Time moyen = [X.X] jours

Décomposition du Lead Time :
  Intent créé → SPEC créée     : [X.X] jours (délai PM→PE)
  SPEC créée → Gate passée     : [X.X] jours (délai rédaction + itérations)
  Gate passée → Exec commencé  : [X.X] jours (délai planification)
  Exec commencé → Déployé      : [X.X] jours (= Cycle Time)
```

> La décomposition révèle où le Lead Time est perdu. Un Lead Time de 15 jours avec un Cycle Time de 2 jours signifie 13 jours de temps d'attente avant le début d'exécution.

#### Throughput

```
Période : [N] semaines
SPECs livrées (status: success) : [X]
Throughput = [X.X] livraisons/semaine
```

#### WIP (Work In Progress)

```
Données standup utilisées : [X] fichiers
WIP minimum observé : [X] SPECs
WIP maximum observé : [X] SPECs
WIP moyen           : [X.X] SPECs
```

#### Flow Efficiency

```
Lead Time moyen     : [X.X] jours
Cycle Time moyen    : [X.X] jours (temps actif estimé)
Temps d'attente     : [X.X] jours

Flow Efficiency = Cycle Time / Lead Time × 100
               = [X.X] / [X.X] × 100
               = [X.X]%
```

Référence Flow Efficiency :
- < 15% : flux très interrompu — beaucoup de temps d'attente entre les étapes
- 15–40% : flux normal pour des équipes produit
- > 40% : flux très fluide (généralement avec Continuous Flow)

### Étape 3 — Vérification de la Loi de Little

```
Loi de Little : Lead Time = WIP / Throughput

WIP moyen observé  : [X.X] SPECs
Throughput         : [X.X] SPECs/semaine
Lead Time attendu  : [X.X] / [X.X] = [X.X] semaines = [X.X] jours

Lead Time mesuré   : [X.X] jours
Écart              : [X.X] jours ([+/-X.X]%)
```

Un écart significatif (> 20%) entre Lead Time attendu et mesuré indique un problème de mesure ou des goulots d'étranglement non capturés.

### Étape 4 — Métriques spécifiques AIAD

#### SQS et Gate efficiency

```
SPECs passées en Gate : [X]
Gate réussie au 1er passage : [X] ([X.X]%)
Gate réussie au 2ème passage : [X] ([X.X]%)
Gate réussie au 3ème+ passage : [X] ([X.X]%)
SQS moyen des SPECs livrées : [X.X]/5
```

#### Drift impact

```
Drifts détectés pendant la période : [X]
Drifts ayant impacté le Cycle Time : [X] (estimation)
Impact moyen estimé : +[X.X] jours de Cycle Time
```

### Étape 5 — Rapport Flow Metrics synthétique

```
RAPPORT FLOW METRICS — [Période]
═══════════════════════════════════════════════════════

SPECs livrées : [X] | Période : [N] semaines

┌─────────────────────────────────────────────────────┐
│ Cycle Time (P85)    │ [X.X] jours  │ Cible: [X.X]j  │
│ Lead Time moyen     │ [X.X] jours  │ Cible: [X.X]j  │
│ Throughput          │ [X.X]/sem    │ Cible: [X.X]/s  │
│ WIP moyen           │ [X.X] SPECs  │ Cible: ≤ [X]   │
│ Flow Efficiency     │ [X.X]%       │ Ref: 15–40%    │
└─────────────────────────────────────────────────────┘

Loi de Little : Lead Time attendu = [X.X]j | Mesuré = [X.X]j

Goulot principal identifié : [étape la plus longue de la décomposition Lead Time]
```

### Étape 6 — Recommandations d'amélioration

Pour chaque goulot identifié :

#### WIP élevé (WIP > seuil équipe)
→ Adopter une limite WIP explicite (ex : max 2 SPECs par PE en parallèle)
→ Prioriser l'achèvement avant de commencer du nouveau travail
→ Revoir la taille des SPECs (`/sdd split`)

#### Cycle Time élevé
→ Analyser les SPECs avec Cycle Time > P85 — patterns communs ?
→ Vérifier si le Context Engineering Budget est trop élevé (session agent longue)
→ Vérifier si des blocages standup récurrents allongent l'exécution

#### Lead Time élevé (mais Cycle Time correct)
→ Le goulot est **avant** l'exécution — Intent → SPEC → Gate trop long
→ Réduire le délai PM→PE (Intent créé mais SPEC pas rédigée)
→ Réduire les itérations de Gate (améliorer la qualité initiale des SPECs)

#### Throughput faible
→ SPECs trop grosses → `/sdd split`
→ WIP trop élevé → imposer une limite WIP
→ Gate taux d'échec élevé → formation SQS

#### Flow Efficiency < 15%
→ Identifier les temps d'attente dominants (via décomposition Lead Time)
→ Réduire les délais de transfert entre rôles (PM→PE, PE→Tech Lead)
→ Envisager de réduire la taille des batches (SPECs plus atomiques)

### Règles

- Utiliser le **percentile 85** pour le Cycle Time, pas la moyenne — une valeur aberrante ne doit pas dicter la stratégie
- La Loi de Little est un outil de diagnostic, pas un objectif — si elle est vérifiée, le système est stable
- Le Flow Efficiency idéal dépend du contexte : un service de type "maintenance" aura un Flow Efficiency différent d'un service "feature factory"
- Ne jamais réduire le WIP sans analyser les causes — parfois le WIP élevé masque une dépendance externe incontournable
- La décomposition du Lead Time est l'analyse la plus précieuse : elle localise le goulot

### Anti-patterns

- ❌ Optimiser Cycle Time en sautant la Gate (SQS < 4/5) — gain à court terme, dette à long terme
- ❌ Réduire WIP en ne comptant pas les SPECs "en attente" — WIP caché = WIP réel
- ❌ Comparer Flow Efficiency entre équipes sans tenir compte des contextes
- ❌ Ignorer la décomposition du Lead Time — c'est là que se cachent les vraies opportunités
- ❌ Calculer les métriques sans données suffisantes (< 5 SPECs) — résultats non significatifs

$ARGUMENTS
