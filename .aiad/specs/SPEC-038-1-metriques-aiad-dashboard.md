---
id: SPEC-038-1
title: Métriques AIAD dans le dashboard — catalogue, calcul, cibles, alimentation
parent_intent: INTENT-038
status: ready
format: prose
sqs: 4
author: Steeve Evers
date: "2026-11-15"
---

# SPEC-038-1-metriques-aiad-dashboard

**Intent parent** : INTENT-038
**Research** : non conduite (voir INTENT-038)
**Auteur** : Steeve Evers *(rédaction : agent, 2026-11-15)*
**Date** : 2026-11-15
**Statut** : ready — implémentée sur demande de l'auteur, puis validée par lui le 2026-11-15
**Format** : prose
**SQS** : 4/5 — évalué par l'agent, **validé par l'auteur le 2026-11-15** (point faible : Non-ambiguïté, voir § 5)

---

## 1. Contexte

Le framework AIAD définit des métriques (chapitre 7) que le dashboard n'affichait qu'en petite partie, sans cible. Cette SPEC les fait toutes apparaître, avec leur cible et leur état, et donne un moyen d'alimenter celles qui n'avaient pas de source.

### Contexte pour un lecteur extérieur

Les rituels et commandes AIAD écrivent des fichiers dans `.aiad/metrics/<catégorie>/` (`deployments/`, `specs/`, `retro/`, `demo/`, `sync-strat/`, `tech-review/`, `standup/`…), sous la forme `clé: valeur`. Le dashboard les lit dans `donnees.metrics.categories`.

## 2. Comportement Attendu

1. **Catalogue** (`lib/dashboard/aiad-metrics.js`) : 38 métriques en 7 catégories — Productivité (5), Qualité (6), Efficacité IA (7), Outcomes (6), Équipe (5), DORA (4), Flow (5). Chacune porte son libellé, sa cible telle qu'écrite dans le framework, sa fréquence, et la manière de l'alimenter. Chaque catégorie est rattachée à l'onglet de la responsabilité qui la suit : Productivité → PE, Qualité → QA, Efficacité IA → AE, Outcomes → PM, Équipe → vue d'ensemble, DORA et Flow → Tech Lead.
2. **Calcul** depuis les données collectées, sans nouvelle lecture disque.
3. **État** de chaque métrique :

   | État | Condition |
   |------|-----------|
   | dans la cible | cible chiffrée respectée (comparaison stricte), ou tendance conforme à la période précédente |
   | hors cible | cible chiffrée non respectée, ou tendance contraire |
   | mesuré | valeur disponible sans cible chiffrée, ou tendance sans période précédente |
   | non mesuré | aucune donnée |
   | hors dashboard | métrique du framework que l'outil ne collecte pas |

