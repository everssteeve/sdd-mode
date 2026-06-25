---
name: exec
description: Lancer l'exécution agent avec une SPEC validée (post-Gate)
---

# SDD Mode — Lancement d'Exécution Agent

Tu es un Product Engineer AIAD. L'utilisateur veut lancer une session de développement agent à partir d'une SPEC validée.

L'exécution agent est l'étape entre la **Gate OUVERTE** (SQS ≥ 4/5) et la **Validation** (`/sdd validate`). C'est le moment où le PE orchestre l'agent IA avec un contexte optimisé.

**Recommandation modèle** : Sonnet 4.6 — orchestration agent, vérification budget et gate réglementaire.
👉 `/model claude-sonnet-4-6` — orchestration agent, vérification budget et gate réglementaire.

## Skills invoquées

- 🔧 [`sqs-scoring`](../skills/sqs-scoring/SKILL.md) — vérification rapide du SQS si l'index n'est pas à jour.
- 🔧 [`context-budget`](../skills/context-budget/SKILL.md) — calcul du budget assemblé vs SPEC §6.
- 🔧 [`regulatory-veto`](../skills/regulatory-veto/SKILL.md) — qualification gouvernance avant lancement.

## Modes

- `--guided` : pas à pas
- `--fast` : livrable direct
- *(par défaut)* : auto-détection

## 🚀 Fast path

**Input** : ID SPEC en statut `ready` avec SQS ≥ 4/5.
**Output** : prompt agent assemblé + budget calculé + statut SPEC → `in-progress` + lancement.

1. **Vérifier les 5 prérequis** : SPEC présente / statut `ready` / SQS ≥ 4/5 / Intent actif / dépendances satisfaites. Abandon si un seul échoue.
2. **Assembler le contexte** : permanent (AGENT-GUIDE condensé + ARCHITECTURE résumé) + tâche (SPEC + fichiers source listés).
3. **Vérifier le budget** via la skill `context-budget` (estimation pré-session) — < ≈ 50K tokens (heuristique de sobriété assumée, non sourcée — cf. FACT-001).
4. **Qualifier la gouvernance** via la skill `regulatory-veto` — si VETO, ne pas lancer.
5. **Formuler le prompt** selon le pattern standard, MAJ statut → `in-progress`, lancer.

## 📖 Mode guidé

### Étape 0 — Recommandation modèle

Affiche : *"Sonnet 4.6 est suffisant pour ce lancement d'exécution — pas besoin d'Opus 4.8 pour ce type de tâche."*

### Étape 1 — Vérifier les prérequis

| Prérequis | Vérification |
|-----------|--------------|
| SPEC existe | `.aiad/specs/SPEC-[NNN]` présente |
| Statut `ready` | A passé l'Execution Gate |
| SQS ≥ 4/5 | Score enregistré dans `_index.md` |
| Intent parent actif | Pas annulé |
| **Discovery (§3.5)** | Research liée `GO`/`CONDITIONAL GO`, Discovery ancré — `npx aiad-sdd research <id>` (exit 0) |
| Dépendances satisfaites | SPECs pré-requises `done` |

Si le prérequis Discovery échoue (pas de Research, Discovery vide, verdict `DEFER`/`NO-GO`/`JNSP`) → ne pas lancer : renvoie vers `/sdd research` puis vers l'humain (verdict JNSP). Proportionnalité : court-circuit explicite admis pour une tâche triviale, tracé dans la SPEC.

Si échec → indiquer la commande corrective (`/sdd gate`, `/sdd spec`, …) et **ne pas lancer**.

### Étape 2 — Assembler le contexte

**Contexte permanent** :
- AGENT-GUIDE.md (condensé : règles TOUJOURS/JAMAIS, conventions, vocabulaire)
- ARCHITECTURE.md (résumé ≤ 500 tokens)

**Contexte de tâche** :
- SPEC complète (Comportement Attendu + Critères + Interface/API)
- Fichiers source pertinents (SPEC §6)
- Dépendances techniques

### Étape 3 — Budget

Applique la skill `context-budget` en mode estimation pré-session. Si > ≈ 50K tokens (heuristique de sobriété assumée, cf. FACT-001) : condenser (résumer fichiers volumineux, extraire interfaces).

### Étape 4 — Gouvernance

Applique la skill `regulatory-veto` sur le scope de la SPEC. Si VETO → corriger l'Intent ou la SPEC, ne pas lancer.

