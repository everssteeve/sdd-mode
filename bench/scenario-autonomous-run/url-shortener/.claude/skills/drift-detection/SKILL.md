---
name: drift-detection
description: Use when checking that code changes are synchronised with their SPEC (Drift Lock). Cross-references modified files against active SPECs and emits an OK/DRIFT verdict. Triggered by /sdd drift-check, /sdd validate, /sdd audit, pre-commit hook.
---

# Skill — Drift Detection (Drift Lock)

> Le **Spec Drift** — code qui évolue sans que la SPEC suive — est le risque #1 du dev avec agents IA.
> Cette skill détecte le drift de manière homogène et bloque tout merge en état de drift.

## Quand l'utiliser

- Avant un merge (`/sdd drift-check`, hook pre-commit)
- Après une exécution agent (`/sdd validate`, `/sdd exec` post-mortem)
- Pendant un audit qualité (`/sdd audit`)
- Lors d'une reprise de session pour vérifier la cohérence (`/sdd resume`)

## Procédure

### Étape 1 — Inventorier les changements

```bash
git status               # fichiers non commités
git diff                 # diff complet
git log --oneline -10    # commits récents
```

### Étape 2 — Croiser avec les SPECs actives

Pour chaque SPEC en statut `in-progress` ou `validation` (lire `.aiad/specs/_index.md`) :

| SPEC | Fichiers code attendus | Modifiés ? | SPEC mise à jour ? | Verdict |
|------|------------------------|-----------|--------------------|---------|
| SPEC-NNN | [liste depuis SPEC §6] | OUI/NON | OUI/NON | OK / DRIFT |

### Étape 3 — Détecter les types de drift

| Type | Signal |
|------|--------|
| **code-ahead-of-spec** | Code modifié, SPEC non mise à jour |
| **spec-ahead-of-code** | SPEC modifiée, code non aligné |
| **orphan-change** | Modification code sans SPEC référente |
| **architecture-drift** | Convention AGENT-GUIDE violée par le nouveau code |

### Étape 4 — Vérifier les artefacts globaux (si pertinent)

| Artefact | Cohérent avec le code ? |
|----------|------------------------|
| PRD.md | OUI / À VÉRIFIER |
| ARCHITECTURE.md | OUI / À VÉRIFIER |
| AGENT-GUIDE.md | OUI / À VÉRIFIER |

### Étape 5 — Croiser avec la matrice machine-vérifiable

Depuis la v1.10, déléguer à la skill [`traceability`](../traceability/SKILL.md) la mesure des annotations `@intent` / `@spec` / `@verified-by` / `@governance`. Un gap bloquant (SPEC validée sans code, SPEC orpheline référencée dans le code) = **DRIFT** même si l'heuristique git de l'étape 1 dit OK.

```bash
npx aiad-sdd trace --fail-on-gap   # exit 1 si gap bloquant
```

## Output

```
DRIFT REPORT — branche: <branch>
═══════════════════════════════
Fichiers modifiés : <X>
SPECs actives    : <list>

| SPEC      | Fichiers     | Code MAJ | SPEC MAJ | Verdict       |
|-----------|--------------|----------|----------|---------------|
| SPEC-NNN  | [...]        | OUI      | NON      | DRIFT         |
| SPEC-MMM  | [...]        | ?        | ?        | INCONNU (JNSP)|

Verdict global : OK / DRIFT / INCONNU

Si DRIFT :
- Type           : code-ahead-of-spec | spec-ahead-of-code | orphan-change | architecture-drift
- Action requise : (a) mettre à jour la SPEC pour refléter le code livré
                   (b) corriger le code pour respecter la SPEC
                   ⚠ NE JAMAIS merger en état de drift.

Si INCONNU :
- Motif          : <annotations absentes | fichier illisible | SPEC manquante>
- Action humaine : <ce qu'il faut clarifier avant de re-scanner>
```

## Verdict INCONNU (JNSP) — fail-closed

Quand la skill **ne peut pas conclure** OK ni DRIFT, le verdict est
`INCONNU`, **jamais OK par défaut**. Déclencheurs :

- Au moins un fichier code applicatif modifié sans `@spec` exploitable.
- `@spec SPEC-NNN-N-…` du code pointe vers une SPEC absente de
  `.aiad/specs/` (orphan inversé).
- `aiad-sdd trace --fail-on-gap` plante sur un fichier illisible
  (permissions, binaire, déplacement non commit).
- L'index `.aiad/specs/_index.md` est manquant ou corrompu.

`INCONNU` est traité **comme un DRIFT** par le hook pre-commit et la CI
(exit ≠ 0) — il bloque tout merge tant que la question n'est pas tranchée.

## Règles

- Le **Drift Lock** est non-négociable : code + SPEC dans la même PR.
- Un drift détecté est un **succès du processus**, pas un échec.
- La SPEC est modifiable — si le code révèle une meilleure approche, mettre à jour la SPEC plutôt que de revenir en arrière.
- Le drift le plus dangereux est celui qu'on ne vérifie pas.
- Si aucun drift : mettre à jour `CHANGELOG-ARTEFACTS.md` et le statut de la SPEC.
- Absence de preuve de drift ≠ preuve d'absence de drift — sortir INCONNU plutôt qu'OK quand les annotations manquent.
