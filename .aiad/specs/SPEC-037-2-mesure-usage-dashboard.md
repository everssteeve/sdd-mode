---
id: SPEC-037-2
title: Mesure d'usage locale du dashboard — rendre le critère de drift constatable
parent_intent: INTENT-037
status: ready
format: prose
sqs: 5
author: Steeve Evers
date: "2026-11-15"
---

# SPEC-037-2-mesure-usage-dashboard

**Intent parent** : INTENT-037
**Auteur** : Steeve Evers *(rédaction : agent, 2026-11-15)*
**Statut** : ready — demande de l'auteur du 2026-11-15 : « mets en place la mesure »
**Format** : prose
**SQS** : 5/5 — auto-évaluation de l'agent

## 1. Contexte

Le critère de drift d'INTENT-037 est « le dashboard n'est pas utilisé ». Le dashboard étant un site statique, rien ne permettait de le constater. Cette SPEC ajoute une mesure locale, sans télémétrie.

## 2. Comportement Attendu

1. Le serveur local (`aiad-sdd dashboard --serve`, `standup --serve`) compte chaque page HTML servie dans `.aiad/metrics/dashboard-usage/AAAA-MM.json` : par jour, un nombre de vues et sa répartition par onglet.
2. **Données enregistrées** : le jour, un compteur, l'identifiant d'onglet. **Jamais** : adresse IP, navigateur, identité, heure, URL complète. Rien ne quitte la machine.
3. Désactivation : variable d'environnement `AIAD_DASHBOARD_USAGE=0`.
4. `collecterDonnees` expose `usage` : vues et jours actifs sur 30 jours, date de la dernière consultation, répartition par onglet.
5. Au-delà de **14 jours** sans consultation mesurée, une alerte « Dashboard non consulté depuis N jours » apparaît (vue d'ensemble, pastille de l'onglet).
6. La vue d'ensemble affiche un indicateur « Consultations (30 j) » ; `aiad-sdd dashboard` affiche une ligne `Usage`.
7. **Non mesuré n'est pas non utilisé** : sans aucune donnée, l'indicateur affiche « — » et aucune alerte n'est levée.

### Cas limites

1. Assets, `data.json`, `404.html`, chemin avec sous-dossier ou `..` → non comptés.
2. Fichier de mesure illisible → toléré, réécrit à la vue suivante.
3. Projet sans `.aiad/` → rien n'est écrit.
4. Une mesure qui échoue (disque plein, droits) n'empêche jamais de servir la page.
5. Serveur lancé sans `usageDir` (tests, intégrations) → aucune mesure.

## 3. Critères d'Acceptation

- [x] CA-001 — Vue comptée par jour et par onglet, un fichier par mois (test).
- [x] CA-002 — Le fichier ne contient que `schema` et `jours` ; ni IP, ni navigateur, ni heure (test).
- [x] CA-003 — Non comptés : assets, 404, chemins suspects, projet sans `.aiad/`, mesure désactivée (test).
- [x] CA-004 — Fenêtre de 30 jours, dernière consultation, seuil de 14 jours (test).
- [x] CA-005 — Fichier illisible toléré (test).
- [x] CA-006 — Alerte seulement sur mesure ; non mesuré ≠ non utilisé (test).
- [x] CA-007 — Phrase d'état (test).
- [x] CA-008 — Le serveur compte les pages servies, et seulement si `usageDir` est fourni (test).

## 4. Gouvernance

- **RGPD** : aucune donnée personnelle n'est collectée — pas d'identifiant, pas d'adresse IP, pas d'horodatage fin ; des compteurs agrégés par jour. Pas de traitement au sens du règlement. Si le fichier est versionné, il révèle l'activité de l'équipe au jour près, pas celle d'une personne ; sur un poste individuel, il reflète de fait l'activité de son utilisateur — à garder hors dépôt si cela pose question.
- **RGESN** : un fichier JSON par mois, quelques octets par jour ; aucune requête réseau.

## 5. Limites connues

- **Seul le serveur local mesure.** Un dashboard ouvert en fichier statique ou publié (GitHub Pages) n'est pas compté.
- **La mesure est par machine** tant que le fichier n'est pas partagé. Versionné, il peut produire des conflits de fusion quand deux personnes consultent le même jour.
- **Une vue n'est pas un usage utile.** Le compteur dit que le dashboard est ouvert, pas qu'il sert à décider. Le jugement reste à l'équipe, en rétrospective.
- **L'alerte s'affiche dans le dashboard lui-même** : si personne ne l'ouvre, personne ne la voit. Elle est doublée par la ligne `Usage` de la commande `aiad-sdd dashboard`.

## Historique des modifications

| Date | Changement | Raison |
|------|------------|--------|
| 2026-11-15 | Création et implémentation. Seuil de 14 jours et fenêtre de 30 jours posés par l'agent, à ajuster par l'auteur. | Demande de l'auteur : rendre le critère de drift mesurable. |
