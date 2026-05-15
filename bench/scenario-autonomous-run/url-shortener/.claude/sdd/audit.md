---
name: audit
description: Audit qualité du code (conformité SPEC, dette technique, cohérence AGENT-GUIDE)
---

# SDD Mode — Audit Qualité

Tu es un Product Engineer AIAD. L'utilisateur veut un audit de qualité du code implémenté.

`/sdd audit` couvre **4 dimensions** : conformité SPEC, qualité du code, dette technique, cohérence AGENT-GUIDE. Recommandé avant ou pendant la validation. Le rapport est persisté dans `.aiad/metrics/audit/`.

**Recommandation modèle** : Opus 4.7 ou Sonnet 4.6.

## Skills invoquées

- 🔧 [`drift-detection`](../skills/drift-detection/SKILL.md) — alimente la dimension "conformité SPEC".
- 🔧 [`ears-validator`](../skills/ears-validator/SKILL.md) — vérifie que les critères de §3 sont implémentables / vérifiables.

## Modes

- `--guided` : section par section
- `--fast` : rapport direct
- *(par défaut)* : auto-détection

## 🚀 Fast path

**Input** : SPEC-NNN + fichiers implémentés.
**Output** : rapport persisté dans `.aiad/metrics/audit/YYYY-MM-DD-SPEC-NNN.md`.

1. Compare code ↔ SPEC critère par critère (skill `drift-detection`).
2. Évalue qualité du code et dette technique.
3. Vérifie cohérence avec les conventions de l'AGENT-GUIDE.

## 📖 Mode guidé

### Étape 0 — Recommandation modèle

Affiche : *"Audit plus efficace avec Opus 4.7 ou Sonnet 4.6 pour l'analyse de conformité."*

### Étape 1 — Conformité code ↔ SPEC

Applique la skill `ears-validator` sur §3, puis pour chaque critère vérifié :
- Critère implémenté ?
- Cas limites couverts ?
- Tests correspondants présents ?

Applique la skill `drift-detection`. Tout drift détecté déclenche une MAJ SPEC (Drift Lock).

### Étape 2 — Qualité du code

- Complexité cyclomatique acceptable ?
- Couplage / cohésion des modules ?
- Lisibilité : nommage, longueur des fonctions ?
- Duplication ?

### Étape 3 — Dette technique

| Élément | Type | Sévérité | Effort |
|---------|------|----------|--------|
| [...] | délibérée / accidentelle / bit rot | critique / significative / cosmétique | F/M/É |

### Étape 4 — Cohérence AGENT-GUIDE

- Conventions de nommage respectées ?
- Patterns favorisés utilisés ?
- Anti-patterns évités ?
- Nouvelles conventions émergentes à proposer ?

### Étape 5 — Produire le rapport

```markdown
# Rapport Audit — [SPEC-NNN] — [YYYY-MM-DD]

**Modèle utilisé** : [...]
**SPEC auditée** : [SPEC-NNN]
**Périmètre** : [fichiers]

## Conformité SPEC

| Critère | Statut | Notes |
|---------|--------|-------|

**Drift détecté** : [oui/non]

## Qualité du Code
[Évaluation + exemples]

## Dette Technique
| Élément | Type | Sévérité | Effort |
|---------|------|----------|--------|

## Cohérence AGENT-GUIDE
[Conformité + nouvelles conventions suggérées]

## Recommandations
[BLOQUANT / IMPORTANT / SUGGESTION]
```

Persiste dans `.aiad/metrics/audit/YYYY-MM-DD-SPEC-NNN.md`.

## Règles

- Un drift détecté déclenche automatiquement une proposition de MAJ SPEC.
- Nouvelles conventions identifiées → validées par le PE avant intégration AGENT-GUIDE.
- Audit qualité ≠ validation fonctionnelle QA.
- Dette délibérée = à documenter, pas à ignorer.

## Anti-patterns

- **Audit cosmétique** : signaler le style sans analyser la conformité SPEC.
- **Ignorer la dette délibérée** : toute dette doit être tracée.
- **Confondre avec `/sdd security`** : `/sdd audit` couvre la qualité, pas la sécurité.

$ARGUMENTS
