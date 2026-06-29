# Index des SPECs

> Chaque SPEC est une spécification technique atomique liée à un Intent Statement.
> Nommage : `SPEC-NNN-[nom-court].md`
> Commande : `/sdd spec` (ajouter `--ears` pour la variante EARS) dans Claude Code

| ID | Titre | Intent parent | Format | SQS | Statut | PR |
|----|-------|---------------|--------|-----|--------|----|
| SPEC-001-1 | Feedback qualitatif opt-in — commande CLI et invitation périodique | INTENT-001 | prose | 4.4 | done | — |
| SPEC-002-1 | Socle P0 — gouvernance enforced (verdicts, hooks JNSP/Drift/Veto, subagents Tier 1) | INTENT-002 | prose | 4.4 | done | — |
| SPEC-003-1 | Phase Research GO/NO-GO + prérequis Discovery enforced (§3.5) | INTENT-003 | prose | 4.4 | done | — |
| SPEC-004-1 | Exécution phasée + mini-gates + statut visuel (§3.6) | INTENT-004 | prose | 4.4 | done | — |
| SPEC-005-1 | Gouvernance en pull (.claude/rules paths:) + réglages de budget (§3.7) | INTENT-005 | prose | 4.2 | done | — |
| SPEC-006-1 | Canary suite + alignement des références modèles (§3.10) | INTENT-006 | prose | 4.2 | done | — |
| SPEC-007-1 | Memory native — promotion from logs + anti dock rot (§3.8) | INTENT-007 | prose | 4.2 | done | — |
| SPEC-008-1 | Cycle SDD comme graphe de Tasks (§3.9) | INTENT-008 | prose | 4.2 | done | — |
| SPEC-009-1 | Observabilité native — statusLine + OTel + usage skills (§3.11) | INTENT-009 | prose | 4.1 | done | — |
| SPEC-010-1 | Cross-model review additive-only (§3.12) | INTENT-010 | prose | 4.1 | done | — |
| SPEC-011-1 | Toggles de hooks + /goal + packaging plugin (§3.13) | INTENT-011 | prose | 4.1 | done | — |
| SPEC-012-1 | Garde-fous de conception — doctrine + proportionnalité + grill-me + sunset (§4) | INTENT-012 | prose | 4.0 | done | — |
| SPEC-013-1 | Déploiement site v1.18 + résolution « 7 valeurs » | INTENT-013 | prose | 1.0 (FERMÉE → découpée) | split | — |
| SPEC-013-1a | Déploiement du site aiad.ovh en v1.18 | INTENT-013 | prose | 4.0 | done (trace-exempt) | — |
| SPEC-013-1b | Unification à 7 valeurs sur les 4 sources | INTENT-013 | prose | 4.0 | archived | — |
| SPEC-013-2 | Unification des docs racine + archivage de SDDMode.md | INTENT-013 | prose | 4.0 | done | — |
| SPEC-013-3 | Sync auto des versions (zones marquées) + check CI | INTENT-013 | prose | 5.0 | done | — |
| SPEC-013-4 | Workflow de déploiement site/ → gh-pages (gate version + RGAA) | INTENT-013 | prose | 4.0 (OUVERTE → découpée) | split | — |
| SPEC-013-4a | Deploy site/ → gh-pages + gate version | INTENT-013 | prose | 5.0 | done | — |
| SPEC-013-4b | Gate RGAA AA avant publication | INTENT-013 | prose | 5.0 | done | — |
| SPEC-014-1 | Gates bloquants (size + couverture) au publish + badge zéro-dep | INTENT-014 | prose | 5.0 | done | #5 |
| SPEC-014-2 | Sourcing seul — figer claims externes + requalifier le 50K (FACT-001) | INTENT-014 | prose | 5.0 | done | #6 |
| SPEC-015-1 | Agrégat d'usage per-command (telemetry usage, local, opt-in) | INTENT-015 | EARS | 5.0 | done | #8 |
| SPEC-015-2-1 | Registre catégorisé des commandes (core/extended/experimental) + snapshot | INTENT-015 | EARS | 5.0 | done | #10 |
| SPEC-015-2-2 | Cycle de dépréciation soft (mécanisme dormant : warning au dispatch) | INTENT-015 | EARS | 5.0 | done | #12 |
| SPEC-015-3 | Matrice enforced/advisory machine-vérifiable + veto non-bypassable | INTENT-015 | EARS | 5.0 | done | #14 |
| SPEC-024-1 | Exemption de traçabilité pour SPECs sans code applicatif (FACT-004) | INTENT-024 | EARS | 5.0 | done | — |
| SPEC-025-1 | Correction du contraste `--gold-600` (`.kicker` + `.pill.gold`) | INTENT-025 | EARS | 5.0 | done (trace-exempt) | — |
| SPEC-016-1 | Architecture 4 couches — collect / model / views / ui | INTENT-016 | prose | 5.0 | done | — |
| SPEC-016-2 | Design system accessible + axe-core en CI | INTENT-016 | EARS | 5/5 | done | — |
| SPEC-016-3 | data.json v2 versionné (JSON schema publié) | INTENT-016 | prose | 5/5 | done | — |
| SPEC-016-4 | Budgets de poids RGESN par page + CI | INTENT-016 | EARS | 5/5 | done | — |
| SPEC-017-1 | Page "Aujourd'hui" (radiator ≤ 4 sections) | INTENT-017 | EARS | 5/5 | done | 2026-06-22 |
| SPEC-017-2 | Inbox de triage facts/drifts (localStorage) | INTENT-017 | EARS | 5/5 (gate OK) | done | 2026-06-22 |
| SPEC-017-3 | Digest delta + snapshots persistants | INTENT-017 | EARS | 5/5 | done | 2026-06-22 |
| SPEC-017-4 | Pages détail SPEC (drill-down depuis specs.html) | INTENT-017 | EARS | 5/5 (gate OK) | done | 2026-06-22 |
| SPEC-018-1 | Matrice outcomes ↔ Intents | INTENT-018 | prose | 5/5 | done | 2026-06-23 |
| SPEC-018-2 | Aires EBM + Investment Balance | INTENT-018 | prose | 5/5 | done | — |
| SPEC-018-3 | Hill charts calculés depuis l'état SDD | INTENT-018 | prose | 5/5 | done | 2026-06-23 |
| SPEC-018-4 | Bilan humains/agents par Intent | INTENT-018 | prose | 5/5 | done | 2026-06-23 |
| SPEC-018-5 | Matrice Impact × Effort des Intents en attente | INTENT-018 | prose | 5/5 | done | 2026-06-23 |
| SPEC-019-1 | Générateur de squelettes de tests depuis EARS (suggest-tests) | INTENT-019 | EARS | 5/5 | done | — |
| SPEC-019-2 | Gap earsSpecsSansTests dans trace --fail-on-gap | INTENT-019 | EARS | 5/5 | done | — |
| SPEC-026-1 | Commande `archive done` — archivage des artefacts done | INTENT-026 | EARS | 5/5 | done | — |
| SPEC-026-2 | `archive done` — éligibilité SPECs `split` + détection originaux orphelins | INTENT-026 | EARS | 5/5 | archived | — |
| SPEC-030-1 | eco-estimator — algorithme JS natif + base modèles JSON | INTENT-030 | prose | 5/5 | done | — |
| SPEC-030-2 | hook-stop — capture harness Stop → hook-runs.jsonl enrichi | INTENT-030 | prose | 5/5 | done | — |
| SPEC-030-3 | validate-badge — badge CO₂ dans /sdd validate | INTENT-030 | prose | 5/5 | done | — |
| SPEC-030-4 | dashboard-eco — page eco.html + widget metrics.html | INTENT-030 | prose | 5/5 | done | 2026-06-25 |
| SPEC-031-1 | Correctif hook Stop — exclusion gap ready pré-exec | INTENT-031 | prose | 5/5 | archived | — |
| SPEC-031-2 | Moteur de chaînage automatique conditionnel (lib/auto-chain.js) | INTENT-031 | prose | 5/5 | archived | — |
| SPEC-031-3 | Paramètre auto_chain dans .aiad/config.yml + parser | INTENT-031 | prose | 5/5 | archived | — |
| SPEC-032-1 | /model actionnable — uniformisation 33 commandes /sdd et /aiad (FACT-015) | INTENT-032 | prose | 5/5 | archived | — |
| SPEC-020-1 | Modèle deltas/archive — specs = état courant, petits changements tracés | INTENT-020 | prose | 5/5 | archived | — |
| SPEC-020-2 | Redevabilité bidirectionnelle — FACT enrichi + signal constraint-violated | INTENT-020 | prose | 5/5 | archived | — |
| SPEC-021-1 | Attribution tokens ↔ Intent/SPEC (hook Stop enrichi rétro-compatible) | INTENT-021 | EARS | 5/5 | done | — |
| SPEC-021-2 | Restitution empreinte par artefact dans /sdd context | INTENT-021 | EARS | 5/5 | done | — |
| SPEC-022-1 | Spec rétroactive lib/init.js + annotations modules cœur | INTENT-022 | prose | 5/5 | archived | — |
| SPEC-022-2 | Campagne d'annotation progressive — enforcement new modules lib/ | INTENT-022 | prose | 5/5 | archived | — |
| SPEC-027-1 | Stamp `validated_at` dans le frontmatter SPEC lors du passage `done` | INTENT-027 | EARS | 5/5 | archived | — |
| SPEC-027-2 | Fonction `calculateCycleTimeDaysFromSpec()` + flag CLI `--auto` | INTENT-027 | EARS | 5/5 | archived | — |
| SPEC-027-3 | Steps CI post-deploy (`site-deploy.yml` + `release.yml`) | INTENT-027 | EARS | 5/5 | archived | — |
| SPEC-029-1 | Extension de l'archivage aux FACTs résolus | INTENT-029 | prose | — | draft | — |
| SPEC-028-1 | Smoke test ESM bin/ (package.json + ci.yml) | INTENT-028 | prose | 5/5 | archived | — |
| SPEC-028-2 | AGENT-GUIDE : section consommateurs de construireMatrice() | INTENT-028 | prose | 5/5 | archived | — |
| SPEC-023-1 | Page comparative publique honnête (AIAD vs concurrents) | INTENT-023 | prose | 5/5 | archived | — |
| SPEC-023-2 | Extension emit-rules : runtime Kiro (+ Amazon Q) | INTENT-023 | prose | 5/5 | archived | — |

> Colonne **Format** : `prose` (par défaut) ou `EARS` (variante avec linter strict — cf. `spec-ears-template.md`).

## Statuts possibles

- **draft** — SPEC en cours de rédaction
- **review** — En attente de validation SQS (Execution Gate)
- **ready** — SQS >= 4/5, prête pour développement agent
- **in-progress** — Agent en cours de développement
- **validation** — Code produit, en validation QA
- **done** — Code + SPEC synchronisés, PR mergée (Drift Lock)
- **archived** — Déplacée dans `archive/`
