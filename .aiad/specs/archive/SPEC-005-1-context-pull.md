---
id: SPEC-005-1
title: Gouvernance en pull (.claude/rules paths:) + réglages de budget (§3.7 SPEC-A + SPEC-B)
parent_intent: INTENT-005
status: archived
format: prose
sqs: 4.2
author: Steeve Evers
date: "2026-06-08"
archivedAt: "2026-06-24T07:31:15.534Z"
archivedBy: evers.steeve@gmail.com
archivedReason: archive done
---
# SPEC-005-1 — Gouvernance en pull + réglages de budget

**Intent parent** : INTENT-005
**SQS** : 4.2 / 5
**Statut** : done

## Objectif

Charger la gouvernance advisory à la demande (par zone de risque) au lieu de la pousser en permanence, et régler explicitement le budget de contexte — sans toucher à la couche enforced (§3.1), qui reste le vrai garde-fou.

## Implémentation

- **Règles pull** : `lib/emit-rules.js` génère `.claude/rules/{rgpd,rgaa,ai-act,rgesn}.md` avec frontmatter `paths:` (primitive native Claude Code, chargement à la demande) depuis la source unique `.aiad/gouvernance/`. Map `GLOBS_RULES` (RGESN resserré sur les fichiers de ressources/deps au lieu de `**/*`). Helper `nomRule`.
- **Réglages de budget** : `templates/.claude/settings.json` — `env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: "65"` (seuil 60-70 % rendu natif), `skillListingMaxDescChars: 1536`, `skillListingBudgetFraction: 0.01`.
- **Garde-fou descriptions** : `lib/skills.js` — `MAX_DESCRIPTION = 1536`, `validerSkill` signale toute description au-delà (tronquée à froid).

## Critères d'acceptation

1. WHERE un fichier matche le `paths:` d'une règle de gouvernance, the system SHALL la charger ; sinon SHALL NOT (primitive native `.claude/rules/*.md`).
2. the system SHALL générer les 4 règles depuis la source unique `.aiad/gouvernance/` (non éditées à la main) ; `emit-rules --check` détecte toute divergence.
3. La règle RGPD ne se charge que sur les zones de données, RGAA que sur l'UI, AI-ACT que sur les composants ML, RGESN que sur les fichiers de ressources/deps (pas `**/*`).
4. the system SHALL régler `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` à 65 et `skillListingMaxDescChars`/`skillListingBudgetFraction` dans les settings émis.
5. the system SHALL garder chaque description de skill ≤ 1536 caractères (vérifié par `validerSkill`).
6. La couche enforced (§3.1) reste intacte : les règles pull sont **additives** et advisory ; le veto reste enforced par hook + subagent.
7. Aucune régression : la suite complète passe (`npm test`).

## Vérification

- `test/emit-rules-pull.test.js` (5 ✓) + `test/skills.test.js` (garde-fou ≤ 1536).
- Suite complète `npm test` (3692 pass / 0 fail / 1 skip).
- `node scripts/lint.js`, `lint-esm`, `lint-size --strict` verts ; `docs --check` synchronisé ; `settings.json` valide vs schéma Claude Code.

## Hors périmètre

- Minimalisation complète de `CLAUDE.md` + `references/commands.md` (déplacement des tableaux de commandes) — itération ultérieure.
- Mesure du gain de tokens à froid (extension `bench`/coldstart).
- Le `paths:` des subagents `.claude/agents/*.md` n'est pas honoré par Claude Code (champ ignoré) : ce sont les `.claude/rules/` qui fournissent le path-scoping réel. La correction du frontmatter subagent est hors périmètre §3.7.
