---
name: fact
description: Capturer et qualifier un écart livré/désiré (patch, dette, intent ou spec update)
---

# SDD Mode — Capture de Fait Technique

Tu es un Product Engineer AIAD. L'utilisateur a constaté un écart entre le comportement livré et le comportement désiré.

## Contexte SDD Mode

`/sdd fact` est une commande de correction transverse — elle capture et qualifie un écart sans déclencher un cycle Intent complet. Elle trace dans `.aiad/facts/FACT-NNN.md` avec lien vers la SPEC concernée, contribuant au Drift Lock.

## Mode d'exécution

- **`--guided`** → questions posées une par une, qualification guidée pas à pas.
- **`--fast`** → input attendu en bloc, livrable direct.
- *(aucun flag)* → auto-détection.

Inspecte `$ARGUMENTS`.

## 🚀 Fast path (expert)

**Input attendu** : description de l'écart (livré vs. désiré) + SPEC concernée si connue.
**Output produit** : `FACT-NNN.md` dans `.aiad/facts/` avec décision tracée.
**Actions** :
1. Capture l'écart précis : livré vs. désiré.
2. Qualifie l'impact (fonctionnel / sécurité / performance / conformité spec).
3. Décide de l'action : patch immédiat / nouveau Intent / ajustement SPEC / dette connue.

Si tout est clair, saute directement à **Règles**. Sinon, suis le **Mode guidé** ci-dessous.

## 📖 Mode guidé (pas à pas)

### Étape 1 — Capturer l'écart

Pose 2-3 questions pour caractériser précisément l'écart :
- Qu'est-ce qui a été livré ?
- Qu'est-ce qui était attendu ?
- Quelle SPEC était la référence (si applicable) ?

### Étape 2 — Qualifier l'impact

Aide l'utilisateur à qualifier l'impact parmi :
- **Fonctionnel** : le comportement ne correspond pas aux critères d'acceptance
- **Sécurité** : l'écart crée une exposition ou une vulnérabilité
- **Performance** : l'écart entraîne une dégradation mesurable
- **Conformité spec** : la SPEC est devenue obsolète par rapport au code livré

### Étape 3 — Décider de l'action corrective

Propose les quatre options :
1. **Patch immédiat** — correction dans la session courante, lien vers la SPEC
2. **Nouveau Intent Statement** — l'écart révèle un besoin non capturé → `/sdd intent`
3. **Ajustement SPEC existante** — la SPEC doit refléter le comportement réel, mise à jour en place
4. **Dette technique connue** — documenter l'écart comme dette acceptée avec justification

### Étape 4 — Tracer dans `.aiad/facts/`

Crée le fichier au format :

```markdown
# FACT-[NNN] — [titre court]

**Date** : [YYYY-MM-DD]
**Auteur** : [PE]
**SPEC concernée** : [SPEC-NNN ou N/A]
**Statut** : [ouvert / résolu / dette]

## Écart constaté

**Livré** : [description précise]
**Désiré** : [description précise]

## Impact qualifié

- Type : [fonctionnel / sécurité / performance / conformité spec]
- Sévérité : [critique / majeur / mineur]

## Décision d'action

**Action choisie** : [patch immédiat / nouveau Intent / ajustement SPEC / dette connue]
**Justification** : [1-2 phrases]
**Lien SPEC** : [SPEC-NNN ou Intent créé]
```

### Règles

- Ne pas créer un FACT pour un bug trivial (typo, style) — réserver aux écarts comportementaux
- Si l'écart révèle un problème d'intention (pas d'implémentation), escalader vers `/sdd intent`
- Le champ "SPEC concernée" est obligatoire — si aucune SPEC n'existe, c'est un signal de drift structurel
- Un FACT ouvert depuis > 2 itérations doit devenir une dette formelle ou un Intent

### Anti-patterns

- **Accumuler les FACTs sans résolution** : un backlog de FACTs ouverts est un signe de dette intentionnelle
- **Créer un FACT pour éviter un Intent** : si l'écart est fonctionnel majeur, la bonne réponse est `/sdd intent`

$ARGUMENTS
