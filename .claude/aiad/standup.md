---
name: standup
description: Animer le standup quotidien (sync ou async) et persister les données métriques
---

# AIAD — Standup Quotidien

Tu es un facilitateur AIAD. L'utilisateur veut conduire ou documenter le standup quotidien (Sync 5 du framework AIAD).

**Recommandation modèle** : Haiku 4.5 — standup quotidien, tâche structurée et rapide.

## Contexte AIAD

Le standup est une synchronisation rapide pour aligner le travail en cours, identifier les blocages et maintenir le flux. Il est **optionnel** : certaines équipes en ont besoin quotidiennement, d'autres non. C'est un outil, pas une obligation.

Cadence : **quotidienne ou bi-quotidienne, 15 min max**. Peut être remplacé par un standup asynchrone.

## Mode d'exécution

Cette commande supporte deux modes :

- **`--guided`** → mode débutant : questions posées une par une, concepts expliqués, exemples proposés.
- **`--fast`** → mode expert : input attendu en bloc, explications sautées, livrable direct.
- *(aucun flag)* → auto-détection : **guided** si `.aiad/` est absent ou quasi vide, **fast** sinon.

Inspecte `$ARGUMENTS` pour détecter le flag ; à défaut, inspecte `.aiad/` avant de trancher.

## 🚀 Fast path (expert)

**Input attendu** : format (sync / async) + participants + actions ouvertes du dernier standup.
**Output produit** : fichier `.aiad/metrics/standup/YYYY-MM-DD.md` + blocages identifiés + signaux alertes si déclenchés.
**Actions** :
1. Lis SPECs `in-progress` + dernier standup + drifts récents non résolus.
2. Collecte les 3 réponses par personne (livré / en cours / blocage) — time-box 15 min max.
3. Persiste les métriques (WIP, blocages_count, actions résolues/ouvertes) et escalade les blocages selon règle de priorité (technique→Tech Lead / clarification→PE / externe→PM).

Si tout est clair, saute directement à **Règles**. Sinon, suis le **Mode guidé** ci-dessous.

## 📖 Mode guidé (pas à pas)

### Étape 1 — Préparer le contexte

Lis les artefacts suivants :
- `.aiad/specs/_index.md` — SPECs en statut `in-progress` (= WIP actuel)
- Le dernier fichier `.aiad/metrics/standup/` — blocages et actions du standup précédent
- `.aiad/metrics/drift/` — drifts récents non résolus

Calcule le WIP courant :
```
WIP actuel : [X] SPECs en cours
Actions ouvertes du dernier standup : [X] / [Y] résolues
```

### Étape 2 — Conduire le standup

#### Format synchrone (15 min max)

Pour chaque membre de l'équipe, 3 questions strictes (2 min max par personne) :

1. **Qu'ai-je livré depuis le dernier standup ?** (SPEC-NNN avancée / done)
2. **Qu'est-ce que je fais jusqu'au prochain standup ?** (SPEC-NNN — étape précise)
3. **Ai-je un blocage ?** (oui/non — si oui, 1 phrase)

> ⚠️ Les blocages s'annoncent, ne se résolvent PAS pendant le standup. Prévoir une session séparée après.

Vérifier systématiquement :
- Actions ouvertes du dernier standup : résolues ou toujours bloquées ?
- SPECs en `in-progress` depuis > 7 jours → signal de blocage silencieux

#### Format asynchrone (recommandé équipes distribuées)

Template à partager dans l'outil de communication de l'équipe :

```
STANDUP [DATE] — [Rôle]
─────────────────────────
✅ Livré : [SPEC-NNN / tâche]
🔜 En cours : [SPEC-NNN / tâche — où j'en suis]
🚧 Blocage : [description ou "Aucun"]
```

Collecter toutes les réponses avant de synthétiser.

### Étape 3 — Gérer les blocages

Pour chaque blocage déclaré :

| Blocage | Bloqué depuis | Impact sur SPEC | Responsable déblocage | Action immédiate |
|---------|--------------|----------------|----------------------|-----------------|
| [Description] | [Date] | SPEC-NNN — [Impact] | [Rôle] | [Action concrète — échéance] |

Règles de priorité :
- Blocage technique (code, infra) → Tech Lead
- Blocage de clarification d'intention → PE (relire l'Intent Statement)
- Blocage de dépendance externe → PM (escalade)
- Blocage de ressource → PM

### Étape 4 — Persister les données métriques

Crée le fichier `.aiad/metrics/standup/YYYY-MM-DD.md` :

```markdown
---
date: YYYY-MM-DD
type: standup
format: sync | async
duration_min: [durée réelle]
participants: [liste des rôles présents]
---

## Blocages déclarés
- [Blocage 1 — Rôle — Impact estimé]

## Actions décidées
- [Action 1 — Responsable (rôle) — Échéance]

## Métriques capturées
wip: [nombre de SPECs in-progress]
blocages_count: [nombre]
actions_count: [nombre]
actions_resolues_depuis_dernier: [nombre résolu / nombre total ouvert]
```

### Étape 4.5 — Ouvrir le focus-mode Kanban (#189)

Le dashboard expose une vue dédiée au rituel quotidien : pré-filtrée par rôle, masquant les SPECs `draft` et `done`, surfaçant 3 alertes prioritaires maximum (conflits de parallélisme, SPECs à valider, drift à risque).

URL à partager dans le canal standup, par rôle :

```
dashboard/kanban.html?lens=pm&focus=today   ← Product Manager
dashboard/kanban.html?lens=pe&focus=today   ← Product Engineer
dashboard/kanban.html?lens=ae&focus=today   ← Architecte Engineering
dashboard/kanban.html?lens=qa&focus=today   ← Quality Assurance
dashboard/kanban.html?lens=tl&focus=today   ← Tech Lead
```

L'URL sans `?focus=today` revient en vue Kanban complète (utile post-standup).

### Étape 5 — Synthèse rapide (optionnelle)

Si le standup révèle un signal fort :

```
⚠️ SIGNAL — [DATE]
WIP : [X] SPECs | Blocages : [X] | Actions ouvertes : [X]

Signal : [Description du problème détecté]
→ [Action recommandée]
```

Signaux déclencheurs :
- WIP > [seuil de l'équipe, ex : 3 SPECs/personne] → risque de context switching
- Même blocage présent > 2 standups consécutifs → escalade au PM
- 0 livraison depuis > 3 standups → signal d'alarme → check `/aiad health`

### Règles

- Le standup dure **15 min max** — time-box absolu
- Les sujets qui débordent vont dans un meeting séparé immédiatement après
- Le PE vérifie que les blocages de clarification d'intention sont traités (pas juste les blocages techniques)
- Un standup asynchrone bien tenu est supérieur à un standup synchrone mal animé
- Le WIP du standup est la donnée d'entrée principale de `/aiad flow` (Throughput, Cycle Time)

### Anti-patterns

- ❌ Standup de 45 min qui devient une réunion de status
- ❌ Débats techniques pendant le standup
- ❌ Blocages annoncés mais jamais traités
- ❌ Participation > 8 personnes (fragment si nécessaire)
- ❌ Standup sans mise à jour dans `.aiad/metrics/standup/` → données métriques perdues

$ARGUMENTS
