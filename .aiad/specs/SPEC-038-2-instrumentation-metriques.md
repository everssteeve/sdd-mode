---
id: SPEC-038-2
title: Instrumentation des métriques AIAD — sources automatiques, enregistrement contrôlé, fraîcheur, rituels
parent_intent: INTENT-038
status: ready
format: prose
sqs: 4
author: Steeve Evers
date: "2026-11-15"
---

# SPEC-038-2-instrumentation-metriques

**Intent parent** : INTENT-038
**Auteur** : Steeve Evers *(rédaction : agent, 2026-11-15)*
**Statut** : ready — implémentée sur demande de l'auteur, puis validée par lui le 2026-11-15
**Format** : prose
**SQS** : 4/5 — évalué par l'agent, **validé par l'auteur le 2026-11-15** (point faible : Atomicité — deux chantiers dans une SPEC)

---

## 1. Contexte

Le critère de drift d'INTENT-038 est : « les métriques ne sont pas outillées correctement et ne retournent pas les infos dans le dashboard ». Après SPEC-038-1, 13 métriques sur 36 remontaient sur le projet `aiad-sdd`. Cette SPEC traite les deux causes : des métriques calculables sans source automatique, et des métriques déclaratives sans outillage ni suivi.

## 2. Comportement Attendu

### Chantier 1 — ce qui remonte sans saisie humaine

1. **Couverture de tests** : lue dans le rapport que produit déjà l'outil de test — `.aiad/metrics/tests/coverage-summary.json`, puis `coverage/coverage-summary.json`, puis `.aiad/metrics/coverage/badge.json`.
2. **Dette technique** : lue dans les instantanés quotidiens du dashboard (`.aiad/metrics/tech-debt/`) — TODO-JNSP ouverts + SPECs trop grosses — avec tendance sur l'instantané précédent. À défaut, l'inventaire déclaré en Tech Review.
3. **Taux d'adoption des agents** et **ratio code généré / manuel** : mesurés sur l'historique git des 30 derniers jours — part des commits, et des lignes ajoutées, dont un co-auteur est un agent. À défaut de dépôt git, la valeur déclarée en rétrospective. Seuls des totaux sont produits ; aucun nom, aucune adresse.
4. **MTTR / MTTD** : sans déploiement en échec, l'information affichée est « aucun incident ».
5. **First-Time Success Rate** : chaque `/sdd gate` enregistre son passage ; le nombre de passages par SPEC est compté par la commande. À défaut d'enregistrement, il est lu dans l'historique des SPECs (lignes datées mentionnant la Gate ; premier passage réussi = la première porte « OUVERTE »).
5 bis. **First-Time Success Rate des agents** et **itérations par fonctionnalité** : chaque `/sdd validate` enregistre son verdict (`valide`, `corrections`, `echec`) ; une SPEC validée dès son premier passage compte comme un succès de l'agent au premier essai, et le nombre de passages par SPEC donne les itérations.
5 ter. **Flow Efficiency** : à défaut de déploiement portant les deux durées, rapport des moyennes Cycle Time / Lead Time ; si le Cycle Time moyen dépasse le Lead Time moyen, la métrique affiche l'incohérence et passe « hors cible ».

### Chantier 2 — les métriques déclaratives, outillées et suivies

