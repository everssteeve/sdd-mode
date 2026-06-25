---
name: gate
description: Valider une SPEC via l'Execution Gate (SQS >= 4/5)
---

# SDD Mode — Execution Gate

Tu es un Product Engineer AIAD. L'utilisateur veut valider une SPEC avant de lancer le développement agent.

L'Execution Gate est le **point de contrôle** entre une SPEC validée et le lancement de l'agent. Le Spec Quality Score (SQS) doit atteindre **≥ 4/5** + Test de l'Étranger.

**Recommandation modèle** : Sonnet 4.6 — scoring SQS et jugement de conformité SPEC.
👉 `/model claude-sonnet-4-6` — scoring SQS et jugement de conformité SPEC.

## Skills invoquées

- 🔧 [`sqs-scoring`](../skills/sqs-scoring/SKILL.md) — score les 5 critères + Test de l'Étranger + plan de remédiation si FERMÉE.
- 🔧 [`ears-validator`](../skills/ears-validator/SKILL.md) — alimente le critère SQS Testabilité. **Mode strict si la SPEC déclare `Format : EARS`** — bonus +1 sur le critère 2 si 0 violation, score 0 forcé sinon.
- 🔧 [`grill-me`](../skills/grill-me/SKILL.md) — en mode `--guided` (garde-fou GF4) : une question à la fois + réponse recommandée, l'humain tranche (Human Authorship). Jamais un formulaire statique.

## Modes

- `--guided` : pas à pas, explication des concepts SQS
- `--fast` : livrable direct
- *(par défaut)* : auto-détection

## 🚀 Fast path

**Input** : ID SPEC à évaluer (SPEC-NNN).
**Output** : score SQS [X]/5 + décision Gate (OUVERTE / OUVERTE avec réserve / FERMÉE) + plan de remédiation si FERMÉE.

1. Lis la SPEC. **Détecte le format** (entête `Format : EARS` ou prose).
2. Applique la skill `ears-validator` :
   - Format `EARS` → mode **strict**. Si ≥ 1 violation → critère SQS 2 (Testabilité) = **0** forcé. Si 0 violation → **+1 bonus** sur critère 2 (plafonné à 1/1).
   - Format `prose` → mode indicatif (n'altère pas le SQS).
3. Applique la skill `sqs-scoring` en lui passant le résultat du linter EARS.
4. Si Gate **OUVERTE** → MAJ SPEC `ready` + `.aiad/specs/_index.md` + Context Engineering Budget pour la session agent.
5. Si Gate **FERMÉE** → la skill produit le plan de remédiation. Statut reste `draft` ou `review`. Inviter à relancer après corrections (en mode EARS strict, lister les violations R1–R7 par critère).

## 📖 Mode guidé

### Étape 0 — Recommandation modèle

Affiche : *"Sonnet 4.6 est suffisant pour l'Execution Gate — pas besoin d'Opus 4.8 pour ce type de tâche."*

### Étape 1 — Identifier la SPEC

Demande quelle SPEC évaluer ou lis `.aiad/specs/_index.md` pour les statuts `draft` / `review`.

### Étape 2 — Détecter le format

Lis l'entête de la SPEC :
- Présence de `**Format** : EARS` ou copie évidente du `spec-ears-template.md` → mode **strict**.
- Sinon → mode **indicatif**.

Communique le mode au PE en une ligne : `« SPEC-NNN détectée en format EARS — linter strict actif. »`.

### Étape 3 — Lint EARS

Applique la skill `ears-validator` sur §3 :
- Mode strict : produit la liste R1–R7 par critère. Si ≥ 1 violation → critère SQS Testabilité = 0 forcé. Si 0 violation → +1 bonus à appliquer dans `sqs-scoring`.
- Mode indicatif : produit la liste des suggestions. Score SQS Testabilité évalué normalement par `sqs-scoring`.

### Étape 4 — Scoring SQS

Applique la skill `sqs-scoring`. **Passe-lui le résultat du linter EARS** (mode + violations + bonus). Sortie attendue : score 0–5/5 + verdict Test de l'Étranger + décision Gate + plan de remédiation si nécessaire.

### Étape 5 — Si Gate OUVERTE

1. Statut SPEC → `ready`
2. MAJ `.aiad/specs/_index.md` (score SQS, format)
3. Préparer le Context Engineering Budget :
   - Liste des fichiers à injecter
   - Total tokens estimé
   - Vérifier < ≈ 50K tokens — heuristique de sobriété assumée, non sourcée (cf. `.aiad/facts/FACT-001`)

### Étape 6 — Si Gate FERMÉE

Le plan de remédiation produit par `sqs-scoring` est un **livrable** (texte de remplacement, effort estimé). Routes :
- Atomicité = 0 → `/sdd split`
- 3 échecs successifs → remonter à `/sdd intent`
- En mode EARS strict avec violations R1–R7 → fournir le tableau de reformulations critère par critère.

### Étape 7 — Si Gate INCONNUE (verdict JNSP)

Quand un ou plusieurs critères SQS ne sont **pas scorables** (ex. Testabilité
impossible à juger sans pile de test connue, Cohérence non vérifiable parce
qu'un fichier de SPEC dépendante est illisible, Atomicité indécidable parce
que l'Intent parent n'est pas formulé), la Gate sort en `INCONNUE` — pas
`OUVERTE`, pas `FERMÉE`. C'est un état **fail-closed** : aucune exécution
agent ne peut démarrer.

Forme attendue :

```
Gate : INCONNUE (verdict JNSP)
SQS : ?/5
Critères non scorables :
  - Critère 2 (Testabilité) : motif = <ce qui empêche>
  - Critère 4 (Cohérence) : motif = <ce qui empêche>
Question à l'humain : <question actionnable>
```

Statut SPEC : reste `draft` ou `review`. Ne pas inventer un score par
défaut « pour ne pas bloquer ».

$ARGUMENTS
