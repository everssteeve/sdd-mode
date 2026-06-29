# EXEC-SPEC-023-1 — Plan d'exécution phasé

> Exécution phasée (§3.6) — découpe la SPEC en **tranches verticales testables**.
> Marqueurs de statut : `[ ]` à faire · `[~]` en cours · `[x]` validé · `[!]` bloqué · `[-]` hors-scope.

**SPEC** : SPEC-023-1 — Page comparative publique honnête
**Intent** : INTENT-023
**Mode phasé** : activé

---

## Phase 1 — Enrichir bench/comparison.md  [x]

- Objectif : ajouter les colonnes OpenSpec et BMAD dans les deux tableaux, avec dates de collecte sur toutes les données concurrentes
- Fichiers : `bench/comparison.md`
- Tests : `test/bench-comparison.test.js` (régressions — pas de modification du script)
- Done : `bench/comparison.md` contient les colonnes OpenSpec et BMAD ; toutes les données concurrentes portent la date de collecte
- Conditions : données non mesurables = N/D (2026-06-29) explicite — jamais d'invention

## Phase 2 — Créer site/fr/comparaison.html  [x]

- Objectif : page HTML comparative RGAA AA compliant, sections moat + faiblesses
- Fichiers : `site/fr/comparaison.html`
- Tests : CA-5 (axe-core 0 violation) — gate via `npx aiad-sdd mini-gate SPEC-023-1 --phase 2`
- Done : page rendue dans le navigateur, tableaux avec caption/scope, emojis aria-hidden, section "Où AIAD est plus faible" présente
- Conditions : (aucune)

## Phase 3 — Mettre à jour la navigation  [x]

- Objectif : lien vers comparaison.html dans la nav principale (toutes pages) + dans le corps de a-propos.html
- Fichiers : tous les fichiers `site/fr/**/*.html` (28 fichiers) + `site/fr/a-propos.html` (corps)
- Tests : vérification href présent dans la nav de au moins 5 pages
- Done : CA-1 satisfait — lien accessible depuis nav principale et depuis a-propos.html
- Conditions : (aucune)
