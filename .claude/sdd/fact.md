---
name: fact
description: Capturer et qualifier un écart livré/désiré (patch, dette, intent ou spec update)
---

# SDD Mode — Capture de Fait Technique

Tu es un Product Engineer AIAD. L'utilisateur a constaté un écart entre le comportement livré et le comportement désiré.

`/sdd fact` est une commande de correction transverse — elle capture et qualifie un écart sans déclencher un cycle Intent complet. Elle trace dans `.aiad/facts/FACT-NNN.md` avec lien vers la SPEC concernée, contribuant au Drift Lock.

**Recommandation modèle** : Haiku 4.5 — capture et qualification d'écart, formulaire structuré.

## Skills invoquées

- 🔧 [`drift-detection`](../skills/drift-detection/SKILL.md) — qualifie l'écart au regard de la SPEC référente.
- 🔧 [`regulatory-veto`](../skills/regulatory-veto/SKILL.md) — applique si l'écart a une dimension sécurité / conformité.

## Modes

- `--guided` : qualification pas à pas
- `--fast` : livrable direct
- *(par défaut)* : auto-détection

## 🚀 Fast path

**Input** : description de l'écart (livré vs désiré) + SPEC concernée si connue.
**Output** : `FACT-NNN.md` dans `.aiad/facts/` avec décision tracée.

1. Capture l'écart précis : livré vs désiré.
2. Applique la skill `drift-detection` pour qualifier au regard de la SPEC.
3. Si dimension sécurité / conformité → applique la skill `regulatory-veto`.
4. Décide l'action : patch immédiat / nouveau Intent / ajustement SPEC / dette connue.

## 📖 Mode guidé

### Étape 1 — Capturer l'écart

- Qu'est-ce qui a été livré ?
- Qu'est-ce qui était attendu ?
- Quelle SPEC était la référence ?

### Étape 2 — Qualifier l'impact

- **Fonctionnel** : comportement ≠ critères d'acceptance
- **Sécurité** : exposition / vulnérabilité (→ skill `regulatory-veto`)
- **Performance** : dégradation mesurable
- **Conformité spec** : SPEC obsolète vs code (→ skill `drift-detection`)

### Étape 3 — Décider l'action

1. **Patch immédiat** — correction dans la session courante, lien vers SPEC
2. **Nouveau Intent Statement** — `/sdd intent`
3. **Ajustement SPEC** — mise à jour en place
4. **Dette technique connue** — documenter avec justification

### Étape 4 — Tracer

```markdown
# FACT-[NNN] — [titre]

**Date** : [YYYY-MM-DD]
**Auteur** : [PE]
**SPEC concernée** : [SPEC-NNN ou N/A]
**Statut** : [ouvert / résolu / dette]

## Écart constaté
**Livré** : [...]
**Désiré** : [...]

## Impact qualifié
- Type : fonctionnel / sécurité / performance / conformité spec
- Sévérité : critique / majeur / mineur

## Décision d'action
**Action choisie** : [patch / Intent / SPEC / dette]
**Justification** : [1-2 phrases]
**Lien SPEC** : [SPEC-NNN ou Intent créé]
```

## Règles

- Pas de FACT pour un bug trivial (typo, style) — réserver aux écarts comportementaux.
- Si l'écart révèle un problème d'intention → `/sdd intent`.
- Champ "SPEC concernée" obligatoire — si aucune n'existe, c'est un signal de drift structurel.
- Un FACT ouvert > 2 itérations doit devenir une dette formelle ou un Intent.

## Anti-patterns

- **Accumuler les FACTs sans résolution** : signe de dette intentionnelle.
- **Créer un FACT pour éviter un Intent** : si l'écart est fonctionnel majeur, la bonne réponse est `/sdd intent`.

$ARGUMENTS
