---
id: CANARY-011
kind: deterministic
command: gate-precheck .aiad/canary/fixtures/gate-precheck-irreversible-sans-seuil.md --output-format verdict
expected: FAIL
---

# CANARY-011 — Pré-contrôle de la Gate : action irréversible sans seuil d'arrêt

> Cas **figé** de la canary suite (§3.10). Ne pas éditer sans réviser la baseline.

## Invariant testé

Une SPEC qui déclare une action irréversible dans sa section « Périmètre
d'exécution de l'agent » sans renseigner le « Seuil d'arrêt » DOIT être rejetée
par `gate-precheck` : verdict `FAIL` (exit 1), la Gate est fermée. Ce verdict est
**100 % déterministe** : tout écart entre runs (ou vs cette baseline) est un
**bug code**, jamais du bruit modèle.

## Fixture

`.aiad/canary/fixtures/gate-precheck-irreversible-sans-seuil.md` — tableau
complet (six lignes), action irréversible déclarée, seuil d'arrêt resté au
placeholder `[…]` du gabarit.

## Pourquoi figé

C'est la seule vérification de la doctrine v1.9 (seuil d'arrêt des actions
irréversibles) qui ferme la Gate hors jugement du modèle (SPEC-033-3).
