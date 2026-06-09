---
id: CANARY-001
kind: deterministic
command: discovery-check INTENT-000-canary --output-format verdict
expected: JNSP
---

# CANARY-001 — Invariant fail-closed du gate Discovery

> Cas **figé** de la canary suite (§3.10). Ne pas éditer sans réviser la baseline.

## Invariant testé

En l'absence de Research liée à un Intent, `discovery-check` DOIT retourner
`JNSP` (exit 2) — fail-closed. Ce verdict est **100 % déterministe** : tout écart
entre runs (ou vs cette baseline) est un **bug code**, jamais du bruit modèle.

## Pourquoi figé

Le comportement fail-closed est une garantie de sécurité (§3.5). Sa stabilité
est la première chose qu'une régression de harness casserait silencieusement.
