---
id: SPEC-020-1
title: Modèle deltas/archive — specs = état courant, petits changements tracés
parent_intent: INTENT-020
status: done
format: prose
sqs: 5/5
author: Steeve Evers
date: "2026-06-25"
research: RESEARCH-033
traceability: exempt
traceability_reason: "Livrable 100% éditorial (spec-template.md, spec-ears-template.md, AGENT-GUIDE.md) — aucun fichier .js produit, pas d'annotation @spec applicable."
---

# SPEC-020-1-modele-deltas-archive

**Intent parent** : INTENT-020
**Research** : RESEARCH-033 — CONDITIONAL GO 85 % (C2 levée ici)
**Auteur** : Steeve Evers
**Date** : 2026-06-25
**Statut** : done

---

## 1. Contexte

Le Drift Lock actuel repose sur la discipline : mettre à jour la SPEC dans la même PR que le code. Quand un changement est "petit" (correction d'un seuil, reformulation d'un CA, ajout d'un cas limite), aucun mécanisme ne le distingue d'une refonte complète — la friction est identique. Cela crée une "taxe de maintenance" qui incite à ne pas mettre à jour la SPEC (résultat : SPEC périmée + drift).

Cette SPEC introduit un **modèle de deltas légers** : les SPECs restent l'état courant (elles ne s'accumulent pas) ; chaque changement "petit" est tracé dans une section `## Historique` de la SPEC elle-même. Les changements "significatifs" continuent d'alimenter `CHANGELOG-ARTEFACTS.md`. Le modèle cohabite avec le cycle existant — migration non imposée.

Condition C2 (RESEARCH-033) levée ici : définition quantitative de la frontière delta/archivage.

## 2. Comportement Attendu

### Input

Un PE ou un agent veut apporter un changement à une SPEC existante (status : `ready`, `in-progress` ou `validation`). Le changement est classifié avant application.

**Critère de classification (C2 — frontière petits / significatifs) :**

| Petit delta | Changement significatif |
|-------------|------------------------|
| ≤ 5 lignes modifiées dans la SPEC | > 5 lignes OU logique comportementale touchée |
| Ne touche PAS les Critères d'Acceptation (§3) | Touche ≥ 1 Critère d'Acceptation |
| Ne modifie PAS l'Interface/API (§4) | Modifie l'Interface/API |
| Exemples : correction typo, ajout cas limite mineur, mise à jour d'un seuil documenté par un FACT | Exemples : nouveau CA, refonte du Processing, ajout d'une dépendance |

### Processing

