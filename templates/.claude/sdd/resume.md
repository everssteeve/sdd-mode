---
name: resume
description: Reprendre une session agent interrompue sans perdre le travail déjà fait
---

# SDD Mode — Reprise de Session Agent

Tu es un Product Engineer AIAD. L'utilisateur veut reprendre une session agent interrompue (timeout, erreur, limite de conversation, volontaire).

Les sessions agent sont interrompues en pratique. Le risque : recommencer de zéro, ou pire, produire des incohérences. Cette commande reconstruit le contexte minimal nécessaire.

**Recommandation modèle** : Haiku 4.5 — reconstruction de contexte minimal, tâche mécanique.
👉 `/model claude-haiku-4-5-20251001` — reconstruction de contexte minimal, tâche mécanique.

## Skills invoquées

- 🔧 [`context-budget`](../skills/context-budget/SKILL.md) — assemble le contexte minimal et calcule l'écart vs session précédente.
- 🔧 [`drift-detection`](../skills/drift-detection/SKILL.md) — vérifie la cohérence ancien ↔ nouveau code après reprise.

## Modes

- `--guided` : pas à pas
- `--fast` : prompt de reprise direct
- *(par défaut)* : auto-détection

## 🚀 Fast path

**Input** : SPEC-NNN interrompue + cause (timeout / erreur / limite / volontaire).
**Output** : résumé d'état structuré + prompt de reprise minimal.

1. `git status` + `git diff` pour inventorier le travail fait vs critères non couverts.
2. Reconstruis le contexte minimal via la skill `context-budget` (mode "session reprise").
3. Formule le prompt de reprise et relance.
4. Après reprise, applique la skill `drift-detection` pour vérifier la cohérence.

## 📖 Mode guidé

### Étape 1 — Diagnostiquer l'état

| Élément | État |
|---------|------|
| SPEC en cours | SPEC-[NNN] — `in-progress` |
| Cause d'interruption | Timeout / Erreur / Limite / Volontaire |
| Code déjà produit | OUI / NON — fichiers modifiés |
| Tests existants | passent ? |
| Dernière action réussie | [description] |

### Étape 1a — Lire l'état réel du cycle (graphe §3.9)

Si un graphe de cycle existe (`.aiad/cycle/INTENT-NNN.json`), ne devine pas l'avancement : lis-le. Il est **crash-recoverable** — il survit à la mort de la session.

```bash
npx aiad-sdd cycle show INTENT-NNN     # graphe complet [x]/[~]/[ ]/[!]
npx aiad-sdd cycle next INTENT-NNN     # première étape actionnable (ou la bloquée + sa raison)
```

Reprends à l'étape signalée par `cycle next` : si elle est `blocked`, traite d'abord sa raison (verdict FAIL/JNSP) avant de relancer.

### Étape 1b — Reprendre à la bonne tranche (si plan phasé §3.6)

Si un plan d'exécution phasé existe (`.aiad/exec/EXEC-<SPEC-id>-plan.md`), n'inventorie pas tout à la main : demande la prochaine tranche au plan.

```bash
npx aiad-sdd exec-status <SPEC-id>     # avancement + prochaine tranche [~]/[!]/[ ]
```

La reprise repart à la tranche **en cours `[~]`** (sinon la première **bloquée `[!]`**, sinon la première **à faire `[ ]`**). Re-valide cette tranche avec `npx aiad-sdd mini-gate <SPEC-id> --phase N` avant de poursuivre. Une tranche `[!]` bloquée signale une décision en attente — souvent un `JNSP` à trancher d'abord.

### Étape 2 — Inventorier le travail fait

```bash
git status
git diff
git log --oneline -10
```

```
ÉTAT DE LA SESSION — SPEC-NNN
══════════════════════════════
Fichiers créés    : [liste]
Fichiers modifiés : [liste]
Tests ajoutés     : X (Y passent, Z échouent)
Critères complétés : X/Y

Travail restant :
- [ ] [Critère non couvert]
```

### Étape 3 — Reconstruire le contexte minimal

Applique la skill `context-budget` en mode reprise. **Toujours inclure** :
- AGENT-GUIDE (condensé)
- SPEC complète
- Résumé d'état (étape 2)

**Inclure si pertinent** : fichiers modifiés, erreurs en cours, messages d'erreur.
**Ne PAS inclure** : contexte précédent en entier, fichiers déjà traités, ARCHITECTURE complète.

### Étape 4 — Prompt de reprise

```
## Contexte de reprise
Tu reprends une tâche en cours.

## SPEC en cours
[SPEC complète]

## Travail déjà réalisé
[Résumé étape 2 + diff si nécessaire]

## Ce qui reste à faire
[Critères non complétés]

## Erreurs en cours (le cas échéant)
[Messages / tests en échec]

## Contraintes
[Règles TOUJOURS/JAMAIS]
Ne PAS modifier les parties validées sauf si nécessaire pour la cohérence.
```

### Étape 5 — Relancer et vérifier

1. Relancer l'agent
2. Applique la skill `drift-detection` pour vérifier la cohérence ancien ↔ nouveau
3. Exécuter tous les tests (pas seulement les nouveaux)
4. Si succès → `/sdd validate`
5. Si échec récurrent → `/sdd split`

## Règles

- La reprise est NORMALE — ne pas recommencer de zéro par défaut.
- Le contexte de reprise doit être **plus léger** que le contexte initial.
- Si reprise échoue 2 fois → SPEC trop grosse → `/sdd split`.
- Documenter la cause d'interruption pour `/sdd context`.
- Si l'état précédent n'est pas reconstructible à 100 % → `JNSP`, demander un récap humain (ne pas relancer en aveugle).

## Verdict JNSP (état non reconstructible)

La reprise ne doit pas démarrer si :

- Les fichiers modifiés citent une SPEC qui n'existe **plus** ou a été
  renommée → tu ne peux pas reconstruire l'intention de la session.
- `git status` montre des modifs locales non documentées dans la SPEC
  active, **et** la session précédente n'a laissé ni log ni résumé.
- Le code contient déjà des `TODO-JNSP:` non résolus de la session
  précédente — c'est la décision humaine qui débloque, pas l'agent.

Forme attendue :

```
JNSP — Reprise impossible sans récap humain
Ce qui est reconstruit : <fichiers + SPEC reliés>
Ce qui manque : <décisions précédentes non retrouvables>
Question à l'humain : <reformulation actionnable>
```

Ne PAS relancer l'agent dans cet état — proposer plutôt `/sdd context`
pour auditer le budget et clarifier l'état avec l'humain.

$ARGUMENTS
