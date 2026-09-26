# Fixture canary — SPEC témoin du pré-contrôle de la Gate

> Fixture **figée** consommée par CANARY-011 (`aiad-sdd gate-precheck`). Ce n'est
> pas une SPEC du projet : ne pas l'éditer sans réviser la baseline.

## 9. Périmètre d'exécution de l'agent (conditionnel)

| Élément | Déclaration |
|---------|-------------|
| Isolation | conteneur éphémère |
| Sorties réseau autorisées | api.example.org |
| Credentials présents | jeton de déploiement, portée projet, 1 h |
| Ressources partagées en écriture | base de données de recette |
| Actions irréversibles possibles | purge des données de recette (irréversible) |
| Seuil d'arrêt | [condition d'arrêt immédiat — requis si une action irréversible est déclarée] |