**Chemin A — Petit delta :**
1. Le PE (ou l'agent sous instruction PE) applique le changement dans la SPEC.
2. Ajoute une entrée dans la section `## Historique des modifications` de la SPEC :
   ```
   - YYYY-MM-DD [auteur] — <description 1 ligne> (déclencheur : FACT-NNN | décision PE | exécution)
   ```
3. Met à jour `_index.md` uniquement si le statut change.
4. N'alimente PAS `CHANGELOG-ARTEFACTS.md` (évite la friction pour les petits changements).

**Chemin B — Changement significatif :**
1. Le PE applique le changement dans la SPEC.
2. Ajoute une entrée dans `## Historique des modifications` de la SPEC.
3. Ajoute une entrée dans `.aiad/CHANGELOG-ARTEFACTS.md` (format existant).
4. Si déclenché par une contrainte violée → crée aussi un FACT (voir SPEC-020-2).
5. Met à jour `_index.md`.

**Section `## Historique des modifications` :**
- Ajoutée en pied de SPEC, après `## 7. Definition of Output Done`.
- Optionnelle sur les nouvelles SPECs (ajoutée à la première modification).
- Format liste à plat : un item par delta, ordre chronologique croissant.
- La section est présente dans le template mis à jour (`spec-template.md`).

### Output

- SPEC modifiée avec son `## Historique des modifications` à jour.
- `CHANGELOG-ARTEFACTS.md` mis à jour (chemin B uniquement).
- `_index.md` mis à jour si statut change.

### Cas limites

- **Delta sur une SPEC archivée** : interdit. Restaurer via `aiad-sdd archive restore <ID>` d'abord.
- **Delta sur une SPEC `draft`** : pas d'entrée `## Historique` requise (la SPEC est encore en cours de rédaction).
- **Ambiguïté chemin A/B** : en cas de doute, prendre le chemin B (conservateur).
- **Delta émis par un agent sans instruction PE** : interdit par C1 (voir SPEC-020-2). Seul le FACT enrichi est autorisé.
- **Plusieurs petits deltas le même jour** : un item par delta (même date, descriptions distinctes).
- **Chemin A vs B pour ≤ 5 lignes touchant un CA** : la règle "touche ≥ 1 CA → significatif" prime sur le compte de lignes.

## 3. Critères d'Acceptation

- [ ] CA-001 — Un changement ≤ 5 lignes n'touchant pas §3 ni §4 est appliqué en chemin A sans entrée CHANGELOG-ARTEFACTS.
- [ ] CA-002 — Un changement > 5 lignes OU touchant §3 ou §4 déclenche le chemin B avec entrée CHANGELOG-ARTEFACTS.
- [ ] CA-003 — Toute modification d'une SPEC via chemin A ou B produit une entrée dans `## Historique des modifications` avec date, auteur et description.
- [ ] CA-004 — Une SPEC archivée ne peut pas être modifiée sans restauration préalable (commande bloque avec message explicite).
- [ ] CA-005 — La section `## Historique des modifications` est présente dans `spec-template.md` et `spec-ears-template.md`.
- [ ] CA-006 — Le critère de classification (tableau chemin A/B) est lisible dans le corps de SPEC-020-1 et référencé depuis `AGENT-GUIDE.md` § Drift Lock.

## 4. Interface / API

Pas de nouveau CLI pour cette SPEC — le workflow est documentaire.

**Template mis à jour** (`.aiad/specs/spec-template.md` et `spec-ears-template.md`) :
```markdown
## Historique des modifications

<!-- Ajouté à la première modification. Un item par delta, ordre chronologique. -->
<!-- - YYYY-MM-DD [auteur] — description (déclencheur : FACT-NNN | décision PE | exécution) -->
```

**AGENT-GUIDE.md** — ajout dans § Drift Lock :
```
### Modèle deltas (SPEC-020-1)
Petit delta (≤ 5 lignes, pas §3/§4) → chemin A (Historique SPEC only).
Changement significatif → chemin B (Historique SPEC + CHANGELOG-ARTEFACTS).
```

## 5. Dépendances

- `.aiad/specs/spec-template.md` — ajout section `## Historique des modifications`
- `.aiad/specs/spec-ears-template.md` — même ajout
- `.aiad/AGENT-GUIDE.md` — documenter le modèle deltas dans § Drift Lock
- SPEC-020-2 — utilise ce modèle pour le champ `spec-patch-proposal` dans les FACTs

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~500 tokens
- Cette SPEC : ~700 tokens
- Fichiers à modifier : `spec-template.md` (~100 tokens), `spec-ears-template.md` (~100 tokens), `AGENT-GUIDE.md` (~1 000 tokens)
- **Total estimé** : ~2 400 tokens (bien sous le seuil 60-70 % pour Sonnet 4.6)

## 7. Definition of Output Done (DoOD)

- [ ] `spec-template.md` contient la section `## Historique des modifications` avec commentaire de format
- [ ] `spec-ears-template.md` contient la même section
- [ ] `AGENT-GUIDE.md` § Drift Lock documente le modèle deltas (tableau chemin A/B)
- [ ] SPEC-020-1 elle-même est mise à jour à statut `done` avec une entrée `## Historique`
- [ ] `_index.md` mis à jour (SPEC-020-1 → `done`)
- [ ] Drift check : `npx aiad-sdd trace --fail-on-gap` exit 0 (ou exemption documentée si livrable 100 % éditorial)
- [ ] Gouvernance : RGESN (pas de ressource serveur ajoutée — OK) ; RGAA (pas d'UI — N/A)

## Historique des modifications

- 2026-06-25 [Steeve Evers] — Exécution initiale : création spec-template.md, ajout § Historique dans spec-ears-template.md, ajout § DRIFT LOCK dans AGENT-GUIDE.md (déclencheur : exécution SPEC-020-1)
