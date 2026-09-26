# SPEC-[NNN]-[nom-court]

**Intent parent** : INTENT-[NNN]
**Auteur** : [PE]
**Date** : [YYYY-MM-DD]
**Statut** : draft
**Format** : prose
**SQS** : [À évaluer via /sdd gate]

---

## 1. Contexte

[Résumé Intent parent — 2-3 phrases max]

## 2. Comportement Attendu

### Input

[Schéma / type / source]

### Processing

[Étapes du traitement]

### Output

[Schéma / format / destination]

### Cas limites

[≥ 3 edge cases explicites]

## 3. Critères d'Acceptation

- [ ] CA-001 — [Critère testable, observable, mesurable]
- [ ] CA-002 — [Critère testable, observable, mesurable]
- [ ] CA-003 — [Critère testable, observable, mesurable]

<!-- Ajoute autant de critères que nécessaire. Chaque CA doit être vérifiable automatiquement. -->

## 4. Interface / API

```
[Signature, endpoint, schéma — précis, pas indicatif]
```

## 5. Dépendances

- [Module / service / SPEC parente]

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~X tokens
- Cette SPEC : ~X tokens
- Fichiers source pertinents : [liste]
- **Total estimé** : ~X tokens

## 7. Definition of Output Done (DoOD)

- [ ] Code + lint passing
- [ ] Tests unitaires sur cas limites
- [ ] SPEC mise à jour si écart (Drift Lock)
- [ ] Annotations machine-vérifiables posées (`@spec`, `@verified-by`, …)
- [ ] Code review passée
- [ ] Gouvernance vérifiée (AI-ACT / RGPD / RGAA / RGESN si applicable)

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

## Historique des modifications

<!-- Ajouté à la première modification. Un item par delta, ordre chronologique. -->
<!-- - YYYY-MM-DD [auteur] — description (déclencheur : FACT-NNN | décision PE | exécution) -->
