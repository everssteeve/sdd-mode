---
id: SPEC-020-2
title: Redevabilité bidirectionnelle — FACT enrichi + signal constraint-violated
parent_intent: INTENT-020
status: done
format: prose
sqs: 5/5
traceability: exempt
traceability_reason: "Livrable 100% éditorial (.claude/sdd/fact.md, .claude/skills/drift-detection/SKILL.md, .aiad/AGENT-GUIDE.md) — aucun fichier .js produit, pas d'annotation @spec applicable."
author: Steeve Evers
date: "2026-06-25"
research: RESEARCH-033
---

# SPEC-020-2-redevabilite-bidirectionnelle

**Intent parent** : INTENT-020
**Research** : RESEARCH-033 — CONDITIONAL GO 85 % (C1 levée ici)
**Auteur** : Steeve Evers
**Date** : 2026-06-25
**Statut** : done

---

## 1. Contexte

Quand un agent découvre en exécution une contrainte que la SPEC ne documentait pas (ou mal), le seul outil disponible est le FACT — qui capture l'écart livré/désiré mais ne propose pas de correction à la SPEC. Le PE doit dériver lui-même la mise à jour SPEC à partir du FACT.

Cette SPEC introduit la **redevabilité bidirectionnelle** : l'agent peut proposer un patch de SPEC dans le FACT (champ `spec-patch-proposal`) **sans jamais modifier la SPEC directement** (condition C1, RESEARCH-033 — Human Authorship préservé). Le PE conserve l'autorité d'appliquer, rejeter ou modifier la proposition.

Elle introduit aussi un nouveau type de drift : `constraint-violated-without-fact` — une contrainte violée en exécution sans FACT ni mise à jour SPEC associés.

## 2. Comportement Attendu

### Input

L'agent, pendant `/sdd exec`, découvre qu'une contrainte du code viole la SPEC référencée (`@spec SPEC-NNN-N-slug`) ou qu'une contrainte du code n'est pas documentée dans la SPEC.

**Déclencheurs valides :**
- Contrainte implicite dans le code (ex. : timeout hardcodé à 30s) non documentée dans la SPEC
- Comportement observé (ex. : ordre de traitement) différent de la SPEC Processing
- Invariant de domaine découvert en exécution qui devrait être un CA

**Déclencheurs non valides (FACT classique suffisant) :**
- Bug fonctionnel (livré ≠ désiré) sans implication SPEC → FACT classique
- Écart de style ou de nommage → commentaire de code, pas un FACT

### Processing

**Étape 1 — L'agent crée un FACT enrichi :**

Le template FACT-NNN.md accepte désormais un champ optionnel `spec-patch-proposal` :

```yaml
---
id: FACT-NNN
date: YYYY-MM-DD
author: <agent ou PE>
spec: SPEC-NNN-N-slug          # Obligatoire
statut: ouvert
type: conformite-spec          # Nouveau type pour ce cas d'usage
severite: mineur | majeur | critique
---
```

Corps du FACT :
```markdown
## Écart
[Description livré vs désiré]

## Impact
[Impact fonctionnel/conformité]

## Décision
[À trancher par le PE]

## spec-patch-proposal

> ⚠ Proposition de l'agent — non appliquée. Le PE doit valider avant toute modification.

**Section cible** : § 2 Processing / § 3 CA-002 / etc.
**Changement proposé** :
[Texte exact à ajouter/remplacer dans la SPEC, au format SPEC prose ou EARS]

**Classification delta** (SPEC-020-1) : petit delta | changement significatif
**Raison** : [Pourquoi cette contrainte doit être documentée]
```

**Étape 2 — Le PE examine la proposition :**

Options :
- **Appliquer** : copie le contenu de `spec-patch-proposal` dans la SPEC, applique le modèle deltas SPEC-020-1 (chemin A ou B selon classification).
- **Rejeter** : ferme le FACT avec `statut: rejeté` + raison.
- **Modifier** : adapte la proposition, puis applique.

Le PE ne peut pas merger une PR contenant un FACT avec `spec-patch-proposal` et `statut: ouvert` sans avoir statué (le drift-check signale le FACT ouvert avec proposition non résolue).

**Étape 3 — Mise à jour du drift-check :**

Nouveau type de drift `constraint-violated-without-fact` détecté par la skill `drift-detection` :
- Signal : un commentaire `// CONSTRAINT:` ou `// INVARIANT:` dans le code sans `@spec` associé ET sans FACT ouvert référençant cette zone.
- Niveau : `WARN` (pas bloquant par défaut, pour ne pas surcharger les projets existants). Configurable en `ERROR` via `.aiad/drift-config.yml` si le PE le souhaite.

### Output

