---
name: acceptance-verification
description: "Use when validating delivered code against its SPEC - every acceptance criterion gets evidence (named test, command output, observed behaviour) or is reported as not verified. Produces the QA report."
---

# Skill — Vérification des critères d'acceptation

> La validation fonctionnelle apporte des preuves. « Ça a l'air de marcher » n'en est pas une.

## Quand l'utiliser

- Dans `/sdd validate`, après la validation technique.
- Avant le sign-off du QA.

## Méthode

1. Exécuter la suite de tests ; noter la commande et le résultat exact (réussis, échoués, ignorés).
2. Pour chaque critère d'acceptation, attribuer un statut :

   | Statut | Condition |
   |--------|-----------|
   | `vérifié` | une preuve nommée existe : test, sortie de commande, comportement observé |
   | `échoué` | la preuve contredit le critère |
   | `non vérifié` | aucune preuve — quelle qu'en soit la raison |

3. Vérifier les cas limites de la SPEC de la même manière.
4. Pour chaque défaut : description, étapes de reproduction, gravité **proposée**.
5. Verdict : `CONFORME` (tous vérifiés) · `NON CONFORME` (au moins un échoué) · `JNSP` (au moins un non vérifié, aucun échoué).
6. Le **sign-off** reste en attente du QA.

## Sortie

Rapport QA : verdict, tableau critère/statut/preuve, défauts, non vérifiés, sign-off en attente.

## Anti-patterns

- Compter un test ignoré comme réussi.
- Déclarer `CONFORME` avec un critère non vérifié.
- Corriger le code pendant la validation.
