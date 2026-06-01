---
id: SPEC-101-1
title: Formulaire de paiement v2
parent_intent: INTENT-101
status: done
format: prose
sqs: 4.6
author: Steeve
date: 2026-04-10
governance: AIAD-RGPD, AIAD-RGAA
---

# SPEC-101-1-formulaire-paiement

**Intent parent** : INTENT-101
**SQS** : 4.6 / 5
**Statut** : done

## Objectif

Refondre le formulaire de paiement en v2 mobile-first avec validation
inline et fallback offline.

## Critères d'acceptation

1. Le formulaire passe à la phase 2 (paiement) en < 800 ms.
2. La validation côté client signale les erreurs en < 250 ms.
3. La compatibilité mobile (iOS 16+, Android 12+) est testée.