- Fichier `.aiad/facts/FACT-NNN.md` créé avec champ `spec-patch-proposal` rempli.
- SPEC **non modifiée** par l'agent (invariant C1).
- Drift-check signale les FACTs ouverts avec proposition non résolue.

### Cas limites

- **Agent propose une refonte complète de SPEC** : interdit. Si la proposition dépasse 20 lignes ou touche la logique fondamentale, l'agent DOIT créer un Intent au lieu d'un FACT enrichi.
- **Plusieurs contraintes violées simultanément** : un FACT par contrainte (pas de FACT multi-spec-patch).
- **FACT enrichi sur SPEC archivée** : la proposition doit d'abord déclencher une restauration de la SPEC — le PE statue avant.
- **PE applique la proposition sans review** : déconseillé mais non bloqué. Le `/sdd validate` post-exec remontera tout drift résiduel.
- **`spec-patch-proposal` vide** : le champ peut être omis (FACT classique). Sa présence est optionnelle.

## 3. Critères d'Acceptation

- [x] CA-001 — Un FACT avec `spec-patch-proposal` ne modifie jamais la SPEC directement (l'agent peut créer le FACT, pas appliquer le patch).
- [x] CA-002 — Le template FACT (`.aiad/facts/` ou `.claude/sdd/fact.md`) documente le champ `spec-patch-proposal` avec la note "Proposition de l'agent — non appliquée".
- [x] CA-003 — Un FACT avec `spec-patch-proposal` et `statut: ouvert` est signalé par `/sdd drift-check` comme "FACT à statuer avant merge".
- [x] CA-004 — Le nouveau type de drift `constraint-violated-without-fact` est documenté dans la skill `drift-detection` avec niveau `WARN` par défaut.
- [x] CA-005 — Une proposition dont le contenu `spec-patch-proposal` dépasse 20 lignes déclenche un message d'erreur invitant à créer un Intent plutôt qu'un FACT.
- [x] CA-006 — La classification du delta proposé (petit / significatif, per SPEC-020-1) est explicitement indiquée dans chaque `spec-patch-proposal`.

## 4. Interface / API

**Template FACT mis à jour** (`.claude/sdd/fact.md` — section template) :

```markdown
## spec-patch-proposal   ← optionnel, rempli par l'agent uniquement

> ⚠ Proposition de l'agent — non appliquée. Valider avant toute modification.

**Section cible** : [§ X Titre]
**Changement proposé** : [texte exact]
**Classification delta** (SPEC-020-1) : [petit delta | changement significatif]
**Raison** : [contrainte découverte / invariant non documenté]
```

**Skill `drift-detection`** — nouveau signal (documentaire, pas de code CLI) :

```
[WARN] FACT-NNN : spec-patch-proposal ouvert sur SPEC-NNN-N — à statuer avant merge.
[WARN] constraint-violated-without-fact : zone chemin:ligne sans @spec ni FACT associé.
```

## 5. Dépendances

- **SPEC-020-1** — définit la classification petit delta / significatif utilisée dans `spec-patch-proposal`
- `.claude/sdd/fact.md` — ajout section `spec-patch-proposal` dans le template
- `.claude/skills/drift-detection/SKILL.md` — ajout type `constraint-violated-without-fact` + signal FACT ouvert avec proposition

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~500 tokens
- SPEC-020-1 (dépendance) : ~700 tokens
- Cette SPEC : ~700 tokens
- Fichiers à modifier : `fact.md` (~500 tokens), `drift-detection/SKILL.md` (~600 tokens)
- **Total estimé** : ~3 000 tokens (sous le seuil 60-70 % pour Sonnet 4.6)

## 7. Definition of Output Done (DoOD)

- [ ] `.claude/sdd/fact.md` — template inclut la section `## spec-patch-proposal` avec note avertissement
- [ ] `.claude/skills/drift-detection/SKILL.md` — type `constraint-violated-without-fact` documenté + signal FACT ouvert avec proposition
- [ ] Test manuel : créer un FACT avec `spec-patch-proposal`, vérifier que `/sdd drift-check` le signale comme "à statuer"
- [ ] `AGENT-GUIDE.md` — mention de la redevabilité bidirectionnelle dans § Drift Lock (cross-ref SPEC-020-2)
- [ ] `_index.md` mis à jour (SPEC-020-2 → `done`)
- [ ] Drift check : `npx aiad-sdd trace --fail-on-gap` exit 0 (ou exemption documentée)
- [ ] Gouvernance : livrable 100 % éditorial (`.md` uniquement) — RGESN N/A, RGAA N/A

## Historique des modifications

- 2026-06-25 [agent] — Exécution initiale : ajout `spec-patch-proposal` dans `.claude/sdd/fact.md`, type `constraint-violated-without-fact` dans `drift-detection/SKILL.md`, mention redevabilité bidirectionnelle dans AGENT-GUIDE (déclencheur : exécution SPEC-020-2)
