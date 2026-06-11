# FACT-003 — docs-deploy.yml incompatible avec la topologie Pages (gh-pages)

**Date** : 2026-06-11
**Auteur** : Steeve Evers
**SPEC concernée** : SPEC-013-4a (déploiement site) / INTENT-013
**Statut** : résolu

## Écart constaté

**Livré** : `.github/workflows/docs-deploy.yml` publiait `docs/` (Jekyll) sur
GitHub Pages via la **méthode « GitHub Actions »** (`upload-pages-artifact` +
`deploy-pages`). Il échouait **depuis le 2026-06-01** sur une erreur de build
Jekyll (`theme: jekyll-theme-minima` — nom de gem inexistant ; le bon est `minima`).

**Désiré** : un déploiement qui fonctionne et ne contredit pas la topologie réelle.

## Diagnostic (investigation 2026-06-11)

Deux problèmes empilés :
1. **Bug de thème** : `docs/_config.yml` déclarait `theme: jekyll-theme-minima`
   (gem inexistant) → `MissingDependencyException`. Corrigé en `theme: minima`.
2. **Incompatibilité de topologie (cause de fond)** : aiad.ovh est servi par la
   **branche `gh-pages`** (confirmé par le gardien — RESEARCH-014 R1), soit la
   méthode Pages « **Deploy from branch** ». Or `docs-deploy.yml` utilise la
   méthode « **GitHub Actions** ». **GitHub Pages n'a qu'UNE source** : les deux
   sont mutuellement exclusives. Même thème corrigé, l'étape `deploy-pages` aurait
   échoué. `docs-deploy.yml` était donc de l'**infra morte** depuis le passage de
   Pages en mode branche.

## Décision d'action

**Action choisie** : **désactivation/suppression de `docs-deploy.yml`** (décision
gardien, 2026-06-11). `site-deploy.yml` (push vers la branche `gh-pages`,
SPEC-013-4a) devient le **seul** mécanisme de déploiement, cohérent avec la
topologie Pages réelle. Thème `docs/_config.yml` corrigé par propreté (au cas où
`docs/` serait re-servi un jour).
**Justification** : un fix de thème seul aurait été un **faux fix** (échec déplacé
à l'étape `deploy-pages`). Honnêteté sur les contradictions (valeur n°2).
**Lien** : INTENT-013, SPEC-013-4a. Voir [[FACT-001]], [[FACT-002]].

## Suite — même cause sur AIAD Dashboard (2026-06-11)

`aiad-dashboard.yml` (instance du repo) souffrait du **même conflit** : build OK,
mais job « Publication GitHub Pages » (`deploy-pages@v4`) en échec (méthode Actions
incompatible avec Pages mode branche). **Instance repo supprimée** (décision
gardien) ; le **template** `templates/.github/workflows/aiad-dashboard.yml`
(installé chez les utilisateurs, qui choisissent leur mode Pages) est **conservé
intact**. Suite de tests 3831 pass / 0 fail après suppression.
