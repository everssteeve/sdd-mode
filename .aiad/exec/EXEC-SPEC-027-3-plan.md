# EXEC-SPEC-027-3 — Plan d'exécution phasé

> Exécution phasée (§3.6) — découpe la SPEC en **tranches verticales testables**.
> Interdiction de coder horizontalement : chaque tranche livre un incrément
> **et ses tests**. À la fin de chaque tranche : `npx aiad-sdd mini-gate SPEC-027-3 --phase N`.
>
> Marqueurs de statut : `[ ]` à faire · `[~]` en cours · `[x]` validé · `[!]` bloqué · `[-]` hors-scope.

**SPEC** : SPEC-027-3
**Intent** : INTENT-027
**Mode phasé** : activé (tranche unique — proportionnalité §3.6 §9)

---

## Phase 1 — Steps DORA dans site-deploy.yml + release.yml  [x]

- Objectif : Ajouter les steps `Record DORA metrics` + `Commit metrics to repository` dans les deux workflows GitHub Actions, mettre à jour les permissions `release.yml` (`contents: write`), poser les annotations `@intent`/`@spec`.
- Fichiers : .github/workflows/site-deploy.yml, .github/workflows/release.yml
- Tests : inspection YAML (CA-004 `grep continue-on-error`, CA-005 `grep "if: success()"`, CA-006a/b inspection du script shell)
- Done : tous les CAs inspectables passent · `continue-on-error: true` présent · `if: success()` présent · push pattern avec retry présent
- Conditions :
