---
id: SPEC-033-4
title: /sdd context — contexte hérité au point de fork d'un sous-agent
parent_intent: INTENT-033
status: ready
format: prose
sqs: 5
author: Steeve Evers
date: "2026-09-25"
traceability: exempt
traceability_reason: "Livrable éditorial — commande, skill et gabarit Markdown, sans code applicatif annotable."
---

# SPEC-033-4-contexte-herite

**Intent parent** : INTENT-033
**Research** : RESEARCH-040 — GO (auteur) → CONDITIONAL GO (machine)
**Auteur** : Steeve Evers *(rédaction : agent, 2026-09-25 — à valider à la Gate)*
**Date** : 2026-09-25
**Statut** : ready
**Format** : prose
**SQS** : 5/5 — Execution Gate OUVERTE (2026-09-26), Test de l'Étranger PASS

---

## 1. Contexte

La doctrine v1.9 (SDD Mode, Principe #3) pose la règle : **si un sous-agent hérite de la conversation parente**, le coût d'une délégation vaut « contexte parent au moment du fork + travail propre », et il vaut mieux déléguer tôt. Ni `/sdd context`, ni la skill `context-budget`, ni le §6 du gabarit de SPEC ne connaissent ce poste de coût : l'estimation sous-évalue les sessions qui délèguent, et la métrique M3 (ratio réel / estimé) les signale à tort comme mal estimées.

## 2. Comportement Attendu

### Input

- `templates/.claude/sdd/context.md`, `templates/.claude/skills/context-budget/SKILL.md`, §6 des deux gabarits de SPEC (et leurs exemplaires `.claude/` / `.aiad/`, identiques après SPEC-033-1).

### Processing

1. **Gabarit de SPEC, §6** : ajouter une ligne `- Contexte hérité au point de fork (si délégation à un sous-agent qui hérite de la conversation) : ~X tokens`, incluse dans le total estimé.
2. **Skill `context-budget`** :
   - dans l'étape de mesure, un composant « Contexte hérité (délégations) » ;
   - la règle, formulée comme un mécanisme : « si l'héritage est actif, le coût d'une délégation = contexte parent au fork + travail propre ; si l'héritage est désactivé, le sous-agent doit recevoir explicitement l'Intent Statement et la SPEC active » ;
   - une ligne de diagnostic : « délégations tardives (contexte hérité > 50 % du total) → déléguer plus tôt dans la session ».
3. **`/sdd context`** : la table « Mesurer le contexte réel » gagne la ligne « Contexte hérité (délégations) ».
4. Aucune référence à une version d'outil ou de modèle : la règle est exprimée comme un mécanisme (doctrine v1.9, règle de datation).

### Output

- Commande, skill et gabarits à jour.

### Cas limites

1. Session sans délégation → la ligne vaut 0 ; le score de santé est inchangé par rapport à aujourd'hui.
2. SPEC existante dont le §6 n'a pas la nouvelle ligne → traitée comme 0 (aucune migration).
3. Harness où l'héritage n'existe pas → la règle « héritage désactivé » s'applique ; rien d'autre ne change.

## 3. Critères d'Acceptation

- [ ] CA-001 — Le §6 des deux gabarits contient la ligne « Contexte hérité au point de fork ».
- [ ] CA-002 — `context-budget/SKILL.md` contient la règle de coût d'une délégation (héritage actif / désactivé) et la ligne de diagnostic « contexte hérité > 50 % du total → déléguer plus tôt ».
- [ ] CA-003 — `/sdd context` contient la ligne « Contexte hérité (délégations) » dans la table de mesure.
- [ ] CA-004 — Aucune des lignes ajoutées ne contient de nom ou de numéro de version de modèle ou d'outil (grep).
- [ ] CA-005 — La formule du score de santé M1–M5 est inchangée (diff).
- [ ] CA-006 — Le script de parité de SPEC-033-1 passe (code 0).

## 4. Interface / API

```
Gabarit §6 — nouvelle ligne :
- Contexte hérité au point de fork (si délégation à un sous-agent qui hérite de la conversation) : ~X tokens
```

## 5. Dépendances

- SPEC-033-1 (parité), SPEC-033-2 (même gabarit, sections 8-9 déjà ajoutées).
- Parallélisable avec SPEC-033-3.

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~2 000 tokens
- Cette SPEC : ~1 300 tokens
- Fichiers source pertinents : `context.md`, `context-budget/SKILL.md`, deux gabarits
- **Total estimé** : ~7 000 tokens

## 7. Definition of Output Done (DoOD)

- [ ] Commande, skill, gabarits à jour
- [ ] Parité vérifiée (SPEC-033-1)
- [ ] SPEC mise à jour si écart (Drift Lock)
- [ ] Code review passée

## Historique des modifications
| 2026-09-26 | Execution Gate OUVERTE — SQS 5/5, Test de l'Étranger PASS. Statut → ready. | Scores validés par l'auteur. |
