---
id: INTENT-001
title: Feedback qualitatif utilisateurs SDD Mode
status: done
author: Steeve Evers
date: 2026-05-29
specs: SPEC-001-1
---

# INTENT-001 — Feedback qualitatif utilisateurs SDD Mode

## Pourquoi

Le framework SDD Mode évolue sans retour terrain structuré. Les décisions de roadmap reposent sur des intuitions, pas sur des données d'usage. On ignore quelles commandes cassent les flows, quels workarounds émergent, quels artefacts génèrent du retravail.

## Intention

Recueillir des retours qualitatifs opt-in auprès des utilisateurs du framework pour identifier les frictions réelles et alimenter les décisions d'évolution avec des données terrain plutôt que des suppositions.

## Périmètre

- Feedback via 3 questions texte libre ciblant les frictions concrètes (commandes, workarounds, artefacts)
- Consentement RGPD explicite, distinct de la télémétrie
- Invitation périodique non intrusive (toutes les 15 sessions, TTY uniquement)
- Commande directe `aiad-sdd feedback` toujours disponible

## Hors périmètre

- Télémétrie passive (usage patterns, métriques comportementales) — fait l'objet d'un intent séparé
- Dashboard d'analyse des feedbacks reçus
- Système de notation (NPS, étoiles) — délibérément exclu (mesure la satisfaction, pas les frictions)
