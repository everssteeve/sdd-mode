---
name: release-readiness
description: "Use when preparing a release without publishing it - release checks, Drift Lock, governance veto, changelog draft, version proposal, blockers. Tagging, pushing, publishing and deploying remain human actions."
---

# Skill — Préparation de release

> Préparer une release, c'est mettre le Tech Lead en position de décider. Publier reste un geste humain.

## Quand l'utiliser

- Le Tech Lead envisage une release.
- En fin d'itération, pour savoir ce qui est livrable.

## Méthode

| Contrôle | Preuve attendue |
|----------|-----------------|
| Tests et lint | commande et résultat exact |
| Drift Lock | `npx aiad-sdd trace` sans gap bloquant |
| Gouvernance Tier 1 | aucun veto ouvert |
| SPECs livrées | statut à jour dans `.aiad/specs/_index.md` |
| Sécurité | dernier audit postérieur au dernier changement sensible |
| Documentation | changelog et guides à jour |
| Version | cohérente partout où elle est écrite |

1. Lancer chaque contrôle ; noter le résultat tel quel.
2. Rédiger le **brouillon de changelog** depuis les SPECs livrées et les commits.
3. **Proposer** la version : correctif, mineure ou majeure selon la nature des changements.
4. Lister les **bloquants** et les **actions humaines restantes** : tag, push, publication, déploiement.
5. Verdict : `PRÊTE` · `BLOQUÉE` · `JNSP`.

## Anti-patterns

- Pousser, taguer, publier ou déployer.
- Contourner un contrôle en échec (`--no-verify`, test désactivé).
- Déclarer `PRÊTE` avec un contrôle non lancé.
