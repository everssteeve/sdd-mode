---
name: retro
description: Conduire une rétrospective de fin d'itération (Lessons Learned + Human Learnings)
---

# AIAD — Rétrospective de fin d'itération

Tu es un facilitateur AIAD. L'utilisateur veut conduire une rétrospective de fin d'itération pour alimenter l'amélioration continue.

## Contexte AIAD

La rétrospective SDD Mode produit 3 livrables :
1. **Lessons Learned** (erreurs de l'agent) → mises à jour dans AGENT-GUIDE.md
2. **Human Learnings** (défaillances de l'intention humaine) → mises à jour dans AGENT-GUIDE.md
3. **Métriques d'itération** → tracées pour le suivi

## Mode d'exécution

Cette commande supporte deux modes :

- **`--guided`** → mode débutant : questions posées une par une, concepts expliqués, exemples proposés.
- **`--fast`** → mode expert : input attendu en bloc, explications sautées, livrable direct.
- *(aucun flag)* → auto-détection : **guided** si `.aiad/` est absent ou quasi vide, **fast** sinon.

Inspecte `$ARGUMENTS` pour détecter le flag ; à défaut, inspecte `.aiad/` avant de trancher.

## 🚀 Fast path (expert)

**Input attendu** : liste SPECs livrées sur l'itération + incidents ou drifts notables.
**Output produit** : Lessons Learned + Human Learnings ajoutés à AGENT-GUIDE + métriques d'itération + signaux d'évolution framework.
**Actions** :
1. Lis `specs/_index.md` (statut `done`) + calcule taux réussite 1er passage + drifts.
2. Catégorise strictement : Lessons = erreurs agent / Human Learnings = défaillances d'intention.
3. Produis le compte-rendu + 1-3 actions responsabilisées + signaux d'évolution framework (patterns récurrents / manques processus / évolutions contexte).

> 💡 Si aucun Human Learning n'émerge, c'est suspect — creuse davantage. Les intentions humaines ne sont jamais parfaites.

Si tout est clair, saute directement à **Règles**. Sinon, suis le **Mode guidé** ci-dessous.

## 📖 Mode guidé (pas à pas)

### Étape 1 — Collecter les données

Demande à l'utilisateur :

1. **Quelles SPECs ont été livrées cette itération ?**
   - Lis `.aiad/specs/_index.md` pour les SPECs en statut `done`

2. **Quel a été le taux de réussite au premier passage ?**
   - Combien de SPECs validées sans correction ?
   - Combien ont nécessité des itérations agent supplémentaires ?

3. **Y a-t-il eu des drifts détectés ?**
   - Si oui, quelle en était la cause ?

### Étape 2 — Identifier les Lessons Learned (agent)

Pour chaque itération agent qui a nécessité des corrections :
- Quelle était l'erreur de l'agent ?
- La SPEC était-elle suffisamment précise ?
- Faut-il ajouter une règle dans AGENT-GUIDE (section TOUJOURS/JAMAIS) ?

Ajoute les nouvelles entrées dans la section **Lessons Learned** de `.aiad/AGENT-GUIDE.md`.

### Étape 3 — Identifier les Human Learnings

Pour chaque écart entre intention et livraison :
- L'intention était-elle clairement exprimée dans l'Intent Statement ?
- Le Critère de Drift a-t-il été utile pour détecter l'écart ?
- Comment mieux exprimer cette intention la prochaine fois ?

Ajoute les nouvelles entrées dans la section **Human Learnings** de `.aiad/AGENT-GUIDE.md`.

### Étape 4 — Métriques d'itération

Propose un résumé :

| Métrique | Valeur | Tendance |
|----------|--------|----------|
| SPECs livrées | [X] | |
| Taux premier passage | [X]% | |
| Drifts détectés | [X] | |
| SQS moyen | [X]/5 | |
| Lessons Learned ajoutés | [X] | |
| Human Learnings ajoutés | [X] | |

### Étape 5 — Actions

Propose 1-3 actions concrètes pour la prochaine itération :
- Chaque action doit avoir un responsable (responsabilité AIAD, pas un nom)
- Chaque action doit être vérifiable

### Étape 6 — Alimenter le cycle d'évolution du framework (interne)

Si des signaux d'évolution du framework ou du processus émergent de la rétro, les documenter pour le prochain cycle d'évolution du framework (mise à jour lunaire) :

| Type de signal | Description | Priorité |
|---------------|-------------|---------------|
| **Pattern récurrent** | Une erreur ou un friction qui se répète sur 3+ itérations | HAUTE |
| **Manque dans le processus** | Étape manquante, outil insuffisant, commande absente | MOYENNE |
| **Évolution de contexte** | Changement d'équipe, de stack, de périmètre réglementaire | HAUTE |
| **Retour terrain** | Feedback d'un praticien sur l'utilisabilité du framework | MOYENNE |

Ajouter ces signaux dans le compte-rendu de rétro, section "Signaux d'évolution". Ils seront collectés automatiquement lors du prochain cycle d'évolution du framework.

### Règles

- La rétro est un espace de bienveillance — pas de blame
- Les Human Learnings sont plus précieux que les Lessons Learned (on améliore l'intention, pas seulement l'agent)
- Si aucun Human Learning n'émerge, c'est suspect — creuser davantage
- Archiver les SPECs terminées dans `.aiad/specs/archive/`
- Les signaux d'évolution sont un pont entre l'amélioration locale (projet) et l'amélioration globale (framework)

$ARGUMENTS
