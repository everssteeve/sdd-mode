---
name: context
description: Auditer le Context Engineering Budget d'une session agent (estimation vs. réel) avec métriques de santé
---

# SDD Mode — Audit du Context Engineering Budget

Tu es un Product Engineer AIAD. L'utilisateur veut auditer le Context Engineering Budget d'une session agent — comparer l'estimation faite dans la SPEC avec la réalité, et produire un score de santé.

Le Context Engineering Budget sert la **Sobriété Intentionnelle** : il ne s'agit pas de maximiser le contexte, mais de l'optimiser. Cette commande clôt la boucle de feedback pour que le PE améliore ses estimations futures.

**Recommandation modèle** : Haiku 4.5 — calcul algorithmique des métriques M1–M5.

## Skills invoquées

- 🔧 [`context-budget`](../skills/context-budget/SKILL.md) — calcul des 5 métriques M1–M5, score de santé, recommandations.

## Modes

- `--guided` : pas à pas
- `--fast` : rapport direct
- *(par défaut)* : auto-détection

## 🚀 Fast path

**Input** : SPEC-NNN dont la session vient de s'exécuter + estimation initiale.
**Output** : rapport d'audit avec score santé [X]/5 + recommandations + MAJ Lessons / Human Learnings si pertinent.

1. Lis l'estimation initiale (SPEC §6).
2. Mesure le contexte réel injecté (composants : AGENT-GUIDE / SPEC / sources / ajouts en cours).
3. Applique la skill `context-budget` (calcule M1–M5 et le score, produit le rapport).
4. Mets à jour SPEC §6 (réel archivé) + AGENT-GUIDE Lessons / Human Learnings si pattern détecté.

## 📖 Mode guidé

### Étape 1 — Identifier la session

Demande quelle SPEC/session auditer. Lis l'estimation initiale dans la SPEC §6.

### Étape 2 — Mesurer le contexte réel

| Composant | Estimation | Réel | Écart |
|-----------|-----------|------|-------|
| AGENT-GUIDE (condensé) | ~X | ~X | ±X% |
| SPEC | ~X | ~X | ±X% |
| Fichiers source injectés | ~X | ~X | ±X% |
| Ajouts en cours de session | 0 | ~X | N/A |
| **Total** | ~X | ~X | ±X% |

### Étape 3 — Métriques de santé

Applique la skill `context-budget`. Sortie attendue : M1 taux utile, M2 relances, M3 ratio, M4 cohérence, M5 durée + score 0–5/5 + diagnostic + recommandations.

### Étape 4 — Mettre à jour les références

- MAJ SPEC §6 (archive le réel)
- Pattern récurrent → AGENT-GUIDE § Lessons Learned
- Mauvaise estimation humaine → AGENT-GUIDE § Human Learnings

## Règles

- Audit = boucle d'amélioration, pas punition.
- Garder court et actionnable (pas de rapport de 5 pages).
- Le context rot (M4 + M5) est le signal le plus dangereux : il dégrade silencieusement.

$ARGUMENTS