4. **Affichage** :
   - page « Métriques AIAD » (`scorecard.html`, onglet Vue d'ensemble) : toutes les métriques par catégorie, filtre « dashboard hebdomadaire » / « dashboard mensuel » ;
   - vue d'ensemble : une carte par catégorie (mesurées / suivies, dans la cible, hors cible) ;
   - chaque cockpit de rôle : les métriques de sa responsabilité.
5. **Alertes** : les trois signaux d'action immédiate du framework (§ 7.6) — Cycle Time qui double, score qualité des SPECs sous 3,5 / 5, Change Failure Rate au-dessus de 15 %.
6. **Alimentation** des métriques sans source :
   - `/aiad retro` demande à l'équipe les métriques déclaratives d'Efficacité IA et d'Équipe ;
   - `/aiad sync-strat` reçoit du PM les métriques d'Outcomes ;
   - `mttd_hours` s'ajoute au fichier d'un déploiement en échec.
   L'agent pose la question et n'estime jamais la réponse ; sans réponse, `null`.
7. **Données sensibles** : turnover et jours de maladie figurent au catalogue, à l'état « hors dashboard ». Aucune clé ne permet de les saisir ; une clé de ce nom présente dans un fichier est ignorée.

### Cas limites

1. Aucune donnée, ou données absentes → toutes les métriques « non mesuré », aucune exception.
2. Valeur égale au seuil → hors cible (les cibles du framework sont strictes).
3. `null` ou texte dans une clé numérique → ignoré ; la dernière valeur numérique déclarée reste.
4. Flow Efficiency : calculée seulement sur les déploiements qui portent les deux durées ; sinon non mesurée.
5. Signal « Cycle Time doublé » : au moins quatre déploiements mesurés.
6. Contenu d'un fichier de métriques contenant du HTML → échappé.

## 3. Critères d'Acceptation

- [x] CA-001 — Sept catégories, chacune rattachée à un onglet existant (test).
- [x] CA-002 — Nombre de métriques par catégorie conforme au framework ; chaque métrique a libellé, cible, fréquence, alimentation (test).
- [x] CA-003 — Sans donnée : tout est « non mesuré », aucune valeur (test).
- [x] CA-004 — Turnover et jours de maladie jamais collectés, même si une clé existe (test).
- [x] CA-005 — Productivité, DORA, Flow calculés depuis les déploiements (test).
- [x] CA-006 — Seuils stricts (test).
- [x] CA-007 — Métriques déclarées en rétrospective : dernière valeur, `null` ignoré (test).
- [x] CA-008 — Tendances comparées à la période précédente (test).
- [x] CA-009 — Couverture, premier passage à la Gate, critères du PRD, satisfaction utilisateur (test).
- [x] CA-010 — Synthèse par catégorie (test).
- [x] CA-011 — Trois signaux d'action immédiate, remontés en alertes (test).
- [x] CA-012 à CA-014 — Page, synthèse, cockpits (tests).
- [x] CA-015 — Contenu échappé (test).
- [x] CA-016 — `npm test`, lints et budgets de poids passent.

## 4. Gouvernance

- **RGPD** : les métriques d'équipe saisies sont des moyennes déclarées en rétrospective, jamais une réponse individuelle ni un nom. Dans une équipe de moins de quatre personnes, une moyenne peut révéler une réponse : la commande `/aiad retro` le dit et laisse l'équipe décider. Turnover et jours de maladie — données RH et de santé — ne sont pas collectés.
- **RGAA** : tableaux avec en-têtes, états portés par un libellé et non par la seule couleur.
- **RGESN** : calcul sur les données déjà collectées ; budget de poids déclaré pour la nouvelle page.

## 5. Limites connues

- **Lecture de l'objectif.** « Les métriques qu'expose AIAD » a été lu comme le chapitre 7 du framework. Si l'auteur visait un autre périmètre (l'annexe E, par exemple), le catalogue est à ajuster.
- **Critère de drift de l'Intent non levé pour toutes les métriques.** L'auteur a fixé le drift à « les métriques ne sont pas outillées correctement et ne retournent pas les infos dans le dashboard ». Cette SPEC affiche toutes les métriques et donne un moyen de les saisir ; elle n'instrumente pas celles qui restent déclaratives.
- **Dix métriques sont déclaratives.** Efficacité IA (sauf le premier passage) et Équipe reposent sur ce que l'équipe déclare en rétrospective : ce ne sont pas des mesures instrumentées.
- **Cibles « selon produit ».** Time to Value (< 5 min) et Retention (> 80 %) sont évaluées sur la cible générique du framework, que celui-ci dit dépendre du produit.
- **Cibles non chiffrées.** Release Frequency, Deployment Frequency, WIP, Flow Efficiency et Business Impact n'ont pas de seuil dans le framework : elles s'affichent « mesuré », sans jugement.
- **« Bugs en production »** est approché par le nombre de FACTs datés sur 90 jours — un FACT n'est pas toujours un bug de production.
- **Clés nouvelles.** `adoption_agents_pct`, `code_genere_pct`, `iterations_par_feature`, `faux_positifs_pct`, `resolution_agents_heures`, `satisfaction_pe`, `satisfaction_equipe`, `psychological_safety`, `temps_flow_heures`, `adoption_pct`, `time_to_value_min`, `retention_pct`, `business_impact`, `mttd_hours` ont été nommées par l'agent.
- **Poids de la vue d'ensemble.** `index.html` est à 29,7 Ko pour un budget de 30 : elle le dépassera dès que les données du projet grossiront.

## 6. Definition of Output Done (DoOD)

- [x] Code + lint passing
- [x] Tests CA-001 à CA-015
- [x] Annotations `@intent INTENT-038` / `@spec SPEC-038-1-metriques-aiad-dashboard`
- [x] SPEC et code dans le même changement (Drift Lock)
- [x] SPEC validée par l'auteur (2026-11-15, après implémentation)
- [x] Gouvernance vérifiée (§ 4)

## Historique des modifications

| Date | Changement | Raison |
|------|------------|--------|
| 2026-11-15 | Création et implémentation dans la même session. SQS auto-évalué 4/5 (Non-ambiguïté 0 : le périmètre « métriques qu'expose AIAD » est une lecture de l'agent). | Consigne de l'auteur du 2026-11-15. |
| 2026-11-15 | Validation par l'auteur (« je valide les deux »), en l'état. Statut → ready. Critère de drift de l'Intent déclaré levé par l'auteur. | Réponse de l'auteur. |
