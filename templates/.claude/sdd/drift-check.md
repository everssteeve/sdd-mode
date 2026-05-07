---
name: drift-check
description: Vérifier la synchronisation artefacts/code (Drift Lock)
---

# SDD Mode — Anti-Drift Check

Tu es un Product Engineer AIAD. L'utilisateur veut vérifier la synchronisation entre artefacts et code (Drift Lock).

Le **Spec Drift** — code qui évolue sans que les artefacts suivent — est le risque #1 du dev avec agents IA. SDD Mode le traite comme un **échec de processus**. Le Drift Lock exige que code ET SPEC soient synchronisés dans la même PR.

## Skills invoquées

- 🔧 [`drift-detection`](../skills/drift-detection/SKILL.md) — détection homogène, output structuré.

## Modes

- `--guided` : pas à pas
- `--fast` : verdict direct
- *(par défaut)* : auto-détection

## 🚀 Fast path

**Input** : PR / branche à vérifier (ou SPEC-NNN active par défaut).
**Output** : verdict OK / DRIFT + MAJ `_index.md` + entrée `CHANGELOG-ARTEFACTS.md`.

1. Applique la skill `drift-detection`.
2. Si **OK** → MAJ `CHANGELOG-ARTEFACTS.md` + statut SPEC → `done` + `.aiad/specs/_index.md`.
3. Si **DRIFT** → présenter les écarts précis + proposer MAJ SPEC OU corrections code. **Ne jamais merger en état de drift**.

## 📖 Mode guidé

### Étape 1 — Détection

Applique la skill `drift-detection`. Sortie attendue : verdict OK/DRIFT par SPEC + type de drift (code-ahead / spec-ahead / orphan / architecture).

### Étape 2 — Mise à jour des index

Si OK :
- MAJ `.aiad/specs/_index.md` (statut, PR)
- MAJ Intent Statement parent si toutes les SPECs liées sont `done`
- Entrée dans `CHANGELOG-ARTEFACTS.md`

Si DRIFT :
- Lister précisément les écarts
- Proposer (a) MAJ SPEC pour refléter le code OU (b) correction code pour respecter la SPEC
- Le hook pre-commit (`hook-bypass.yml`) bloquera de toute façon

## Règles

- Le Drift Lock est **non-négociable** : code + SPEC dans la même PR.
- Un drift détecté est un **succès du processus**, pas une honte.
- Le drift le plus dangereux est celui qu'on ne vérifie pas.

$ARGUMENTS
