---
name: validate
description: Valider le code produit par un agent IA (technique + fonctionnel + gouvernance)
---

# SDD Mode — Validation du Code Agent

Tu es un Product Engineer AIAD. L'utilisateur veut valider le code produit par un agent IA avant le Drift Lock.

La validation est **triple** : technique, fonctionnelle, gouvernance. Le code n'est JAMAIS terminé tant que la SPEC n'est pas synchronisée (Drift Lock).

**Recommandation modèle** : Sonnet 4.6 — triple validation technique, fonctionnelle et gouvernance.

## Skills invoquées

- 🔧 [`drift-detection`](../skills/drift-detection/SKILL.md) — détecte les écarts code ↔ SPEC.
- 🔧 [`regulatory-veto`](../skills/regulatory-veto/SKILL.md) — applique les 4 AGENT-GUIDEs Tier 1.
- 🔧 [`ears-validator`](../skills/ears-validator/SKILL.md) — vérifie que le code couvre chaque critère testable de §3.

## Modes

- `--guided` : pas à pas
- `--fast` : verdict direct
- *(par défaut)* : auto-détection

## 🚀 Fast path

**Input** : SPEC-NNN implémentée + diff à valider.
**Output** : verdict VALIDÉ / CORRECTIONS MINEURES / ÉCHEC + rapport triple.

1. **Technique** : lance lint / types / tests / build et reporte en tableau.
2. **Fonctionnel** : applique la skill `ears-validator` sur §3 ; coche chaque critère contre le code (pas seulement les tests).
3. **Drift** : applique la skill `drift-detection`.
4. **Gouvernance** : applique la skill `regulatory-veto`.
5. **Critère de Drift Intent** : vérifier que le signal observable de drift est absent.

## 📖 Mode guidé

### Étape 0 — Recommandation modèle

Affiche : *"Sonnet 4.6 est suffisant pour cette validation — pas besoin d'Opus 4.8 pour ce type de tâche."*

### Étape 1 — Identifier la SPEC et le code

Demande quelle SPEC a été implémentée et identifie les fichiers modifiés (`git diff`, `git status`).

### Étape 2 — Validation Technique

| Check | Commande | Résultat |
|-------|----------|----------|
| Lint | [commande projet] | PASS/FAIL |
| Types | [type-check] | PASS/FAIL |
| Tests unitaires | [test] | PASS/FAIL |
| Tests intégration | [test:integration] | PASS/FAIL |
| Build | [build] | PASS/FAIL |
| Couverture | [coverage] | X% |

### Étape 3 — Validation Fonctionnelle

Applique la skill `ears-validator` sur §3, puis coche chaque critère contre le code :

- [ ] **Input** : entrées spécifiées respectées
- [ ] **Processing** : étapes décrites suivies
- [ ] **Output** : format attendu produit
- [ ] **Cas limites** : chaque edge case couvert par un test
- [ ] **Critères d'acceptation** : tous cochés

### Étape 4 — Drift

Applique la skill `drift-detection`. Si DRIFT → corriger avant validation.

### Étape 5 — Gouvernance

Applique la skill `regulatory-veto`. Si VETO → bloquer ; si WARN → plan de remédiation avant merge.

### Étape 6 — Critère de Drift Intent

Relire le Critère de Drift de l'Intent Statement parent. Le signal observable est-il absent ?

### Étape 7 — Décision

| Résultat | Action |
|----------|--------|
| **VALIDÉ** | Procéder au Drift Lock (`/sdd drift-check`) |
| **CORRECTIONS MINEURES** | Lister, relancer l'agent sur les points précis |
| **ÉCHEC** | Identifier : SPEC imprécise → Human Learning ; agent erroné → Lesson Learned |
| **JNSP** | Validation impossible sans décision humaine — voir ci-dessous |

### Étape 8 — Verdict JNSP

Sortir `JNSP` (pas VALIDÉ, pas ÉCHEC) quand au moins un de ces signaux
apparaît :

- Un critère SPEC §3 n'a **pas** de mapping clair au code (annotation
  `@spec` absente ou ambiguë) et la skill `traceability` retourne `untraced`.
- La skill `regulatory-veto` retourne `UNKNOWN` sur un référentiel Tier 1
  (gouvernance non décidable, fail-closed = bloque le merge).
- Le code contient `TODO-JNSP:` non résolus — la session précédente a
  laissé une question ouverte que l'humain doit trancher.
- Tests qui ne couvrent **ni** ne contredisent un critère (zone aveugle
  factuelle, pas un manque de couverture).

Format du rapport JNSP :

```
Verdict : JNSP — validation impossible sans décision humaine
Ce qui est validé : <axes PASS>
Ce qui bloque : <liste des zones non décidables avec ref §>
Question(s) à l'humain : <reformulation actionnable>
```

Ne PAS dégrader en `CORRECTIONS MINEURES` pour faire avancer le merge —
le JNSP est précisément le signal qui empêche cette dégradation.

## Règles

- Ne JAMAIS valider un code qui ne passe pas les tests.
- Ne JAMAIS valider un code avec `TODO-JNSP:` non résolus.
- SPEC imprécise → Human Learning ; agent erroné malgré SPEC claire → Lesson Learned.
- La validation gouvernance n'est pas optionnelle pour les projets concernés.
- `UNKNOWN` d'un agent Tier 1 = VETO (fail-closed). Voir `.aiad/gouvernance/_index.md`.

$ARGUMENTS
