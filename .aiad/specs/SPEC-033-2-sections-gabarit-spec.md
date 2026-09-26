---
id: SPEC-033-2
title: Gabarit de SPEC — sections « Points d'arrêt de l'agent » (optionnelle) et « Périmètre d'exécution de l'agent » (conditionnelle)
parent_intent: INTENT-033
status: ready
format: prose
sqs: 5
author: Steeve Evers
date: "2026-09-25"
traceability: exempt
traceability_reason: "Livrable éditorial — gabarits Markdown et commande /sdd spec, sans code applicatif annotable."
---

# SPEC-033-2-sections-gabarit-spec

**Intent parent** : INTENT-033
**Research** : RESEARCH-040 — GO (auteur) → CONDITIONAL GO (machine)
**Auteur** : Steeve Evers *(rédaction : agent, 2026-09-25 — à valider à la Gate)*
**Date** : 2026-09-25
**Statut** : ready
**Format** : prose
**SQS** : 5/5 — Execution Gate OUVERTE (2026-09-26), Test de l'Étranger PASS

---

## 1. Contexte

La doctrine AIAD v1.9 (Framework, § 4.4 et annexe A.4) introduit deux sections de SPEC : « Points d'arrêt de l'agent » (optionnelle) et « Périmètre d'exécution de l'agent » (requise seulement si l'agent dispose de credentials ou d'un accès en écriture à une ressource partagée). Le pré-contrôle déterministe de la Gate (SPEC-033-3) les lit : cette SPEC en fixe le **format exact**, lisible par une machine.

## 2. Comportement Attendu

### Input

- Gabarits : `templates/.aiad/specs/spec-ears-template.md` et `.aiad/specs/spec-ears-template.md` (EARS, livré / dépôt), `.aiad/specs/spec-template.md` (prose, dépôt).
- Commande : `templates/.claude/sdd/spec.md` (et son exemplaire `.claude/`, identique après SPEC-033-1).

### Processing

1. Ajouter aux trois gabarits, **immédiatement après la section « 7. Definition of Output Done (DoOD) »** (donc avant « Anti-patterns EARS » ou « Historique des modifications », selon le gabarit), deux sections au format exact :

```markdown
## 8. Points d'arrêt de l'agent (optionnel)

| Type de point d'arrêt | Déclencheur dans cette SPEC |
|-----------------------|-----------------------------|
| Approbation | [action hors mandat ou irréversible] |
| Avis d'expert | [décision qui dépasse la SPEC] |
| Pluralité de points de vue | [interprétations plausibles de l'intention] |
| Témoin | [décision notable à porter à la connaissance de l'humain] |

## 9. Périmètre d'exécution de l'agent (conditionnel)

<!-- Requis si l'agent dispose de credentials ou d'un accès en écriture à une ressource partagée. Sinon : « Non applicable ». -->

| Élément | Déclaration |
|---------|-------------|
| Isolation | [processus / conteneur / VM] |
| Sorties réseau autorisées | [aucune / liste de domaines] |
| Credentials présents | [liste, portée, durée de vie — ou « aucun »] |
| Ressources partagées en écriture | [liste — ou « aucune »] |
| Actions irréversibles possibles | [liste + classe de réversibilité — ou « aucune »] |
| Seuil d'arrêt | [condition d'arrêt immédiat — requis si une action irréversible est déclarée] |
```

2. Livrer le gabarit prose : copier `.aiad/specs/spec-template.md` (mis à jour) dans `templates/.aiad/specs/spec-template.md` (aujourd'hui absent du package).
3. Dans `/sdd spec` (les deux exemplaires) : une ligne indiquant que la section 9 est requise si la SPEC implique credentials ou ressource partagée en écriture, sinon « Non applicable » ; la section 8 est facultative.

### Output

- Deux gabarits à jour ; `templates/.aiad/specs/spec-template.md` livré ; `/sdd spec` à jour.

### Cas limites

1. SPEC existante sans sections 8 et 9 → reste valide (aucune migration des 67 SPEC archivées).
2. Section 9 présente avec la seule mention « Non applicable » → valide.
3. Numérotation : une SPEC qui aurait déjà une section 8 différente → les titres sont reconnus **par leur libellé**, pas par leur numéro (règle reprise par SPEC-033-3).

## 3. Critères d'Acceptation

- [ ] CA-001 — Les trois gabarits contiennent les titres exacts `## 8. Points d'arrêt de l'agent (optionnel)` et `## 9. Périmètre d'exécution de l'agent (conditionnel)` et les six lignes du tableau de la section 9, dans l'ordre ci-dessus.
- [ ] CA-002 — `templates/.aiad/specs/spec-template.md` existe et est identique à `.aiad/specs/spec-template.md`.
- [ ] CA-003 — `/sdd spec` (les deux exemplaires) mentionne la règle « section 9 requise si credentials ou ressource partagée en écriture, sinon Non applicable ».
- [ ] CA-004 — Le script de parité de SPEC-033-1 passe (code 0).
- [ ] CA-005 — `npm test` passe sans régression.

## 4. Interface / API

```
Titres reconnus (libellé, insensible à la casse, numéro facultatif) :
  « Points d'arrêt de l'agent »
  « Périmètre d'exécution de l'agent »
Lignes de la section 9 (libellé exact en 1re colonne) :
  Isolation | Sorties réseau autorisées | Credentials présents |
  Ressources partagées en écriture | Actions irréversibles possibles | Seuil d'arrêt
```

## 5. Dépendances

- SPEC-033-1 (fichiers de commandes resynchronisés).
- Bloque SPEC-033-3 (lit ce format) et SPEC-033-4 (modifie le même gabarit, §6).

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~2 000 tokens
- Cette SPEC : ~1 500 tokens
- Fichiers source pertinents : deux gabarits, `spec.md` (×2)
- **Total estimé** : ~6 000 tokens

## 7. Definition of Output Done (DoOD)

- [ ] Gabarits et commande à jour
- [ ] Parité vérifiée (SPEC-033-1)
- [ ] SPEC mise à jour si écart (Drift Lock)
- [ ] Code review passée

## Historique des modifications

| Date | Changement | Raison |
|------|------------|--------|
| 2026-09-25 | Gate (1er passage) : gabarits listés explicitement (trois, dont l'exemplaire EARS du dépôt) ; point d'insertion défini par rapport à la section DoOD. | Le gabarit EARS livré n'a pas de section « Historique des modifications » : l'ancien point d'insertion était indéfini. |
| 2026-09-26 | Execution Gate OUVERTE — SQS 5/5, Test de l'Étranger PASS. Statut → ready. | Scores validés par l'auteur. |
