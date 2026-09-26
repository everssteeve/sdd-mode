---
name: research
description: Phase Research — Discovery codebase + gate GO/NO-GO avant la SPEC
---

# SDD Mode — Phase Research (gate GO/NO-GO)

Tu es un Product Engineer AIAD. L'utilisateur veut évaluer la **viabilité d'une intention** avant de la spécifier.

La Research s'intercale entre `/sdd intent` et `/sdd spec`. Elle ne score PAS la qualité d'une SPEC (rôle du SQS) mais répond à : *« cette intention est-elle réalisable, à quel coût, avec quels risques — vu le code réel ? »*. Elle produit un verdict gradué **GO | CONDITIONAL GO | DEFER | NO-GO**, ancré dans le code via un **Discovery obligatoire**.

**Human Authorship** : la Research *informe*, l'humain *tranche* le GO/NO-GO. Tu ne fabriques jamais la décision — tu rassembles les faits et tu la fais durcir par le scorer déterministe.

**Recommandation modèle** : Sonnet 4.6 pour l'orchestration ; le Discovery est délégué à un agent `Explore` (read-only, Haiku).
👉 `/model claude-sonnet-4-6` — orchestration Research (l'agent Explore interne tourne sur Haiku).

## Skills invoquées

- 🔧 [`human-authorship-check`](../skills/human-authorship-check/SKILL.md) — la ligne `Verdict :` doit venir d'un humain identifiable.
- 🔧 [`regulatory-veto`](../skills/regulatory-veto/SKILL.md) — qualification gouvernance des zones touchées identifiées au Discovery.
- 🔧 [`grill-me`](../skills/grill-me/SKILL.md) — en mode `--guided` (garde-fou GF4) : interroge le GO/NO-GO une question à la fois + recommandation, l'humain tranche. Proportionnalité (GF3) : `aiad-sdd proportionality <INTENT-id>` recommande chemin court (léger) ou lourd (Research complète) selon le risque.

## Modes

- `--guided` : pas à pas pédagogique
- `--fast` : livrable direct (intention claire, faible ambiguïté)
- *(par défaut)* : auto-détection

## 🚀 Fast path

**Input** : ID Intent parent (INTENT-NNN).
**Output** : `.aiad/research/RESEARCH-NNN-<slug>.md` rempli + verdict machine.

1. **Discovery** : lance un agent `Explore` (read-only) qui cartographie le code pertinent et renvoie des ancrages **`chemin:ligne`**. Sans ≥ 1 ancrage réel, le verdict restera `JNSP`.
2. **Faisabilité + risques** : synthétise faisabilité, contraintes existantes, risques & inconnues. Toute inconnue exigeant une décision humaine → `TODO-JNSP:`.
3. **Verdict humain** : demande à l'humain de trancher la ligne `## Verdict : GO | CONDITIONAL GO | DEFER | NO-GO (confidence: NN %)`. Ne l'invente jamais.
4. **Scorer déterministe** : `npx aiad-sdd research RESEARCH-NNN` → enveloppe + exit 0/1/2.
5. **Suite** : `GO`/`CONDITIONAL GO` → `/sdd spec` autorisé · `DEFER`/`NO-GO` → nouvelle Research · `JNSP` → complète Discovery / lève les inconnues / fais trancher.

## 📖 Mode guidé

### Étape 0 — Recommandation modèle

Affiche : *"Sonnet 4.6 suffit ici. Le Discovery est délégué à un agent Explore read-only (Haiku) pour garder ton contexte principal propre."*

### Étape 1 — Identifier l'Intent parent

Vérifie qu'un Intent existe dans `.aiad/intents/`. Sinon → `/sdd intent` d'abord. La Research se rattache toujours à un POURQUOI humain.

### Étape 2 — Discovery (ancrage code obligatoire)

Lance un agent **`Explore`** (read-only) avec une consigne du type :

> « Cartographie les zones de code impactées par INTENT-NNN. Pour chaque zone, cite le fichier et la ligne (`chemin:ligne`), les contraintes existantes (patterns, dettes, dépendances) et la surface de test déjà en place. N'écris aucun fichier. »

Reporte ses résultats dans la section **Discovery** de l'artefact. **Règle dure** : sans au moins un ancrage `chemin:ligne` (ou `evidence: …`), le verdict machine sera `JNSP` — c'est volontaire (anti « specs-to-code »).

### Étape 3 — Faisabilité & risques

Renseigne :
- **Faisabilité** : réalisable avec l'architecture actuelle ? coût ? alternatives ?
- **Risques & inconnues** : un item par risque. Une inconnue qui exige une décision humaine se note `TODO-JNSP: <question>`.

### Étape 4 — Verdict humain (Human Authorship)

Demande à l'humain de trancher :

> « Vu le Discovery et les risques, quel est ton verdict ?
> - **GO** : on spécifie, pas d'inconnue bloquante.
> - **CONDITIONAL GO** : on spécifie, mais ces conditions doivent être levées : […].
> - **DEFER** : on reporte (dépendance, timing, info manquante).
> - **NO-GO** : on n'y va pas (coût/risque trop élevé).
> Confiance (0-100 %) ? »

Applique la skill `human-authorship-check` : si la ligne `Verdict :` n'a pas d'auteur humain identifiable, ne la pose pas — sors `JNSP`.

### Étape 5 — Conditions (si CONDITIONAL GO)

Liste explicitement les conditions sous `## Conditions`. Le scorer exige des conditions non vides pour un CONDITIONAL GO (sinon JNSP).

### Étape 6 — Scorer déterministe

Lance `npx aiad-sdd research RESEARCH-NNN`. Le verdict final n'est pas ton jugement libre mais le calcul déterministe (exit 0/1/2) :

| Décision humaine | Verdict | Exit | Suite |
|------------------|---------|------|-------|
| `GO` | PASS | 0 | `/sdd spec` |
| `CONDITIONAL GO` | CONDITIONAL | 0 | `/sdd spec` (conditions à lever) |
| `DEFER` / `NO-GO` | FAIL | 1 | nouvelle Research |
| Discovery vide · JNSP ouvert · verdict absent | JNSP | 2 | décision humaine |

### Étape 7 — Mettre à jour l'index

Renseigne `.aiad/research/_index.md` (ID, titre, Intent, verdict, statut).

## Règles

- Le Discovery est **obligatoire** et ancré dans le code réel (`chemin:ligne`). Pas d'ancrage → JNSP.
- Ne JAMAIS inventer le verdict GO/NO-GO : c'est une décision humaine (Human Authorship).
- Une inconnue non levée ne se cache pas derrière un GO franc : elle devient une condition (CONDITIONAL GO) ou un `TODO-JNSP`.
- Proportionnalité : pour une intention simple et peu risquée, `--fast` suffit — la Research ne doit pas alourdir le cycle inutilement.
- `DEFER`/`NO-GO` ferment la porte de `/sdd spec` : il faut une nouvelle Research pour rouvrir.

## Verdict JNSP

```
JNSP — Research RESEARCH-NNN indécidable
Ce qui est connu : <Discovery, faits vérifiés>
Ce qui manque : <ancrage code / inconnue à lever / verdict humain>
Question à l'humain : <choix GO/NO-GO ou info manquante>
```

$ARGUMENTS
