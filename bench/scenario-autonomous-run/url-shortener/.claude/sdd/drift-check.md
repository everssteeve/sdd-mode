---
name: drift-check
description: Vérifier la synchronisation artefacts/code (Drift Lock)
---

# SDD Mode — Anti-Drift Check

Tu es un Product Engineer AIAD. L'utilisateur veut vérifier la synchronisation entre artefacts et code (Drift Lock).

Le **Spec Drift** — code qui évolue sans que les artefacts suivent — est le risque #1 du dev avec agents IA. SDD Mode le traite comme un **échec de processus**. Le Drift Lock exige que code ET SPEC soient synchronisés dans la même PR.

Depuis la v1.10, le Drift Lock combine deux contrôles :
1. **Heuristique git** (skill `drift-detection`) — code modifié sans SPEC mise à jour dans la même PR.
2. **Mesure machine-vérifiable** (skill `traceability`) — annotations `@intent` / `@spec` / `@verified-by` / `@governance` cohérentes avec `.aiad/intents/` et `.aiad/specs/`.

## Skills invoquées

- 🔧 [`drift-detection`](../skills/drift-detection/SKILL.md) — détection homogène, output structuré.
- 🔧 [`traceability`](../skills/traceability/SKILL.md) — matrice machine-vérifiable + détection des gaps bloquants.

## Modes

- `--guided` : pas à pas
- `--fast` : verdict direct
- *(par défaut)* : auto-détection

## 🚀 Fast path

**Input** : PR / branche à vérifier (ou SPEC-NNN active par défaut).
**Output** : verdict OK / DRIFT + MAJ `_index.md` + entrée `CHANGELOG-ARTEFACTS.md`.

1. Applique la skill `drift-detection`.
2. Lance `npx aiad-sdd trace --fail-on-gap` (skill `traceability`) — un gap bloquant = DRIFT.
3. Si **OK** → MAJ `CHANGELOG-ARTEFACTS.md` + statut SPEC → `done` + `.aiad/specs/_index.md`.
4. Si **DRIFT** → présenter les écarts précis (drift-detection ET traceability) + proposer MAJ SPEC OU corrections code OU ajout d'annotation. **Ne jamais merger en état de drift**.

## 📖 Mode guidé

### Étape 1 — Détection git

Applique la skill `drift-detection`. Sortie attendue : verdict OK/DRIFT par SPEC + type de drift (code-ahead / spec-ahead / orphan / architecture).

### Étape 2 — Détection traceability

Applique la skill `traceability` (`npx aiad-sdd trace`). Vérifie :
- aucun **SPEC orphelin** (référencé par le code mais absent des artefacts)
- aucun **Intent orphelin**
- aucune **SPEC validée non-implémentée**

Si l'un de ces gaps est présent → DRIFT, même si l'heuristique git de l'étape 1 dit OK.

### Étape 3 — Mise à jour des index

Si OK :
- MAJ `.aiad/specs/_index.md` (statut, PR)
- MAJ Intent Statement parent si toutes les SPECs liées sont `done`
- Entrée dans `CHANGELOG-ARTEFACTS.md`
- Snapshot `.aiad/metrics/traceability/trace.{md,json}` régénéré

Si DRIFT :
- Lister précisément les écarts (étape 1 et étape 2)
- Proposer (a) MAJ SPEC pour refléter le code OU (b) correction code pour respecter la SPEC OU (c) ajout d'annotation manquante
- Le hook pre-commit (`hook-bypass.yml`) bloquera de toute façon

### Étape 4 — Verdict INCONNU (JNSP)

Quand les annotations `@spec` sont absentes ou partiellement absentes du
code applicatif, la skill `drift-detection` **ne peut pas conclure** « pas
de drift ». Verdict obligatoire : `INCONNU` (jamais OK par défaut).

Déclencheurs :

- Au moins un fichier de code applicatif modifié sans annotation `@spec`.
- Annotation `@spec SPEC-NNN-N-slug` qui ne correspond à aucune SPEC
  existante dans `.aiad/specs/` (orphan inversé).
- `aiad-sdd trace --fail-on-gap` retourne en erreur sur un fichier que
  tu n'as pas pu lire (permissions, binaire, fichier déplacé).

Forme attendue :

```
Verdict : INCONNU (JNSP)
Ce qui est mesuré : <fichiers vérifiés et leurs annotations>
Ce qui manque : <fichier(s) sans @spec ou annotation orpheline>
Action humaine : ajouter l'annotation, créer la SPEC manquante,
                 ou whitelist explicite dans .aiad/hook-bypass.yml
```

Le verdict `INCONNU` est traité comme un `DRIFT` par les hooks pre-commit
et la CI (fail-closed) — il ne dégrade jamais en OK silencieux.

## Règles

- Le Drift Lock est **non-négociable** : code + SPEC dans la même PR.
- Un drift détecté est un **succès du processus**, pas une honte.
- Le drift le plus dangereux est celui qu'on ne vérifie pas.
- En CI, la matrice de traçabilité est l'arbitre final : `aiad-sdd trace --fail-on-gap` doit passer.
- Absence de preuve de drift ≠ preuve d'absence de drift. Si annotations absentes → INCONNU, pas OK.

$ARGUMENTS