6. **`aiad-sdd metrics record <catégorie> clé=valeur…`** écrit un fichier valide dans `.aiad/metrics/<catégorie>/` : clés connues seulement, nombres bornés (pourcentages 0–100, notes 0–10), valeurs énumérées contrôlées, `null` accepté, jamais d'écrasement. Les clés de turnover et de jours de maladie sont refusées. Les rituels `/aiad retro`, `/aiad sync-strat`, `/aiad demo` et `/sdd gate` l'appellent.
7. **Fraîcheur** : une valeur déclarée plus ancienne que deux périodes de sa fréquence (14 j en hebdomadaire, 62 j en mensuel) passe à l'état « à rafraîchir ».
8. **Rituels** : pour la rétrospective (21 j), la démo (14 j), la synchronisation stratégique (35 j) et la Tech Review (35 j), le dashboard affiche le dernier enregistrement et l'état — à jour, en retard, jamais enregistré.
9. **Alertes** : « N métriques AIAD ne remontent pas », « N métriques à rafraîchir », « <rituel> en retard ».
10. **`aiad-sdd metrics status`** affiche l'état de pilotage ; **`aiad-sdd metrics check`** sort en 1 tant qu'une métrique ne remonte pas, qu'une valeur est périmée ou qu'un rituel est en retard. `--json` pour les intégrations.
11. Chaque valeur affichée porte sa **source** (git, instantané, rapport, historique des SPECs, « déclaré — retro »).
12. **Périmètre** : `aiad-sdd metrics exclude <id> raison=… auteur=…` déclare une métrique non applicable au projet ; `include <id>` l'annule. Une raison et un auteur humain sont exigés ; la décision est tracée dans `.aiad/metrics/scope.json`, affichée dans le dashboard, et la métrique sort du suivi. Un agent n'écarte jamais une métrique de lui-même.
13. **Report** : `aiad-sdd metrics defer <id> raison=… auteur=… [jusqu=AAAA-MM-JJ]` laisse une métrique sans valeur jusqu'à une échéance, par décision d'un humain nommé. Échéance par défaut : la cadence du rituel qui alimente la catégorie (21 jours pour Efficacité IA et Équipe, 35 pour Outcomes) ; 92 jours au plus. La métrique s'affiche « en attente », avec la raison, l'auteur et l'échéance ; elle n'est pas comptée comme mesurée, mais n'est plus un drift. Passé l'échéance, elle redevient « non mesurée » et `metrics check` échoue de nouveau. Une valeur enregistrée l'emporte sur le report. `undefer <id>` l'annule.

### Cas limites

1. Rapport de couverture illisible ou non numérique → non mesuré.
2. Pas de dépôt git, ou aucun commit sur 30 jours → on retombe sur la valeur déclarée.
3. Deuxième enregistrement le même jour → fichier suffixé `-2`.
4. Deux SPECs dont l'identifiant de l'une préfixe l'autre → passages comptés séparément.
5. Rituel jamais enregistré → « jamais enregistré », pas « en retard » ; ses métriques sont « non mesurées ».
6. Jeu de données sans catégories de métriques (tests, intégrations) → aucune alerte de pilotage.

## 3. Critères d'Acceptation

- [x] CA-001 à CA-004 — Sources instrumentées : couverture, dette, journal git, absence de dépôt (tests `metrics-sources`).
- [x] CA-005 à CA-008 — Enregistrement : fichier lisible par le dashboard, refus motivés sans écriture, passages de Gate comptés, pas d'écrasement (tests `metrics`).
- [x] CA-009 — Ce qui est enregistré remonte ; le drift recule à mesure (test).
- [x] CA-010 — CLI : `record`, `status --json`, `check` (exit 1 en drift), `keys`, erreurs (test).
- [x] CA-011 à CA-015 — Mesuré avant déclaré avec source, dette par instantanés, péremption, rituels, pilotage et alertes (tests `dashboard-aiad-metrics`).
- [x] CA-016 à CA-019 — Validations enregistrées, périmètre (raison et auteur exigés), Gate lue dans l'historique des SPECs (tests `metrics`, `metrics-sources`).
- [x] CA-021 à CA-024 — Reports : raison, auteur et échéance bornée exigés ; « en attente » tracé ; report échu ; CLI et `check` (tests `metrics`).
- [x] CA-020 — `npm test`, lints et budgets de poids passent.

## 4. Gouvernance

- **RGPD** : l'analyse git ne conserve ni nom ni adresse — quatre totaux. Elle lit des co-auteurs déjà publics dans l'historique. Les clés RH et de santé sont refusées à l'enregistrement.
- **RGESN** : une commande git bornée à 30 jours ; lecture de fichiers déjà présents.

## 5. Limites connues

