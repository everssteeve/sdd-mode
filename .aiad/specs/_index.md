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

> Colonne **Format** : `prose` (par défaut) ou `EARS` (variante avec linter strict — cf. `spec-ears-template.md`).

## Statuts possibles

- **draft** — SPEC en cours de rédaction
- **review** — En attente de validation SQS (Execution Gate)
- **ready** — SQS >= 4/5, prête pour développement agent
- **in-progress** — Agent en cours de développement
- **validation** — Code produit, en validation QA
- **done** — Code + SPEC synchronisés, PR mergée (Drift Lock)
- **archived** — Déplacée dans `archive/`
