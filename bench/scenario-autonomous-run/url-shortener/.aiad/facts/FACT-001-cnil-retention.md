---
id: FACT-001
title: Logs analytics conservés au-delà des 13 mois CNIL
date: 2026-05-05
severity: major
status: open
cause: Job de purge des logs analytics non programmé en cron
---

# FACT-001 — Logs analytics conservés au-delà des 13 mois CNIL

**Date** : 2026-05-05
**Gravité** : major
**Statut** : open

## Cause

Le job de purge des logs analytics qui devait s'exécuter mensuellement
n'a pas été programmé en cron lors du déploiement initial. Conséquence :
les logs sont restés au-delà des 13 mois autorisés par la CNIL.

## Mitigation

Mettre en place le cron `purge-logs.sh` exécuté le 1er de chaque mois
avec rétention 13 mois glissants.