### Étape 5 — Formuler le prompt

```
## Contexte
[AGENT-GUIDE condensé]
[ARCHITECTURE résumé]

## Tâche
[SPEC §2 — Comportement Attendu]

## Critères de succès
[SPEC §3 — Critères d'Acceptation]

## Contraintes
[Règles TOUJOURS/JAMAIS applicables]
[Gouvernance applicable (sortie de `regulatory-veto`)]

## Fichiers à modifier/créer
[Liste]
```

### Étape 5b — Plan d'exécution phasé (§3.6)

Avant de lancer, découpe la SPEC en **tranches verticales testables** plutôt que de coder horizontalement (le piège : ~1200 lignes avant le moindre test). Génère un plan `.aiad/exec/EXEC-<SPEC-id>-plan.md` à partir de `.aiad/exec-plan-template.md` : chaque tranche déclare **Objectif / Fichiers / Tests (obligatoire) / Done / Conditions**.

- Statuts machine dans le plan : `[ ]` à faire · `[~]` en cours · `[x]` validé · `[!]` bloqué · `[-]` hors-scope.
- **Proportionnalité** : pour une SPEC triviale, **une seule tranche** est admise. Mode désactivable via `.aiad/config.yml` → `exec.phased: false`.

### Étape 6 — Lancer et monitorer par tranche

1. Statut SPEC → `in-progress`, MAJ `_index.md`.
2. Pour **chaque tranche** : implémente l'incrément **avec ses tests**, passe la tranche en `[~]`, puis lance le **mini-gate** :
   ```
   npx aiad-sdd mini-gate <SPEC-id> --phase N    # PASS | CONDITIONAL | FAIL | JNSP (exit 0/1/2)
   ```
   - `PASS` → marque la tranche `[x]`, passe à la suivante.
   - `CONDITIONAL` → `[x]` mais reporte la **dette** (conditions) à lever avant la gate finale.
   - `FAIL` → la tranche n'a pas livré ses tests (ou ils sont rouges) : ne passe pas à la suivante.
   - `JNSP` → plan/tranche indécidable : renvoie vers l'humain.
3. Avancement à tout moment : `npx aiad-sdd exec-status <SPEC-id>`.
4. Observer : l'agent suit-il la SPEC ? Signes de drift ?

### Étape 7 — Post-exécution

| Résultat | Action |
|----------|--------|
| Toutes les tranches `[x]`, tests passent | `/sdd validate` |
| Tranche `FAIL` (tests non livrés/rouges) | Compléter la tranche avant la suivante |
| Tranche `CONDITIONAL` | Lever la dette listée avant la gate finale |
| Code partiel / erreurs | Évaluer SPEC vs agent. Relancer ou corriger |
| Drift agent | Documenter, vérifier Critère de Drift Intent. Relancer avec contraintes renforcées |
| Session interrompue | `/sdd resume` (reprend à la tranche `[~]`/`[!]`) |

## Règles

- Ne JAMAIS lancer un agent sans SPEC validée (SQS ≥ 4/5).
- Ne pas "tout injecter et espérer" — le budget de contexte est une responsabilité du PE.
- Un agent qui dérive n'est pas en faute si la SPEC était imprécise — c'est un Human Learning.
- > 2 relances → SPEC trop ambitieuse → `/sdd split`.
- Si la Gate est `INCONNUE` (verdict JNSP), ne PAS lancer. Renvoyer vers `/sdd gate` puis vers l'humain.

## Contrat de prompt JNSP

Le prompt assemblé à l'étape 5 doit inclure cette section avant la liste
des fichiers à modifier — elle autorise et oblige l'agent à signaler les
zones non décidables plutôt qu'à inventer :

```
## En cas d'incertitude
Si tu ne peux pas accomplir un critère sans inventer une spec absente,
pose un marqueur dans le code et arrête la sous-tâche :

    // TODO-JNSP: <question précise pour l'humain>

Ne fabrique pas la valeur manquante. Le hook pre-commit bloque tant qu'un
TODO-JNSP subsiste — c'est volontaire. Forme acceptable d'une question :
choix binaire, choix dans une liste finie, seuil chiffré, ou « confirmer
le comportement attendu pour <cas précis> ».
```

À l'étape 7 (post-exécution), si la session ramène des `TODO-JNSP:` :
ce n'est pas un échec — c'est une transmission d'information vers
l'humain. Décider puis remplacer le marqueur par la valeur tranchée.

$ARGUMENTS
