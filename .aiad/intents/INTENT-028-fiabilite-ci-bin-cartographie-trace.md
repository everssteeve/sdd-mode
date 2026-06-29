# INTENT-028 — Fiabilité CI bin/ + cartographie consommateurs traçabilité

**Auteur** : Steeve Evers
**Date** : 2026-06-24
**Statut** : active

---

## POURQUOI MAINTENANT

La rétro 2026-06-24 a identifié deux patterns de risque systémique issus de SPEC-026-1 :

- **LL-2026-06-24-a** : un import nommé manquant dans `bin/` a provoqué une ReferenceError runtime non détectée avant CI — aucun garde-fou n'existe aujourd'hui pour attraper ce type d'erreur avant le push.
- **LL-2026-06-24-b** : la garde `safe: false` dans `lib/archive.js` est devenue caduque après le patch `78d3b9b` de `construireMatrice()`, parce que les consommateurs de cette fonction ne sont pas documentés — une modification de l'invariant s'est propagée silencieusement.

Ces deux signaux indiquent que le cycle de livraison CLI manque de garde-fous structurels sur deux points précis.

## POUR QUI

Les agents IA et le Product Engineer qui modifient `bin/` ou `lib/trace.js` (et par extension tout module consommateur de `construireMatrice()`).

## OBJECTIF

1. 0 ReferenceError d'import `bin/` atteignant la CI (baseline : 1 incident sur SPEC-026-1)
2. `construireMatrice()` dispose d'une section dédiée dans AGENT-GUIDE listant ≥ ses consommateurs connus (`listerLivrables`, `drift-check`, et tout autre module concerné)

## CONTRAINTES

- Le smoke test doit être < 2 s (pas d'impact mesurable sur la durée de CI)
- La documentation des consommateurs reste dans AGENT-GUIDE — pas de nouveau fichier dédié
- Ne pas modifier l'API publique de `construireMatrice()`

## CRITÈRE DE DRIFT

- Le smoke test `node -e "require('./bin/aiad-sdd')"` est présent dans `package.json` (script `test` ou `ci`) ou dans un workflow `.github/`
- AGENT-GUIDE contient une entrée nommée « Consommateurs de `construireMatrice()` » avec au moins `listerLivrables` et `drift-check`

---

## SPECs liées

- [ ] SPEC-028-1 — Smoke test ESM bin/ (package.json + ci.yml) — draft
- [ ] SPEC-028-2 — AGENT-GUIDE : section consommateurs de construireMatrice() — draft
