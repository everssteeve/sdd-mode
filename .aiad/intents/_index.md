# Index des Intent Statements

> Chaque Intent Statement capture le POURQUOI d'une fonctionnalité avant toute spécification.
> Format : `INTENT-NNN-[nom-court].md`
> Commande : `/sdd-intent` dans Claude Code

| ID | Titre | Auteur | Date | SPECs liées | Statut |
|----|-------|--------|------|-------------|--------|
| INTENT-001 | Feedback qualitatif utilisateurs SDD Mode | Steeve Evers | 2026-05-29 | SPEC-001-1 | done |
| INTENT-002 | Gouvernance SDD enforced par le harness (advisory → enforced) | Steeve Evers | 2026-06-08 | SPEC-002-1 | done |
| INTENT-003 | Phase Research + Discovery obligatoire avant la SPEC (§3.5) | Steeve Evers | 2026-06-08 | SPEC-003-1 | done |
| INTENT-004 | Exécution phasée + mini-gates + 3e verdict CONDITIONAL (§3.6) | Steeve Evers | 2026-06-08 | SPEC-004-1 | done |
| INTENT-005 | Budget d'instructions push → pull (gouvernance par paths, §3.7) | Steeve Evers | 2026-06-08 | SPEC-005-1 | done |
| INTENT-006 | Canary suite + alignement des références modèles (§3.10) | Steeve Evers | 2026-06-09 | SPEC-006-1 | done |
| INTENT-007 | Memory native — promotion from logs + anti dock rot (§3.8) | Steeve Evers | 2026-06-09 | SPEC-007-1 | done |
| INTENT-008 | Cycle SDD comme graphe de Tasks (§3.9) | Steeve Evers | 2026-06-09 | SPEC-008-1 | done |
| INTENT-009 | Observabilité native — statusLine + OTel + usage skills (§3.11) | Steeve Evers | 2026-06-09 | SPEC-009-1 | done |
| INTENT-010 | Cross-model review additive-only (§3.12) | Steeve Evers | 2026-06-09 | SPEC-010-1 | done |
| INTENT-011 | Distribution plugin + /goal + toggles de hooks (§3.13) | Steeve Evers | 2026-06-09 | SPEC-011-1 | done |
| INTENT-012 | Garde-fous de conception — doctrine + proportionnalité + grill-me + sunset (§4) | Steeve Evers | 2026-06-09 | SPEC-012-1 | done |
| INTENT-013 | Zéro drift sur soi-même — site et docs alignés sur la version livrée | Steeve Evers | 2026-06-11 | SPEC-013-1a/2/3/4a done · 1b archiv · 4b draft | done |
| INTENT-014 | Empirisme prouvé — gates qualité actifs et claims sourcés | Steeve Evers | 2026-06-11 | SPEC-014-1, SPEC-014-2 done | done |
| INTENT-015 | Sobriété du CLI — noyau assumé, longue traîne extraite | Steeve Evers | 2026-06-11 | SPEC-015-1/2-1/2-2/3 done | done |
| INTENT-016 | Dashboard exemplaire — fondations accessibles, sobres, maintenables | Steeve Evers | 2026-06-11 | — | draft |
| INTENT-017 | Vivre le projet au quotidien — Aujourd'hui, triage, digest | Steeve Evers | 2026-06-11 | — | draft |
| INTENT-018 | La valeur réalisée comme boussole — outcomes, EBM, bilan humains/agents | Steeve Evers | 2026-06-11 | — | draft |
| INTENT-019 | Verification-first — dériver des tests des critères EARS | Steeve Evers | 2026-06-11 | — | draft |
| INTENT-020 | Spec-anchored par construction — deltas et redevabilité bidirectionnelle | Steeve Evers | 2026-06-11 | — | draft |
| INTENT-021 | Empreinte mesurée — tokens et coût par fonctionnalité | Steeve Evers | 2026-06-11 | — | draft |
| INTENT-022 | Dogfooding complet — le CLI sous SPEC | Steeve Evers | 2026-06-11 | — | draft |
| INTENT-023 | Rayonnement honnête — comparatif public et runtimes élargis | Steeve Evers | 2026-06-11 | — | draft |
| INTENT-024 | Traçabilité honnête des SPECs sans code applicatif — exemption explicite (FACT-004) | Steeve Evers | 2026-06-19 | SPEC-024-1 | done |
| INTENT-025 | Corriger le contraste des kickers et pills gold (WCAG 1.4.3) | Steeve Evers | 2026-06-22 | — | open |

## Cycle de vie d'un Intent Statement

Chaque Intent Statement possède un champ `status:` dans son frontmatter :

| Statut | Signification | Transition |
|--------|---------------|------------|
| `draft` | Intent en cours de rédaction, pas encore validé par un stakeholder | → `active` (après validation PM + stakeholder) |
| `active` | Intent validé, au moins une SPEC en cours ou planifiée | → `done` (toutes les SPECs liées sont validées et mergées) |
| `done` | Intent réalisé, toutes les SPECs liées sont complétées | → `archived` (après revue à l'Atelier d'Intention) |
| `archived` | Intent historique, conservé pour traçabilité | Réactivation possible → `active` (nécessite un nouvel Intent Statement de justification) |

### Signaux de santé (`/aiad-health`)

- **Zombie** : Intent `active` sans activité depuis >30 jours → décision humaine requise (archiver ou relancer)
- **Orphelin** : Intent `active` sans SPEC liée → probablement un intent non décomposé
- **Draft oublié** : Intent `draft` depuis >14 jours → intention pas mûre ou abandonnée
