---
name: trace
description: Générer la matrice de traçabilité Intent ↔ SPEC ↔ Code ↔ Tests (annotations machine-vérifiables)
---

# SDD Mode — Traçabilité machine-vérifiable

Tu es un Product Engineer AIAD. L'utilisateur veut générer la matrice de traçabilité du projet à partir des annotations dans le code.

Évolution #6 du framework : transformer le Drift Lock du **rituel humain** à la **mesure algorithmique**. La traçabilité bout-en-bout devient une propriété mesurable, pas un acte de foi.

## Skills invoquées

- 🔧 [`traceability`](../skills/traceability/SKILL.md) — convention d'annotations + procédure de scan + heuristiques de gap.

## Convention d'annotations (rappel)

Quatre tags reconnus dans JSDoc / docstring / commentaires :

```
@intent       INTENT-042
@spec         SPEC-042-1-flow-auth
@verified-by  tests/auth/oidc.test.ts
@governance   AIAD-RGPD,AIAD-AI-ACT
```

## Modes

- `--guided` : pas à pas pédagogique
- `--fast` : verdict direct + fichiers générés
- *(par défaut)* : auto-détection

## 🚀 Fast path

**Input** : périmètre (par défaut : tout le repo).
**Output** : `.aiad/metrics/traceability/trace.{md,json,html}` + verdict OK / GAP.

1. Lance `npx aiad-sdd trace` (ou `node node_modules/aiad-sdd/bin/aiad-sdd.js trace`) à la racine du projet.
2. Lis le résumé renvoyé : nombre d'Intents, SPECs, fichiers code annotés, tests annotés, gaps.
3. Si gaps détectés → applique la skill `traceability` pour les classer (orphelins / non-implémentés / non-tracés) et propose un plan de remédiation.
4. Si OK → mets à jour `CHANGELOG-ARTEFACTS.md` (`trace: snapshot YYYY-MM-DD — N intents / M specs / 100% code annoté`).

## 📖 Mode guidé

### Étape 1 — Vérifier la convention d'annotations

Demande à l'utilisateur s'il connaît la convention `@intent` / `@spec` / `@verified-by` / `@governance`. Si non, montre la skill `traceability` puis 2-3 exemples concrets sur le projet (un fichier JS/TS et un fichier Python si présent).

### Étape 2 — Lancer le scan

```bash
npx aiad-sdd trace
# ou pour un format spécifique :
npx aiad-sdd trace --format md,json
# pour la sortie JSON brute (CI) :
npx aiad-sdd trace --json
```

### Étape 3 — Lire les matrices

- **Forward** (Intent → SPEC → Code → Tests) : verifie que **chaque Intent actif a au moins une SPEC** et que **chaque SPEC ready/in-progress/validation/done a du code annoté**.
- **Backward** (Tests → Code → SPEC → Intent) : vérifie qu'**aucun test n'est orphelin** (un test sans `@spec` ni `@verified-by` est suspect).

### Étape 4 — Classer les gaps

Sortie de la skill `traceability` :

| Gap | Signification | Priorité |
|-----|---------------|----------|
| Intents sans SPEC | Intent active déclarée mais aucune SPEC liée | Haute |
| SPECs validées sans code | SPEC `ready/in-progress/done` mais aucun fichier annoté | **Bloquante** |
| SPECs/Intents orphelins dans le code | Code référence un ID inexistant | **Bloquante** |
| Code sans `@spec` | Fichier code non tracé | Moyenne (selon périmètre) |
| Code annoté sans tests | Pas de `@verified-by` ni de test annoté `@spec SPEC-...` | Haute |

### Étape 5 — Plan de remédiation

Pour chaque gap :
- **Orphelin / non-implémenté** → `/sdd spec` ou créer le fichier code et l'annoter.
- **Non-tracé** → ajouter `@spec` dans la JSDoc/docstring ou whitelister explicitement (rare — chaque exception affaiblit la traçabilité).
- **Test sans `@spec`** → ajouter l'annotation côté test ou ajouter `@verified-by tests/…` côté code.

## Règles

- La traçabilité **machine-vérifiable** est l'invariant central de SDD Mode v1.10+.
- Un gap non motivé = drift latent → traiter avant la prochaine PR.
- Le hook pre-commit + `/sdd drift-check` invoquent automatiquement la matrice ; ne pas la duplique manuellement.
- Persister le snapshot dans `.aiad/metrics/traceability/` permet la mesure dans le temps (cf. critère d'adoption Évolution #6).

$ARGUMENTS
