---
id: SPEC-001-1
title: Feedback qualitatif opt-in — commande CLI et invitation périodique
parent_intent: INTENT-001
status: archived
format: prose
sqs: 4.4
author: Steeve Evers
date: "2026-05-29"
governance: AIAD-RGPD
archivedAt: "2026-06-24T07:31:15.518Z"
archivedBy: evers.steeve@gmail.com
archivedReason: archive done
---
# SPEC-001-1 — Feedback qualitatif opt-in

**Intent parent** : INTENT-001
**SQS** : 4.4 / 5
**Statut** : done
**Gouvernance** : AIAD-RGPD (consentement explicite, données minimales, droit à l'effacement)

## Objectif

Ajouter une commande `aiad-sdd feedback` permettant aux utilisateurs de soumettre des retours qualitatifs sur leurs frictions avec le framework, avec consentement RGPD explicite et invitation automatique périodique.

## Implémentation

- **Module** : `lib/feedback.js`
- **Entrée CLI** : `bin/aiad-sdd.js` — `case 'feedback'`
- **État persistant** : `~/.aiad-sdd/feedback.json`
- **Log local** : `~/.aiad-sdd/feedback-responses.jsonl`
- **Envoi distant** : GitHub Issues via `AIAD_FEEDBACK_GITHUB_TOKEN` ou `GITHUB_TOKEN` (fire-and-forget)

## Critères d'acceptation

1. `aiad-sdd feedback` lance une session interactive de 3 questions texte libre sur les frictions réelles (commande, workaround, artefact).
2. Le consentement RGPD est demandé une seule fois avant toute collecte (opt-in explicite, Art. 6 §1a RGPD) ; le refus est persisté et respecté.
3. `aiad-sdd feedback opt-out` désactive définitivement l'invitation automatique et la commande directe.
4. `aiad-sdd feedback opt-in` réactive le consentement.
5. `aiad-sdd feedback status` affiche l'état courant : consentement, compteur de sessions, numéro de session de la prochaine invitation, présence d'un token GitHub.
6. Une invitation automatique `[O]ui / [N]on / [J]amais` s'affiche toutes les 15 sessions consécutives, uniquement sur un TTY interactif, après la fin d'une commande (non bloquant).
7. La réponse `[J]amais` à l'invitation persiste `consent: false` — plus aucune invitation future.
8. Les réponses sont stockées localement dans `~/.aiad-sdd/feedback-responses.jsonl` (append-only, JSONL).
9. Si `AIAD_FEEDBACK_GITHUB_TOKEN` ou `GITHUB_TOKEN` est présent, une issue GitHub est créée sur `everssteeve/sdd-mode` (configurable via `AIAD_FEEDBACK_GITHUB_REPO`), avec timeout 5 s et silencieux en cas d'échec.
10. Toute erreur réseau, d'écriture FS ou d'entrée utilisateur est silencieuse — aucune commande principale n'est bloquée ou dégradée.

## Données collectées

```json
{
  "anonymousId": "uuid-v4",
  "version": "1.14.0",
  "timestamp": "ISO-8601",
  "responses": [
    { "question": "...", "answer": "..." }
  ]
}
```

Aucun chemin projet, aucune IP côté client, aucun identifiant personnel. UUID réutilisé depuis la télémétrie si opt-in, sinon UUID local dédié stocké dans `feedback.json`.

## Contraintes RGPD

- Consentement distinct de la télémétrie (`telemetry.json` ≠ `feedback.json`)
- Droit à l'effacement : `opt-out` supprime le consentement ; le JSONL local reste sous contrôle de l'utilisateur
- Données minimales : pas de métadonnées d'environnement, pas de stacktrace, pas de chemins FS
