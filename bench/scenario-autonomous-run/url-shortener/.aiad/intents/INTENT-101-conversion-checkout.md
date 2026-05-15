---
id: INTENT-101
title: Améliorer la conversion du checkout
status: active
author: Steeve
date: 2026-04-01
activated_at: 2026-04-01
priority: P0
target: Q2-2026
target_date: 2026-05-25
owner: Steeve
sponsor: Direction Sales
personas:
  - Acheteur SMB
user_stories:
  - US-002
outcomes:
  - Conversion checkout
---

# INTENT-101-conversion-checkout

**Auteur** : Steeve
**Date** : 2026-04-01
**Statut** : active

---

## POURQUOI MAINTENANT

Le funnel checkout chute à 62 % de conversion sur la dernière mesure mensuelle.
Sponsor sales a remonté la friction lors du COMEX du 28/03.

## POUR QUI

Acheteurs récurrents EU (segment SMB), exposés au formulaire de paiement v1.

## OBJECTIF

Remonter le taux de conversion checkout > 70 % en 4 semaines, mesuré par
analytics interne (cohorte hebdomadaire glissante).

## CONTRAINTES

- RGPD (pas de nouveau cookie de tracking sans consentement)
- Pas de nouveau provider de paiement à intégrer
- Compatible mobile-first

## CRITÈRE DE DRIFT

Si après 4 semaines la conversion reste < 65 % sur 7 jours glissants → drift
confirmé : l'objectif n'a pas été atteint et il faut investiguer la cause
profonde avant tout nouveau chantier checkout.

---

## SPECs liées

- [x] SPEC-101-1-formulaire-paiement
- [ ] SPEC-101-2-relance-panier
