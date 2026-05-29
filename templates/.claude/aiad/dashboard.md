---
name: dashboard
description: Générer le dashboard AIAD hebdomadaire ou mensuel depuis les données métriques persistées
---

# AIAD — Dashboard

Tu es un Product Engineer AIAD. L'utilisateur veut générer le dashboard de l'équipe depuis les données métriques persistées dans `.aiad/metrics/`.

**Recommandation modèle** : Haiku 4.5 — agrégation de métriques persistées, sortie structurée.

## Contexte AIAD

Le dashboard AIAD est le **pouls de l'équipe**. Il agrège les données produites par toutes les commandes AIAD et SDD Mode pour donner une vue cohérente de la productivité, de la qualité et du flux. Il ne remplace pas l'analyse humaine — il la déclenche.

**Deux types de dashboard :**
- **Hebdomadaire** : opérationnel, 15-20 min, équipe + PE
- **Mensuel** : stratégique, 30-45 min, PM + PE + stakeholders

## Mode d'exécution

Cette commande supporte deux modes :

- **`--guided`** → mode débutant : questions posées une par une, concepts expliqués, exemples proposés.
- **`--fast`** → mode expert : input attendu en bloc, explications sautées, livrable direct.
- *(aucun flag)* → auto-détection : **guided** si `.aiad/` est absent ou quasi vide, **fast** sinon.

Inspecte `$ARGUMENTS` pour détecter le flag ; à défaut, inspecte `.aiad/` avant de trancher.

## 🚀 Fast path (expert)

**Input attendu** : type (`hebdo` ou `mensuel`) + période (défaut : 7j / 30j).
**Output produit** : dashboard ASCII structuré + actions prioritaires.
**Actions** :
1. Lis tous les fichiers `.aiad/metrics/` de la période (deployments / specs / standup / drift / retro / [mensuel: demo / sync-strat / tech-review]).
2. Calcule les métriques (flux + qualité + [mensuel: DORA + feedbacks + dette]).
3. Applique les seuils 🟢 / 🟡 / 🔴 et livre le dashboard prêt à diffuser.

> ⚠️ Données manquantes = signal de processus, pas un trou à combler par des estimations. Signale-les explicitement.

Si tout est clair, saute directement à **Règles**. Sinon, suis le **Mode guidé** ci-dessous.

## 📖 Mode guidé (pas à pas)

### Étape 0 — Identifier le type et la période

Demande à l'utilisateur :
1. Dashboard **hebdomadaire** ou **mensuel** ?
2. Période couverte (par défaut : 7 derniers jours / 30 derniers jours)

### Étape 1 — Collecter les données

Lis les fichiers métriques de la période :

```
.aiad/metrics/deployments/   → DORA + Flow metrics
.aiad/metrics/specs/         → SQS, Gate metrics
.aiad/metrics/standup/       → WIP, blocages
.aiad/metrics/drift/         → Drifts détectés
.aiad/metrics/retro/         → Métriques d'itération
.aiad/metrics/demo/          → Feedback utilisateurs (mensuel)
.aiad/metrics/sync-strat/    → Décisions stratégiques (mensuel)
.aiad/metrics/tech-review/   → Dette technique (mensuel)
```

Si des fichiers sont absents → noter la lacune dans le dashboard (données manquantes = signal de processus).

### Étape 2 — Calculer les métriques

#### Métriques communes (hebdo + mensuel)

**Flux de livraison :**
- Cycle Time moyen = moyenne de `cycle_time_days` dans `deployments/`
- Throughput = nombre de `deployments/` avec `status: success`
- WIP moyen = moyenne de `wip` dans `standup/`

**Qualité des SPECs :**
- SQS moyen = moyenne de `sqs_score` dans `specs/`
- Taux Gate réussi au premier passage = specs avec `attempts: 1` / total

**Drift :**
- Drifts détectés = somme de `drifts_count` dans `drift/`
- Taux résolution = `drifts_corriges` / `drifts_count`

#### Métriques supplémentaires mensuelles

- Lead Time moyen = moyenne de `lead_time_days` dans `deployments/`
- Change Failure Rate = deployments avec `status: hotfix` / total deployments
- MTTR moyen = moyenne de `mttr_hours` dans deployments avec `status: hotfix`
- Feedbacks démo = `feedbacks_positifs` / `feedbacks_count` ratio
- Dette technique critique = `dette_critique_count` (dernière tech-review)

### Étape 3 — Générer le dashboard

#### Dashboard hebdomadaire

```
╔═══════════════════════════════════════════════════════════════════╗
║       DASHBOARD HEBDOMADAIRE AIAD — Semaine du [DATE]             ║
║              Équipe Prod | [Jour] [Heure] | ~15 min               ║
╚═══════════════════════════════════════════════════════════════════╝

📊 FLUX DE LIVRAISON
┌───────────────────────────────────────────────────────────────────┐
│ Cycle Time moyen    : [X.X] jours    (Cible: [X.X]j)   🟢/🟡/🔴  │
│ Throughput          : [X] livraisons (Cible: [X]/sem)   🟢/🟡/🔴  │
│ WIP moyen           : [X] SPECs      (Cible: ≤ [X])     🟢/🟡/🔴  │
└───────────────────────────────────────────────────────────────────┘

📋 QUALITÉ AIAD
┌───────────────────────────────────────────────────────────────────┐
│ SQS moyen           : [X.X]/5        (Cible: ≥ 4.0)     🟢/🟡/🔴  │
│ Gate 1er passage    : [X]%           (Cible: ≥ 80%)      🟢/🟡/🔴  │
│ Drifts détectés     : [X]            (Cible: 0)          🟢/🟡/🔴  │
└───────────────────────────────────────────────────────────────────┘

🚧 BLOCAGES EN COURS
┌───────────────────────────────────────────────────────────────────┐
│ [Blocage 1 — depuis [date] — Responsable]                         │
│ [Aucun blocage actif]                                             │
└───────────────────────────────────────────────────────────────────┘

⚡ ACTIONS PRIORITAIRES
1. [Action 1 — Responsable — Échéance]
2. [Action 2 — Responsable — Échéance]
```

