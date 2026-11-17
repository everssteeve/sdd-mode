---
id: SPEC-036-3
title: Hook drift-lock — ne plus bloquer la clôture quand la CLI ne produit aucun verdict
parent_intent: INTENT-036
status: ready
format: prose
sqs: 5
author: Steeve Evers
date: "2026-11-15"
---

# SPEC-036-3-drift-lock-cli-absente

**Intent parent** : INTENT-036
**Auteur** : Steeve Evers *(rédaction : agent, 2026-11-15)*
**Statut** : ready — décision de l'auteur du 2026-11-15 : « hook à corriger »
**Format** : prose
**SQS** : 5/5 — auto-évaluation de l'agent

## 1. Contexte

Constat du 2026-11-15, lors de l'essai de `aiad-pe` : dans un projet où `aiad-sdd` n'est pas installé localement, `npx --no-install aiad-sdd` échoue ; le hook Stop `drift-lock` lisait une sortie vide, concluait à un échec et bloquait la clôture avec « 0 gap(s) bloquant(s) ». Le modèle, réveillé sans rien pouvoir corriger, a tourné 16 tours.

## 2. Comportement Attendu

1. Si la CLI ne produit **aucun verdict** (enveloppe JSON sans champ `verdict`), le hook ne bloque pas : il sort en 0 et émet un `systemMessage` qui dit que le Drift Lock n'a pas été vérifié et comment installer la CLI.
2. Les verdicts réels gardent leur effet : `PASS` → clôture ; `FAIL` → blocage avec la liste des gaps ; `JNSP` → blocage (fail-closed inchangé).

### Cas limites

1. CLI présente mais qui plante sans sortie → traité comme « aucun verdict ».
2. Projet sans `.aiad/`, ou `AIAD_HOOK_SILENT=1` → aucune sortie, clôture autorisée (inchangé).

## 3. Critères d'Acceptation

- [x] CA-001 — CLI introuvable : exit 0, `systemMessage`, pas de `decision` (test).
- [x] CA-002 — CLI en échec sans verdict : exit 0 (test).
- [x] CA-003 — `FAIL` avec gap bloquant : exit 2, gap listé (test).
- [x] CA-004 — `JNSP` : exit 2 (test).
- [x] CA-005 — `PASS`, projet sans `.aiad/`, hook silencieux : exit 0 sans sortie (test).

## 4. Limites connues

- Ce correctif retire un blocage quand le contrôle ne peut pas s'exécuter : le Drift Lock n'est alors pas appliqué à la clôture. Le pre-commit et la CI `sdd-trace` restent les garde-fous ; l'humain est prévenu à chaque clôture.
- Les autres hooks qui résolvent la CLI de la même façon (`discovery-gate`, `veto`) n'ont pas été modifiés.

## Historique des modifications

| Date | Changement | Raison |
|------|------------|--------|
| 2026-11-15 | Création et implémentation. | Décision de l'auteur après le constat de l'essai. |
