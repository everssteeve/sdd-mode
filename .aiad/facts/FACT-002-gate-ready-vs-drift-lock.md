# FACT-002 — Contradiction `gate.md` (statut `ready`) ↔ Drift Lock

**Date** : 2026-06-11
**Auteur** : Steeve Evers
**SPEC concernée** : N/A (signal process — candidat INTENT-002 « gouvernance enforced »)
**Statut** : ouvert

## Écart constaté

**Livré** : `.claude/sdd/gate.md` étape 5 prescrit, sur Gate OUVERTE :
« Statut SPEC → `ready` ». Mais le check de traçabilité
(`lib/sdd-trace.js:536`) classe tout SPEC en statut **`ready` / `validation` /
`done`** sans annotation `@spec` dans le code comme gap **bloquant**
`spec_validated_not_implemented` (`lib/drift-verdict.js:54`). Le Stop hook
échoue donc dès qu'on committe une SPEC `ready` non encore implémentée.

**Désiré** : suivre `gate.md` à la lettre ne devrait pas produire un gap
bloquant pour une SPEC qui vient de passer la Gate et attend `/sdd exec`.

## Impact qualifié

- **Type** : conformité (cohérence doctrine ↔ outillage)
- **Sévérité** : mineur (contournement existant), mais piège pour tout PE
  suivant la doc au pied de la lettre.

Reproduit pendant cette session sur SPEC-013-1a : Gate OUVERTE → statut `ready`
→ commit → Stop hook bloquant. Contournement appliqué : maintenir `review`
jusqu'à l'exec (pattern déjà utilisé par SPEC-013-2), `review` n'étant pas dans
la liste déclencheuse.

## Décision d'action

**Action choisie** : signal versé à INTENT-002 (pas de patch immédiat).
**Justification** : c'est un choix de doctrine à trancher par l'humain, deux
options cohérentes —
(a) **`gate.md` dit `review`** (et non `ready`) tant que l'exec n'a pas produit
de code annoté ; le statut `ready` est réservé au tout début de l'exec ; ou
(b) **retirer `ready` de la liste déclencheuse** du gap dans `sdd-trace.js`
(seuls `validation`/`done` exigent du code `@spec`), `ready` signifiant
« gate passée, pas encore implémentée ».
**Lien** : INTENT-002 (gouvernance enforced). Voir aussi [[FACT-001]] (autre
écart doctrine/empirisme relevé le même jour).
