---
name: sdd-context
description: Auditer le Context Engineering Budget d'une session agent (estimation vs. réel) avec métriques de santé du contexte
---

# SDD Mode — Audit du Context Engineering Budget

Tu es un Product Engineer AIAD. L'utilisateur veut auditer le Context Engineering Budget d'une session agent — comparer l'estimation faite dans la SPEC avec la réalité de l'exécution, et produire un score de santé du contexte.

## Contexte SDD Mode

Le **Context Engineering Budget** est une responsabilité fondamentale du PE (Principe #3 de SDD Mode v1.4). L'estimation est faite en amont dans la SPEC (section 6), mais elle n'est jamais vérifiée a posteriori. Cette commande ferme la boucle de feedback pour que le PE s'améliore dans ses estimations et optimise ses sessions futures.

> Le Context Engineering Budget sert la Sobriété Intentionnelle — il ne s'agit pas de maximiser le contexte mais de l'optimiser.

## Mode d'exécution

Cette commande supporte deux modes :

- **`--guided`** → mode débutant : questions posées une par une, concepts expliqués, exemples proposés.
- **`--fast`** → mode expert : input attendu en bloc, explications sautées, livrable direct.
- *(aucun flag)* → auto-détection : **guided** si `.aiad/` est absent ou quasi vide, **fast** sinon.

Inspecte `$ARGUMENTS` pour détecter le flag ; à défaut, inspecte `.aiad/` avant de trancher.

## 🚀 Fast path (expert)

**Input attendu** : SPEC-NNN dont la session vient de s'exécuter + estimation initiale du budget.
**Output produit** : rapport d'audit avec score santé [X]/5 + recommandations actionnables + éventuelle MAJ Lessons/Human Learnings.
**Actions** :
1. Compare estimation vs réel sur chaque composant injecté (AGENT-GUIDE / SPEC / sources / ajouts en cours).
2. Calcule les 5 métriques de santé (M1 taux utile / M2 relances / M3 ratio / M4 cohérence / M5 durée).
3. Produis le rapport et mets à jour SPEC ou AGENT-GUIDE (Lessons Learned / Human Learnings) selon le pattern détecté.

Si tout est clair, saute directement à **Règles**. Sinon, suis le **Mode guidé** ci-dessous.

## 📖 Mode guidé (pas à pas)

### Étape 1 — Identifier la session à auditer

Demande quelle SPEC/session agent auditer. Lis la SPEC pour récupérer l'estimation initiale (section "Estimation Context Engineering Budget").

### Étape 2 — Mesurer le contexte réel

Analyse la session agent qui vient de s'exécuter :

| Composant | Estimation | Réel | Écart |
|-----------|-----------|------|-------|
| AGENT-GUIDE (condensé) | ~[X] tokens | ~[X] tokens | [+/-X]% |
| SPEC | ~[X] tokens | ~[X] tokens | [+/-X]% |
| Fichiers source injectés | ~[X] tokens | ~[X] tokens | [+/-X]% |
| Contexte ajouté en cours de session | 0 | ~[X] tokens | N/A |
| **Total** | **~[X] tokens** | **~[X] tokens** | **[+/-X]%** |

### Étape 3 — Métriques de santé du contexte *(v1.4)*

Calcule les 5 métriques de santé suivantes. Elles mesurent non pas la quantité de contexte, mais sa **qualité opérationnelle**.

| Métrique | Méthode de calcul | Valeur | Seuil sain |
|----------|------------------|--------|-----------|
| **M1 — Taux d'utilisation utile** | % du contexte réellement référencé par l'agent dans ses réponses vs. contexte total injecté | [X]% | ≥ 70% |
| **M2 — Fréquence de relances** | Nombre de `/compact` ou reprises de session nécessaires | [X] | 0 (idéal) — 1 acceptable |
| **M3 — Ratio estimation/réel** | Contexte réel / contexte estimé | [X.X] | Entre 0.8 et 1.3 |
| **M4 — Score de cohérence** | L'agent a-t-il respecté toutes les contraintes AGENT-GUIDE sans exception ? 1 point par contrainte respectée / total contraintes | [X]/[Y] | ≥ 90% |
| **M5 — Durée de session** | Durée réelle de la session active | [X] min | < 35 min |

**Score de santé global :**

```
Score = (M1 ≥ 70% : 1pt) + (M2 = 0 : 1pt, M2 = 1 : 0.5pt) + (M3 entre 0.8-1.3 : 1pt) + (M4 ≥ 90% : 1pt) + (M5 < 35min : 1pt)

OPTIMAL    : 5/5 — Session exemplaire, répliquer ce pattern
ACCEPTABLE : 3-4/5 — Quelques points d'amélioration
À AMÉLIORER : 1-2/5 — Pattern à corriger avant la prochaine session
CRITIQUE   : 0/5 — Session à reprendre en corrigeant les fondamentaux
```

### Étape 4 — Analyser la qualité du contexte

Évalue l'efficacité du contexte injecté :

| Question | Réponse |
|----------|---------|
| L'agent a-t-il eu besoin d'information non fournie ? | OUI/NON — Si oui, lesquelles ? |
| L'agent a-t-il ignoré des parties du contexte ? | OUI/NON — Si oui, lesquelles ? |
| Y a-t-il eu du "context rot" (dégradation de qualité) ? | OUI/NON — À partir de quel moment ? |
| Le seuil de 50K tokens a-t-il été dépassé ? | OUI/NON |
| L'objectif de session était-il unique et isolé ? | OUI/NON |
| Combien de relances ont été nécessaires ? | [X] |

### Étape 5 — Diagnostic

| Pattern détecté | Cause probable | Action corrective |
|-----------------|---------------|-------------------|
| Écart > 30% en surplus | Fichiers source surestimés | Condenser davantage en amont |
| Écart > 30% en manque | Dépendances non anticipées | Améliorer la section 5 (Dépendances) de la SPEC |
| Context rot observé | Contexte permanent trop volumineux | Condenser l'AGENT-GUIDE, résumer l'ARCHITECTURE |
| Relances multiples (M2 > 1) | SPEC imprécise ou contexte insuffisant | Vérifier SQS, envisager `/sdd-split` |
| Agent a ignoré des contraintes (M4 < 90%) | Contexte noyé dans le bruit | Restructurer le prompt (contraintes en premier) |
| Session > 35 min (M5 échoué) | Objectif trop large pour une session | Décomposer via `/sdd-split` |
| M1 < 70% | Contexte injecté en excès (bruit) | Appliquer Recommandation 1 — Isolation de contexte |

### Étape 6 — Rapport d'audit

Produis un rapport d'audit concis :

```
AUDIT CONTEXT ENGINEERING BUDGET — SPEC-[NNN]
══════════════════════════════════════════════

Estimation : ~[X] tokens
Réel :       ~[X] tokens
Écart :      [+/-X]%

MÉTRIQUES DE SANTÉ
──────────────────
M1 Taux utile    : [X]%       [✅ / ⚠️ / ❌]
M2 Relances      : [X]        [✅ / ⚠️ / ❌]
M3 Ratio est/réel: [X.X]      [✅ / ⚠️ / ❌]
M4 Cohérence     : [X]/[Y]    [✅ / ⚠️ / ❌]
M5 Durée         : [X] min    [✅ / ⚠️ / ❌]

Score santé : [X]/5 — [OPTIMAL / ACCEPTABLE / À AMÉLIORER / CRITIQUE]

Recommandations :
1. [Recommandation actionnable]
2. [Recommandation actionnable]

Apprentissage pour futures estimations :
- [Pattern à retenir pour le PE]
```

### Étape 7 — Mettre à jour les références

Si l'audit révèle des insights utiles :
1. Mettre à jour la section "Estimation Context Engineering Budget" de la SPEC (pour archivage)
2. Si un pattern se répète → l'ajouter dans l'AGENT-GUIDE section "Lessons Learned"
3. Si le PE a mal estimé → l'ajouter dans l'AGENT-GUIDE section "Human Learnings"

### Règles

- L'audit de contexte n'est pas une punition — c'est une boucle d'amélioration (Sobriété Intentionnelle)
- Le but est que le PE devienne meilleur en estimation, pas de chercher la perfection
- Un écart M3 entre 0.8 et 1.3 est acceptable. Au-delà, creuser la cause
- Le context rot (M4 + M5) est le signal d'alerte le plus important — il dégrade silencieusement
- Garder les audits courts et actionnables — pas de rapport de 5 pages

$ARGUMENTS