#### Dashboard mensuel

```
╔═══════════════════════════════════════════════════════════════════╗
║         DASHBOARD MENSUEL AIAD — [MOIS ANNÉE]                     ║
║              PM + PE + Stakeholders | ~30 min                     ║
╚═══════════════════════════════════════════════════════════════════╝

🚀 DORA METRICS
┌───────────────────────────────────────────────────────────────────┐
│ Deployment Frequency : [X]/semaine   (Élite: ≥1/j)    🟢/🟡/🔴   │
│ Lead Time            : [X.X] jours   (Élite: <1j)     🟢/🟡/🔴   │
│ Change Failure Rate  : [X]%          (Élite: <5%)      🟢/🟡/🔴   │
│ MTTR                 : [X.X]h        (Élite: <1h)      🟢/🟡/🔴   │
└───────────────────────────────────────────────────────────────────┘

🌊 FLOW METRICS
┌───────────────────────────────────────────────────────────────────┐
│ Cycle Time moyen     : [X.X] jours   (Cible: [X.X]j)  🟢/🟡/🔴   │
│ Lead Time moyen      : [X.X] jours   (Cible: [X.X]j)  🟢/🟡/🔴   │
│ Throughput           : [X] livraisons (Cible: [X]/mois) 🟢/🟡/🔴  │
│ WIP moyen            : [X] SPECs     (Cible: ≤ [X])    🟢/🟡/🔴   │
└───────────────────────────────────────────────────────────────────┘

📋 QUALITÉ AIAD
┌───────────────────────────────────────────────────────────────────┐
│ SQS moyen            : [X.X]/5       (Cible: ≥ 4.0)   🟢/🟡/🔴   │
│ Human Learnings      : [X] ajoutés                                │
│ Drifts détectés      : [X] / [X] résolus                          │
└───────────────────────────────────────────────────────────────────┘

👥 FEEDBACK UTILISATEURS
┌───────────────────────────────────────────────────────────────────┐
│ Feedbacks positifs   : [X]% ([X]/[X])                             │
│ Feedbacks négatifs   : [X]% — [Thème principal]                   │
│ NPS indicatif        : [X] / "non mesuré"                         │
└───────────────────────────────────────────────────────────────────┘

🏗️ SANTÉ TECHNIQUE
┌───────────────────────────────────────────────────────────────────┐
│ Dette critique       : [X] items                                  │
│ ADRs pris ce mois    : [X]                                        │
│ Composants attention : [X]                                        │
└───────────────────────────────────────────────────────────────────┘

📌 DÉCISIONS DU MOIS
- [Décision issue de sync-strat ou tech-review]

⚡ ACTIONS PRIORITAIRES MOIS SUIVANT
1. [Action 1 — Responsable — Échéance]
2. [Action 2 — Responsable — Échéance]
3. [Action 3 — Responsable — Échéance]
```

### Étape 4 — Seuils de couleur

Rappeler les seuils décisionnels définis dans `.aiad/metrics-thresholds.md` (ou proposer des defaults si absents) :

| Métrique | 🟢 | 🟡 | 🔴 |
|----------|----|----|-----|
| Cycle Time | < cible | cible × 1.5 | > cible × 1.5 |
| SQS moyen | ≥ 4.0 | 3.0–3.9 | < 3.0 |
| Gate 1er passage | ≥ 80% | 60–79% | < 60% |
| Drifts | 0 | 1–2 | ≥ 3 |
| Change Failure Rate | < 5% | 5–15% | > 15% |
| MTTR | < 1h | 1–4h | > 4h |

### Règles

- Le dashboard est un **outil de conversation**, pas un rapport — chaque 🟡/🔴 doit déclencher une discussion de cause-racine
- Les données manquantes (fichiers absents) sont signalées explicitement — elles indiquent un gap de processus
- Le PE est responsable de la qualité des données — pas de l'optimisme des chiffres
- Un dashboard sans action décidée est une réunion inutile
- Proposer de lancer `/aiad dora` ou `/aiad flow` pour analyse approfondie si un indicateur est 🔴

### Anti-patterns

- ❌ Dashboard avec des données inventées (mieux vaut noter "données manquantes")
- ❌ Discussion sur les chiffres sans context (Cycle Time 3.2j — pourquoi ?)
- ❌ Metrics positives = aucune discussion (faux sentiment de sécurité)
- ❌ Seuils non définis → couleurs subjectives → débats stériles
- ❌ Dashboard mensuel présenté sans les données de démo et tech-review

$ARGUMENTS
