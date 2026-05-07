---
name: split
description: Découper une SPEC trop volumineuse en sous-SPECs atomiques
---

# SDD Mode — Découpage de SPEC

Tu es un Product Engineer AIAD. L'utilisateur veut découper une SPEC trop volumineuse ou non-atomique en sous-SPECs qui passent l'Execution Gate.

## Contexte SDD Mode

Une SPEC doit être **atomique** (1 SPEC = 1 PR = 1 tâche livrable). Quand l'Execution Gate échoue sur le critère d'atomicité, ou quand une SPEC dépasse 200 lignes, ou quand une exécution agent nécessite plus de 2 relances, il faut découper. Le découpage doit préserver la traçabilité vers l'Intent parent.

## Mode d'exécution

Cette commande supporte deux modes :

- **`--guided`** → mode débutant : questions posées une par une, concepts expliqués, exemples proposés.
- **`--fast`** → mode expert : input attendu en bloc, explications sautées, livrable direct.
- *(aucun flag)* → auto-détection : **guided** si `.aiad/` est absent ou quasi vide, **fast** sinon.

Inspecte `$ARGUMENTS` pour détecter le flag ; à défaut, inspecte `.aiad/` avant de trancher.

## 🚀 Fast path (expert)

**Input attendu** : SPEC-NNN à découper + raison (atomicité, taille > 200 lignes, > 2 relances, budget > 50K).
**Output produit** : sous-SPECs atomiques (NNNa, NNNb…) + parent en statut `split` + ordre d'exécution recommandé.
**Actions** :
1. Propose un pattern de découpage adapté (A: couche technique / B: cas d'usage / C: dépendance / D: domaine).
2. Crée les sous-SPECs avec traçabilité vers parent et Intent.
3. Mets à jour les index + livre l'ordre d'exécution.

> ⚠️ Si le découpage produit > 5 sous-SPECs, l'Intent est trop ambitieux → remonte à `/sdd intent` au lieu de splitter.

Si tout est clair, saute directement à **Règles**. Sinon, suis le **Mode guidé** ci-dessous.

## 📖 Mode guidé (pas à pas)

### Étape 1 — Diagnostiquer pourquoi le découpage est nécessaire

Identifie la SPEC à découper et la raison :

| Signal | Indice |
|--------|--------|
| SQS Atomicité = 0 | La Gate a rejeté la SPEC sur ce critère |
| SPEC > 200 lignes | Trop de comportements pour une seule tâche |
| > 2 relances agent | L'agent perd le fil — la tâche est trop complexe |
| Context Engineering Budget > 50K | Le contexte nécessaire dépasse le seuil |
| Multiples fichiers indépendants | La SPEC touche des domaines distincts |

### Étape 2 — Identifier les axes de découpage

Analyse la SPEC et propose un découpage selon l'un de ces patterns :

**Pattern A — Par couche technique**
```
SPEC-042 (monolithique)
├── SPEC-042a — Backend (API / logique métier)
├── SPEC-042b — Frontend (UI / composants)
└── SPEC-042c — Tests d'intégration
```

**Pattern B — Par cas d'usage**
```
SPEC-042 (monolithique)
├── SPEC-042a — Cas nominal (happy path)
├── SPEC-042b — Cas limites (edge cases)
└── SPEC-042c — Cas d'erreur (error handling)
```

**Pattern C — Par dépendance**
```
SPEC-042 (monolithique)
├── SPEC-042a — Infrastructure / setup (pré-requis)
├── SPEC-042b — Logique principale (dépend de a)
└── SPEC-042c — Intégration / wiring (dépend de a + b)
```

**Pattern D — Par domaine métier**
```
SPEC-042 (monolithique)
├── SPEC-042a — Domaine A (ex: utilisateur)
├── SPEC-042b — Domaine B (ex: commande)
└── SPEC-042c — Lien entre domaines
```

### Étape 3 — Valider le découpage avec l'utilisateur

Présente le découpage proposé et vérifie :

- [ ] Chaque sous-SPEC est livrable indépendamment (1 PR)
- [ ] Chaque sous-SPEC a des critères d'acceptation testables
- [ ] L'ordre d'exécution est clair (dépendances entre sous-SPECs)
- [ ] La somme des sous-SPECs couvre 100% de la SPEC parente
- [ ] Aucune sous-SPEC ne dépasse 200 lignes

### Étape 4 — Générer les sous-SPECs

Pour chaque sous-SPEC, créer un fichier dans `.aiad/specs/` en suivant le template standard (`/sdd spec`), avec les ajouts suivants :

```markdown
**SPEC parent** : SPEC-[NNN] (découpée)
**Intent parent** : INTENT-[NNN] (hérité de la SPEC parente)
**Ordre d'exécution** : [X] sur [Y]
**Dépendances intra-split** : SPEC-[NNN]a, SPEC-[NNN]b (le cas échéant)
```

### Étape 5 — Mettre à jour les index et la traçabilité

1. **SPEC parente** → Statut `split` + liens vers les sous-SPECs
2. **`.aiad/specs/_index.md`** → Ajouter les sous-SPECs, marquer la parente comme `split`
3. **Intent parent** → Mettre à jour la section "SPECs liées" avec les nouvelles sous-SPECs
4. **Chaque sous-SPEC** → Prête pour `/sdd gate` individuel

### Étape 6 — Planifier l'exécution

Proposer un ordre d'exécution optimisé :

```
Ordre recommandé :
1. SPEC-042a (pas de dépendance) → /sdd gate → /sdd exec
2. SPEC-042b (dépend de a) → /sdd gate → /sdd exec (après validation de a)
3. SPEC-042c (dépend de a+b) → /sdd gate → /sdd exec (après validation de b)
```

### Règles

- Le découpage n'est PAS un échec — c'est un signe de maturité du PE
- Chaque sous-SPEC doit pouvoir passer la Gate indépendamment
- Ne jamais créer de sous-SPEC "fourre-tout" pour le reste
- Si le découpage produit plus de 5 sous-SPECs, l'Intent est probablement trop ambitieuse — remonter au niveau `/sdd intent`
- La numérotation avec suffixe (a, b, c) préserve la traçabilité visuelle

$ARGUMENTS
