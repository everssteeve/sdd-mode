---
name: security-audit
description: "Use when auditing code for security - OWASP Top 10, secrets, dependency risk, input validation, authentication and authorization, agent permissions. Each vulnerability is confirmed by following the data path before being reported."
---

# Skill — Audit sécurité

> Un audit utile rapporte des vulnérabilités confirmées, avec leur scénario d'exploitation — pas une liste de motifs suspects.

## Quand l'utiliser

- Dans `/sdd security`.
- Code sur le chemin de production, nouvelle dépendance, avant chaque release.

## Méthode

1. **Secrets** : clés, jetons, mots de passe dans le code, la configuration, les exemples. Signaler `fichier:ligne` et le type — ne jamais recopier la valeur.
2. **Entrées** : toute donnée externe est-elle validée avant un point sensible (requête, commande, chemin de fichier, rendu HTML) ? Suivre la donnée de l'entrée au point sensible.
3. **Authentification et autorisation** : chaque accès vérifie-t-il l'identité **et** le droit sur la ressource ?
4. **Dépendances** : ajouts et mises à jour — provenance, maintenance, vulnérabilités connues, version épinglée.
5. **Données personnelles** : signaler pour consultation de `AIAD-RGPD`.
6. **Agents** : permissions accordées, approbations persistées (skill `permissions-audit` côté AE).
7. Classer par catégorie OWASP et gravité (`critique`, `haute`, `moyenne`, `basse`).

Un soupçon dont le chemin d'exploitation n'a pas pu être établi est listé à part, comme « à examiner ».

## Sortie

Verdict `RAS` · `VULNÉRABILITÉS` · `JNSP`, tableau gravité/catégorie/localisation/scénario/correction, zones non auditées.

## Anti-patterns

- Recopier un secret dans le rapport.
- Tester une exploitation sur un système réel.
- Accepter un risque à la place du Tech Lead.
- « RAS » sur une zone non lue.
