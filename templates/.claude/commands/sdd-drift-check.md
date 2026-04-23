---
name: sdd-drift-check
description: Vérifier la synchronisation artefacts/code (Drift Lock)
---

# SDD Mode — Anti-Drift Check

Tu es un Product Engineer AIAD. L'utilisateur veut vérifier la synchronisation entre les artefacts et le code (Drift Lock).

## Contexte SDD Mode

Le **Spec Drift** — situation où le code évolue mais les artefacts ne suivent pas — est le risque #1 du développement avec agents IA. SDD Mode le traite comme un **échec de processus**. Le Drift Lock exige que code ET SPEC soient synchronisés dans la même PR.

## Mode d'exécution

Cette commande supporte deux modes :

- **`--guided`** → mode débutant : questions posées une par une, concepts expliqués, exemples proposés.
- **`--fast`** → mode expert : input attendu en bloc, explications sautées, livrable direct.
- *(aucun flag)* → auto-détection : **guided** si `.aiad/` est absent ou quasi vide, **fast** sinon.

Inspecte `$ARGUMENTS` pour détecter le flag ; à défaut, inspecte `.aiad/` avant de trancher.

## 🚀 Fast path (expert)

**Input attendu** : PR ou branche à vérifier (ou SPEC-NNN active par défaut).
**Output produit** : verdict OK / DRIFT + mise à jour `_index.md` + entrée `CHANGELOG-ARTEFACTS.md`.
**Actions** :
1. Liste les fichiers modifiés et croise avec les SPECs actives.
2. Vérifie cohérence code ↔ SPEC et code ↔ ARCHITECTURE/AGENT-GUIDE.
3. Si drift détecté : propose MAJ SPEC OU correction code — ne merge jamais en état de drift.

Si tout est clair, saute directement à **Règles**. Sinon, suis le **Mode guidé** ci-dessous.

## 📖 Mode guidé (pas à pas)

### Étape 1 — Scanner les changements

Identifie tous les fichiers modifiés depuis le dernier commit/PR :
- Fichiers de code modifiés
- SPECs dans `.aiad/specs/` — modifiées ou non
- AGENT-GUIDE — modifié ou non

### Étape 2 — Vérifier la synchronisation SPEC ↔ Code

Pour chaque SPEC active (statut `in-progress` ou `validation`) :

| SPEC | Fichiers code liés | Code modifié ? | SPEC mise à jour ? | Synchronisé ? |
|------|-------------------|----------------|--------------------|----|
| [SPEC-NNN] | [fichiers] | OUI/NON | OUI/NON | OK/DRIFT |

### Étape 3 — Vérifier la synchronisation globale

| Artefact | Dernière mise à jour | Cohérent avec le code ? |
|----------|---------------------|------------------------|
| PRD.md | [date] | OUI / À VÉRIFIER |
| ARCHITECTURE.md | [date] | OUI / À VÉRIFIER |
| AGENT-GUIDE.md | [date] | OUI / À VÉRIFIER |

### Étape 4 — Drift détecté ?

**Si AUCUN drift :**
1. Mettre à jour le CHANGELOG-ARTEFACTS.md
2. Mettre à jour le statut de la SPEC → `done`
3. La PR est prête pour review

**Si DRIFT détecté :**
1. Lister précisément les écarts
2. Proposer les mises à jour de la SPEC pour refléter l'état réel du code
3. OU proposer les corrections de code pour correspondre à la SPEC
4. **Ne JAMAIS merger une PR en état de drift**

### Étape 5 — Mise à jour des index

- Mettre à jour `.aiad/specs/_index.md` (statut, PR)
- Mettre à jour l'Intent Statement parent si toutes les SPECs liées sont `done`
- Ajouter une entrée dans `CHANGELOG-ARTEFACTS.md`

### Règles

- Le Drift Lock est **non-négociable** : code + SPEC dans la même PR
- Un drift détecté n'est pas une honte — c'est le signe que le check fonctionne
- La SPEC est modifiable ! Si le code révèle une meilleure approche, mettez à jour la SPEC
- Le drift le plus dangereux est celui qu'on ne vérifie pas

$ARGUMENTS
