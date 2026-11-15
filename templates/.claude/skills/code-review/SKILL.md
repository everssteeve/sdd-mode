---
name: code-review
description: "Use when reviewing a code change - checks conformity to the SPEC acceptance criteria first, then defects, tests, readability and traceability annotations. Every finding is verified in the code before being reported."
---

# Skill — Revue de code adossée à la SPEC

> Une revue AIAD commence par la SPEC : un code élégant qui ne fait pas ce que la SPEC demande est un échec de revue. Les défauts viennent ensuite, vérifiés un par un.

## Quand l'utiliser

- Après chaque implémentation par un agent, avant présentation à l'humain.
- Sur une PR, avant le Drift Check.

## Méthode

Dans cet ordre :

1. **Conformité à la SPEC** — chaque critère d'acceptation est-il implémenté ? Y a-t-il du code que la SPEC ne demande pas ?
2. **Défauts** — erreurs de logique, cas limites de la SPEC non traités, gestion d'erreur absente, concurrence, fuites de ressources.
3. **Tests** — un test par critère ; le test échouerait-il si le comportement était cassé ?
4. **Traçabilité** — annotations `@spec` / `@intent` / `@verified-by` présentes et exactes.
5. **Zones réglementées** — données personnelles, composant IA, interface, ressources : signaler pour consultation de l'agent Tier 1 concerné.
6. **Lisibilité** — nommage, duplication, complexité ; non bloquant sauf si cela masque un défaut.

Pour chaque défaut : `fichier:ligne`, un **scénario concret** (entrée → résultat fautif), et sa gravité (`bloquant` / `amélioration`). Un soupçon non vérifiable dans le code n'est pas rapporté comme défaut.

## Sortie

Verdict `APPROUVABLE` · `CORRECTIONS REQUISES` · `JNSP`, bloquants d'abord, puis améliorations, puis couverture des critères.

## Anti-patterns

- Relire son propre code.
- Rapporter des préférences de style comme des défauts.
- Un défaut sans scénario ni ligne.
- Approuver sans avoir lu la SPEC.