- **Résultat sur `aiad-sdd` le 2026-11-15 : 22 métriques suivies, toutes avec une valeur.** `aiad-sdd metrics check` passe.
- **14 métriques écartées du suivi de ce projet par l'auteur** (`metrics exclude`, tracé dans `.aiad/metrics/scope.json`) : Équipe (3), Outcomes (6), Efficacité IA déclarative (5). L'auteur avait d'abord choisi de les laisser non mesurées, puis annulé les reports que l'agent avait enregistrés avec des échéances fixées sans lui, et a finalement répondu « les écarter du suivi ». Il n'a pas donné de motif : la raison enregistrée est sa décision elle-même.
- **Conséquence à connaître** : sur ce projet, le dashboard ne pilote plus ni les Outcomes ni l'Équipe, et l'Efficacité IA se réduit aux deux métriques tirées de git. Les métriques restent affichées, marquées « non applicable » avec le nom de l'auteur ; `aiad-sdd metrics include <id>` les réintègre.
- **Leçon pour l'agent (Human Learning)** : une échéance de report est une décision ; elle ne se déduit pas d'une valeur par défaut quand on enregistre au nom de quelqu'un.
- **Flow Efficiency remonte comme une anomalie** sur ce projet : les déploiements du site et ceux du paquet ne portent pas les mêmes durées, et le Cycle Time moyen (81,7 j) dépasse le Lead Time moyen (4 j). C'est un défaut des données enregistrées, à corriger à la source.
- **Premier passage à la Gate lu dans l'historique** : il dépend de la convention d'écriture des SPECs (une ligne datée par passage). Une SPEC qui ne trace pas sa Gate n'est pas comptée.
- **Les mesures git sont des approximations.** Un commit co-signé par un agent compte en entier, fichiers générés compris ; un travail d'agent non co-signé n'est pas compté. Sur `aiad-sdd` : 99,7 % de lignes « générées », chiffre gonflé par les fichiers de dashboard régénérés.
- **Cadences et seuils de péremption posés par l'agent** (21 / 14 / 35 / 35 jours ; deux périodes), à ajuster par l'auteur.
- **`metrics check` n'est pas branché en CI** : il échouerait aujourd'hui sur ce dépôt.

## 6. Definition of Output Done (DoOD)

- [x] Code + lint passing
- [x] Tests CA-001 à CA-015
- [x] Annotations `@intent INTENT-038` / `@spec SPEC-038-2-instrumentation-metriques`
- [x] SPEC et code dans le même changement (Drift Lock)
- [x] SPEC validée par l'auteur (2026-11-15, après implémentation)
- [x] Gouvernance vérifiée (§ 4)

## Historique des modifications

| Date | Changement | Raison |
|------|------------|--------|
| 2026-11-15 | Création et implémentation dans la même session. | Demande de l'auteur : engager les deux chantiers pour lever le critère de drift d'INTENT-038. |
| 2026-11-15 | Ajouts : Gate lue dans l'historique des SPECs, enregistrement des validations, rapport des moyennes et anomalie pour Flow Efficiency, périmètre `exclude` / `include`. Décisions de l'auteur consignées en § 5. Budget de la vue d'ensemble relevé à 36 Ko (décision de l'auteur). | Contrôle d'arrêt : le critère de drift n'était pas levé ; puis réponses de l'auteur. |
| 2026-11-15 | Validation par l'auteur (« je valide les deux »), en l'état. Statut → ready. Critère de drift de l'Intent déclaré levé par l'auteur. | Réponse de l'auteur. |
| 2026-11-15 | Ajout des reports (`defer` / `undefer`) : décision humaine tracée, à échéance. Les réponses de l'auteur sur les 14 métriques déclaratives sont enregistrées comme reports. Dossier de mesure d'usage ajouté au `.gitignore`. | Contrôle d'arrêt : les décisions de l'auteur n'étaient visibles nulle part dans le dashboard, et les 14 métriques ne retournaient aucune information. |
| 2026-11-15 | Les 14 reports enregistrés par l'agent sont annulés (`undefer`) sur décision de l'auteur. | Réponse de l'auteur : « annuler les reports ». |
| 2026-11-15 | Les 14 métriques déclaratives sont écartées du suivi du projet (`exclude`) sur décision de l'auteur. | Réponse de l'auteur : « les écarter du suivi ». |
