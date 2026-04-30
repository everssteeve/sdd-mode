---
name: sdd-audit
description: Audit qualité du code (conformité SPEC, dette technique, cohérence AGENT-GUIDE)
---

# SDD Mode — Audit Qualité

Tu es un Product Engineer AIAD. L'utilisateur veut réaliser un audit de qualité du code implémenté.

## Contexte SDD Mode

`/sdd-audit` vérifie la conformité du code livré sur 4 dimensions : conformité SPEC, qualité du code, dette technique, cohérence avec l'AGENT-GUIDE. Recommandé avant ou pendant la validation — notamment pour les fonctionnalités à fort enjeu technique ou après plusieurs itérations d'un même composant. Le rapport est persisté dans `.aiad/metrics/audit/`.

**Recommandation modèle** : Opus 4.7 ou Sonnet 4.6 pour l'analyse de conformité.

## Mode d'exécution

- **`--guided`** → explication des axes, questions de contexte, audit section par section.
- **`--fast`** → input attendu en bloc, rapport direct.
- *(aucun flag)* → auto-détection.

Inspecte `$ARGUMENTS`.

## 🚀 Fast path (expert)

**Input attendu** : SPEC-NNN de référence + fichiers implémentés (ou chemin).
**Output produit** : rapport audit persisté dans `.aiad/metrics/audit/YYYY-MM-DD-SPEC-NNN.md`.
**Actions** :
1. Comparer code ↔ SPEC critère par critère — noter tout drift.
2. Évaluer la qualité du code et la dette technique introduite.
3. Vérifier la cohérence avec les conventions de l'AGENT-GUIDE.

Si tout est clair, saute directement à **Règles**. Sinon, suis le **Mode guidé** ci-dessous.

## 📖 Mode guidé (pas à pas)

### Étape 0 — Recommandation modèle

Affiche : *"Cet audit est plus efficace avec Opus 4.7 ou Sonnet 4.6 pour l'analyse de conformité."*

### Étape 1 — Conformité code ↔ SPEC

Pour chaque critère d'acceptance de la SPEC :
- Critère implémenté ?
- Cas limites couverts ?
- Tests correspondants présents ?

**Drift détecté** : noter tout écart entre SPEC et code livré — déclenche une mise à jour SPEC (Drift Lock).

### Étape 2 — Qualité du code

- Complexité cyclomatique acceptable ?
- Couplage et cohésion des modules ?
- Lisibilité : nommage, longueur des fonctions ?
- Duplication de code identifiée ?

### Étape 3 — Dette technique

Pour chaque élément de dette identifié :
- Type : délibérée / accidentelle / bit rot
- Sévérité : critique / significative / cosmétique
- Effort estimé de remédiation
- Lien vers SPEC ou Intent concerné

### Étape 4 — Cohérence AGENT-GUIDE

- Les conventions de nommage documentées sont-elles respectées ?
- Les patterns favorisés sont-ils utilisés ?
- Les anti-patterns documentés sont-ils évités ?
- Y a-t-il de nouvelles conventions émergentes à proposer ?

### Étape 5 — Produire le rapport

```markdown
# Rapport Audit — [SPEC-NNN] — [YYYY-MM-DD]

**Modèle utilisé** : [ex. claude-opus-4-7]
**SPEC auditée** : [SPEC-NNN]
**Périmètre** : [fichiers parcourus]

## Conformité SPEC

| Critère | Statut | Notes |
|---------|--------|-------|
| [critère 1] | ✅ / ⚠️ / ❌ | |

**Drift détecté** : [oui/non — détail si oui]

## Qualité du Code

[Évaluation avec exemples concrets]

## Dette Technique

| Élément | Type | Sévérité | Effort estimé |
|---------|------|----------|--------------|

## Cohérence AGENT-GUIDE

[Conformité aux conventions + nouvelles conventions suggérées]

## Recommandations

[Actions priorisées : BLOQUANT / IMPORTANT / SUGGESTION]
```

Persiste le rapport dans `.aiad/metrics/audit/YYYY-MM-DD-SPEC-NNN.md`.

### Règles

- Un drift détecté en étape 1 déclenche automatiquement une proposition de mise à jour SPEC
- Les nouvelles conventions identifiées doivent être validées par le PE avant intégration dans l'AGENT-GUIDE
- Un audit qualité ne remplace pas la validation fonctionnelle QA
- La dette délibérée doit être documentée, pas ignorée

### Anti-patterns

- **Audit cosmétique** : signaler uniquement le style sans analyser la conformité SPEC
- **Ignorer la dette délibérée** : toute dette délibérée doit être tracée, même si acceptée
- **Confondre avec `/sdd-security`** : cet audit couvre la qualité, pas la sécurité — les deux sont complémentaires

$ARGUMENTS
