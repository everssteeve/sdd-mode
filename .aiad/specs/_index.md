# Index des SPECs

> Chaque SPEC est une spécification technique atomique liée à un Intent Statement.
> Nommage : `SPEC-NNN-[nom-court].md`
> Commande : `/sdd spec` (ajouter `--ears` pour la variante EARS) dans Claude Code

| ID | Titre | Intent parent | Format | SQS | Statut | PR |
|----|-------|---------------|--------|-----|--------|----|
| SPEC-001-1 | Feedback qualitatif opt-in — commande CLI et invitation périodique | INTENT-001 | prose | 4.4 | done | — |
| SPEC-002-1 | Socle P0 — gouvernance enforced (verdicts, hooks JNSP/Drift/Veto, subagents Tier 1) | INTENT-002 | prose | 4.4 | in-progress | — |
| SPEC-003-1 | Phase Research GO/NO-GO + prérequis Discovery enforced (§3.5) | INTENT-003 | prose | 4.4 | in-progress | — |
| SPEC-004-1 | Exécution phasée + mini-gates + statut visuel (§3.6) | INTENT-004 | prose | 4.4 | in-progress | — |
| SPEC-005-1 | Gouvernance en pull (.claude/rules paths:) + réglages de budget (§3.7) | INTENT-005 | prose | 4.2 | in-progress | — |
| SPEC-006-1 | Canary suite + alignement des références modèles (§3.10) | INTENT-006 | prose | 4.2 | in-progress | — |
| SPEC-007-1 | Memory native — promotion from logs + anti dock rot (§3.8) | INTENT-007 | prose | 4.2 | in-progress | — |
| SPEC-008-1 | Cycle SDD comme graphe de Tasks (§3.9) | INTENT-008 | prose | 4.2 | in-progress | — |
| SPEC-009-1 | Observabilité native — statusLine + OTel + usage skills (§3.11) | INTENT-009 | prose | 4.1 | in-progress | — |
| SPEC-010-1 | Cross-model review additive-only (§3.12) | INTENT-010 | prose | 4.1 | in-progress | — |
| SPEC-011-1 | Toggles de hooks + /goal + packaging plugin (§3.13) | INTENT-011 | prose | 4.1 | in-progress | — |
| SPEC-012-1 | Garde-fous de conception — doctrine + proportionnalité + grill-me + sunset (§4) | INTENT-012 | prose | 4.0 | in-progress | — |
| SPEC-013-1 | Déploiement site v1.18 + résolution « 7 valeurs » | INTENT-013 | prose | 1.0 (FERMÉE → découpée) | split | — |
| SPEC-013-1a | Déploiement du site aiad.ovh en v1.18 | INTENT-013 | prose | 4.0 | in-progress | — |
| SPEC-013-1b | Unification à 7 valeurs sur les 4 sources | INTENT-013 | prose | 4.0 | archived | — |
| SPEC-013-2 | Unification des docs racine + archivage de SDDMode.md | INTENT-013 | prose | 4.0 | done | — |
| SPEC-013-3 | Sync auto des versions (zones marquées) + check CI | INTENT-013 | prose | 5.0 | done | — |
| SPEC-013-4 | Workflow de déploiement site/ → gh-pages (gate version + RGAA) | INTENT-013 | prose | 4.0 (OUVERTE → découpée) | split | — |
| SPEC-013-4a | Deploy site/ → gh-pages + gate version | INTENT-013 | prose | 5.0 | validation | — |
| SPEC-013-4b | Gate RGAA AA avant publication | INTENT-013 | prose | À évaluer | draft | — |

> Colonne **Format** : `prose` (par défaut) ou `EARS` (variante avec linter strict — cf. `spec-ears-template.md`).

## Statuts possibles

- **draft** — SPEC en cours de rédaction
- **review** — En attente de validation SQS (Execution Gate)
- **ready** — SQS >= 4/5, prête pour développement agent
- **in-progress** — Agent en cours de développement
- **validation** — Code produit, en validation QA
- **done** — Code + SPEC synchronisés, PR mergée (Drift Lock)
- **archived** — Déplacée dans `archive/`
