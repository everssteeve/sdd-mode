---
name: test-strategy
description: "Use when deriving a test plan from a SPEC before or right after the Execution Gate - one or more checks per acceptance criterion, test level, automation versus manual, untestable criteria flagged."
---

# Skill — Stratégie de test

> La qualité se décide à la SPEC. Un critère d'acceptation qui ne se traduit pas en vérification est un défaut de SPEC, pas un détail de test.

## Quand l'utiliser

- Quand une SPEC est en revue (shift-left).
- Juste après l'ouverture de la Gate, avant l'implémentation.

## Méthode

1. Pour **chaque critère d'acceptation** : au moins une vérification — donnée d'entrée, action, résultat attendu.
2. Choisir le **niveau** le plus bas qui prouve le comportement : unitaire → intégration → bout en bout.
3. **Automatiser** ce qui est déterministe et rejoué ; garder en **manuel** ce qui relève du jugement (ergonomie, exploration).
4. Couvrir les **cas limites** cités par la SPEC ; ceux qu'elle ne cite pas deviennent des questions au PE.
5. Zones réglementées : prévoir les vérifications demandées par l'agent Tier 1 concerné (accessibilité, données personnelles…).
6. Signaler tout critère **non testable en l'état** et ce qui manque pour qu'il le soit.
7. Énoncer le **risque résiduel** si le plan est suivi tel quel.

## Sortie

Tableau critère → vérification → niveau → auto/manuel, critères non testables, questions au PE, risque résiduel.

## Anti-patterns

- Interpréter un critère ambigu au lieu de le renvoyer.
- Tout tester en bout en bout.
- Un plan sans cas limites.
