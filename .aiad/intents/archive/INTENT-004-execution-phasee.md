---
id: INTENT-004
title: Exécution phasée + mini-gates + 3e verdict CONDITIONAL (§3.6)
status: archived
author: Steeve Evers
date: "2026-06-08"
specs: SPEC-004-1
archivedAt: "2026-06-24T07:17:03.653Z"
archivedBy: evers.steeve@gmail.com
archivedReason: archive done
---
# INTENT-004 — Exécution phasée + mini-gates + 3e verdict CONDITIONAL

## Pourquoi

`/sdd exec` lance l'agent avec **une Execution Gate unique** en amont, puis laisse filer. Deux faiblesses (cf. `docs/analyse-claude-code-best-practice.md` §2.3-2.4) : (a) le modèle « code horizontalement » — beaucoup de lignes avant le moindre test (Dex) ; (b) un verdict binaire PASS/FAIL est trop pauvre — RPI utilise un 3ᵉ état `CONDITIONAL PASS` et un scoring riche avec evidence. Résultat : la dérive est détectée tard, et la dette n'est pas tracée.

## Intention

Découper l'exécution en **tranches verticales testables**, chacune livrant un incrément **et ses tests**, validée par un **mini-gate** répété. Ajouter le 3ᵉ verdict `CONDITIONAL` (dette explicitée) et un **statut visuel machine-vérifiable** (`[ ] [~] [x] [!] [-]`) pour rendre l'avancement mesurable et la reprise déterministe — sans sur-process pour les petites SPECs (proportionnalité).

## Périmètre

- **SPEC-A** — 3ᵉ verdict `CONDITIONAL` (déjà au contrat `lib/verdict.js`) surfacé par le mini-gate ; scoring dimensionnel 0-10 + evidence (opt-in) = amélioration ultérieure.
- **SPEC-B** — exécution phasée : parser de plan + statut (`lib/exec-status.js`), mini-gate par tranche (`lib/mini-gate.js`), CLI `mini-gate` / `exec-status`, artefact `.aiad/exec/`, corps `/sdd exec` + `/sdd resume`.

## Hors périmètre

- Scoring dimensionnel 0-10 + détection d'anti-patterns nommés sur `gate`/`validate` — itération ultérieure.
- Hook `PostToolBatch` avertissant qu'une tranche se termine sans tests verts — itération ultérieure (le mini-gate déterministe couvre le besoin de base).
- §3.7 (contexte pull) — Intent/SPEC séparé.
