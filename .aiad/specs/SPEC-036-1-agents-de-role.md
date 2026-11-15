---
id: SPEC-036-1
title: Agents de rôle, sous-agents et skills — un assistant par responsabilité AIAD
parent_intent: INTENT-036
status: ready
format: prose
sqs: 4
author: Steeve Evers
date: "2026-11-15"
---

# SPEC-036-1-agents-de-role

**Intent parent** : INTENT-036
**Research** : non conduite (voir INTENT-036, « Cycle SDD — ce qui a été fait et ce qui ne l'a pas été »)
**Auteur** : Steeve Evers *(rédaction : agent, 2026-11-15)*
**Date** : 2026-11-15
**Statut** : ready — implémentée sur demande explicite de l'auteur, puis validée par lui le 2026-11-15
**Format** : prose
**SQS** : 4/5 — évalué par l'agent, **validé par l'auteur le 2026-11-15** (point faible assumé : Atomicité, voir Historique)

---

## 1. Contexte

Le package livre des commandes, 9 skills et 4 agents de gouvernance Tier 1. Aucun agent ne correspond aux 5 responsabilités AIAD (PM, PE, AE, QA, Tech Lead), et rien ne dit quel agent lance les agents spécialisés décrits dans le catalogue du framework (revue de code, sécurité, architecture…).

Cette SPEC introduit une équipe d'agents à deux niveaux :

- **5 agents de rôle** — l'assistant personnel de l'humain qui porte une responsabilité ;
- **des sous-agents spécialisés**, chacun géré par **un seul** agent de rôle.

L'humain garde l'intention et les décisions ; chaque agent de rôle liste celles qu'il ne prend jamais.

### Contexte pour un lecteur extérieur

Dans Claude Code, un agent est un fichier `.claude/agents/<nom>.md` (frontmatter + consignes). Lancé en session principale (`claude --agent <nom>` ou clé `agent` des réglages), il ne peut déléguer qu'aux types listés dans `tools: Agent(a, b)`. Le champ `skills:` précharge des skills à l'ouverture. Un sous-agent dont le champ `tools` ne contient pas `Agent` ne peut pas déléguer à son tour.

## 2. Comportement Attendu

### Input

- Le registre `lib/agents-registry.js` : agents de rôle, sous-agents (avec leur gestionnaire, outils, modèle, skills), skills de rôle.
- Les fichiers livrés `templates/.claude/agents/*.md` et `templates/.claude/skills/<nom>/SKILL.md`.

### Processing

1. **Registre.** `lib/agents-registry.js` est la source unique : 5 agents de rôle (`aiad-pm`, `aiad-pe`, `aiad-ae`, `aiad-qa`, `aiad-tech-lead`), 21 sous-agents préfixés par leur rôle (`pm-`, `pe-`, `ae-`, `qa-`, `tl-`), 16 skills de rôle.
2. **Agents de rôle.** Chaque fichier déclare `tools: Agent(<ses sous-agents>, <agents de gouvernance Tier 1>), …`, `skills:` (ses skills + `role-handoff` ; préchargement non constaté en session principale, voir § 6), `memory: project`, et contient : contrat d'exécution, décisions réservées à l'humain, table de délégation, relais inter-rôles, ouverture de session.
3. **Sous-agents.** Chaque fichier déclare `aiad-managed-by: <agent de rôle>`, un champ `tools` explicite sans `Agent`, `disallowedTools` (les sous-agents d'analyse n'ont ni `Edit` ni `Write`), un modèle, et contient : contrat d'exécution, entrée attendue, déroulé, format de sortie avec verdict, limites.
4. **Gouvernance Tier 1.** Les agents `AIAD-*` restent générés par `emit-rules`. Ils sont consultables par les 5 agents de rôle et administrés par `aiad-ae`. Leur veto ne dépend d'aucun rôle.
5. **Relais inter-rôles.** Un agent de rôle ne lance pas le sous-agent d'un autre rôle ; il écrit un relais dans `.aiad/handoffs/` (skill `role-handoff`).
6. **CLI `aiad-sdd agents`.**
   - `list [--json]` : l'équipe (rôles, sous-agents, skills, commandes).
   - `validate [--json]` : confronte `.claude/agents/` au registre ; exit 0 si conforme, 1 sinon.
   - `use <rôle|none>` : écrit (ou retire) la clé `agent` de `.claude/settings.local.json`, sans toucher aux autres clés.
7. **Commande slash `/aiad agents`** : présente l'équipe, aide à choisir, lance la validation.
8. **Distribution.** `init` (profil complet) installe agents et skills ; `update` et `upgrade rituals|all` les synchronisent depuis le registre ; `uninstall` les retire ; le manifeste de plugin liste les fichiers d'agents ; le contrôle de parité `.claude/` ↔ `templates/.claude/` couvre `agents/` (hors `AIAD-*`, générés).
9. **Documentation générée.** `aiad-sdd docs` ajoute une section « Agents de rôle et sous-agents » dérivée du registre.

### Output

- 26 fichiers d'agents et 16 skills livrés ; commande CLI et commande slash ; documentation à jour.

### Cas limites

1. Un agent de rôle dont la liste `Agent(...)` contient le sous-agent d'un autre rôle → `validate` échoue en nommant l'intrus.
2. Un agent de rôle sans `Agent(...)` dans `tools` → `validate` échoue (« délégation non bornée »).
3. Un sous-agent disposant de l'outil `Agent` (ou `Task`) → `validate` échoue.
4. Un sous-agent ajouté par le projet avec `aiad-managed-by: <agent de rôle>` → accepté s'il figure dans la liste `Agent(...)` de ce rôle ; gestionnaire inconnu → signalé comme orphelin.
5. `agents use` avec un `settings.local.json` invalide → refus, fichier inchangé.
6. `agents use <rôle>` alors que l'agent n'est pas installé → refus, aucun fichier écrit.
7. Projet en profil `--minimal` (sans `.claude/skills/`) → `update` n'installe pas les agents.

## 3. Critères d'Acceptation

- [x] CA-001 — Le registre contient exactement 5 agents de rôle, un par responsabilité (PM, PE, AE, QA, TL) (test).
- [x] CA-002 — Chaque sous-agent a un unique gestionnaire qui est un agent de rôle ; la répartition est figée par snapshot (test).
- [x] CA-003 — Aucun sous-agent n'a l'outil `Agent` ; tout sous-agent sans `Edit`/`Write` les interdit explicitement (test).
- [x] CA-004 — La liste de délégation d'un rôle = ses sous-agents + les 4 agents de gouvernance, sans sous-agent d'un autre rôle (test).
- [x] CA-005 — Toute skill référencée par un agent est livrée ; toute skill de rôle est utilisée par au moins un agent (test).
- [x] CA-006 — `validerEquipe` rend `ok` sur l'équipe livrée et `installed: false` sur un projet sans agents (test).
- [x] CA-007 — Délégation hors périmètre ou non bornée → refus motivé (test).
- [x] CA-008 — Sous-agent avec l'outil `Agent`, gestionnaire modifié, fichier absent, skill absente → signalés (test).
- [x] CA-009 — Sous-agent ajouté par le projet : accepté s'il est rattaché et délégué, orphelin sinon (test).
- [x] CA-010 — `agents use` écrit la clé `agent` en préservant les autres clés ; `none` la retire ; rôle inconnu, agent absent ou JSON invalide → refus sans écriture (test).
- [x] CA-011 — CLI : `list --json`, `validate` (exit 0 puis 1 après suppression d'un agent), `use` (test).
- [x] CA-012 — Parité dépôt ↔ livré étendue à `agents/` ; aucun fichier d'agent n'impose de mode de permission ; chaque agent de rôle porte une section « Décisions réservées à l'humain » (test).
- [x] CA-013 — `npm test`, `npm run lint`, `lint:deps`, `lint:size`, `lint:esm`, `lint:claims` passent.

## 4. Interface / API

```
aiad-sdd agents [list] [--json]
aiad-sdd agents validate [--json]        exit 0 conforme · 1 écarts
aiad-sdd agents use <pm|pe|ae|qa|tl|none>

Frontmatter d'un agent de rôle :
  name, description, tools: Agent(<sous-agents>, <AIAD-*>), <outils>
  model: inherit · memory: project · skills: [...] · aiad-role · aiad-kind: role-agent

Frontmatter d'un sous-agent :
  name, description, tools (sans Agent), disallowedTools, model, skills: [...]
  aiad-managed-by: <agent de rôle> · aiad-kind: sub-agent
```

Les clés `aiad-*` sont ignorées par Claude Code et lues par `agents validate`.

## 5. Points d'arrêt de l'agent

- Toute décision listée dans « Décisions réservées à l'humain » d'un agent de rôle.
- Tout verdict `NON-CONFORME` ou `UNKNOWN` d'un agent de gouvernance Tier 1.
- Tout rapport `JNSP` d'un sous-agent : il remonte à l'humain avec sa question.

## 6. Limites connues (dites plutôt que découvertes)

- **Appliqué / déclaratif.** La borne de délégation `Agent(...)` n'est appliquée par Claude Code que lorsque l'agent de rôle est la session principale. L'adoption d'un rôle en cours de session (`/aiad agents <rôle>`) repose sur la discipline du modèle. Les restrictions d'écriture « dans tel répertoire uniquement » (`pe-spec-writer`, `qa-test-author`, `pe-doc-writer`) sont des consignes, pas des droits d'accès.
- **Claude Code uniquement.** Les agents de rôle ne sont pas émis pour Cursor, Codex, Kiro ni Gemini.
- **Non mesuré.** L'utilité de chaque sous-agent n'a fait l'objet d'aucune mesure : l'équipe est livrée à dire d'expert, révisable par la skill `agent-monitoring`.
- **Essai en session réelle limité à un agent** (2026-11-15, projet temporaire installé par `init`, `claude --agent aiad-pe -p`) :
  - délégation bornée par l'outil : types disponibles = les 5 `pe-*` + les 4 `AIAD-*` ; le lancement de `qa-test-author` a été refusé (« Agent type 'qa-test-author' not found ») ;
  - `pe-drift-sentinel` lancé : skills `drift-detection` et `traceability` présentes dans son contexte sans appel à `Skill` ; pas d'outil `Agent` ;
  - **le champ `skills:` d'un agent de rôle n'est pas préchargé en session principale** (déclaration de l'agent, non recoupée autrement) — les fichiers d'agents de rôle demandent donc d'invoquer la skill si son contenu est absent ;
  - `aiad-pm`, `aiad-ae`, `aiad-qa`, `aiad-tech-lead` : non essayés.
- **Hook Stop `drift-lock` (antérieur à cette SPEC, non modifié).** Dans le projet d'essai, où `aiad-sdd` n'était pas installé localement, le hook a bloqué chaque clôture avec « 0 gap(s) bloquant(s) » : `npx --no-install aiad-sdd` échoue, le hook lit un stdout vide et bloque. La session a tourné 16 tours avant de s'arrêter. À traiter par un FACT distinct ; contournement utilisé pour l'essai : `AIAD_HOOK_SILENT=1`.

## 7. Dépendances

- Réutilise : `lib/frontmatter.js`, `lib/term.js`, `lib/update.js`, `lib/upgrade.js`, `lib/uninstall.js`, `lib/docs.js`, `scripts/check-commands-parity.js`.
- Skills existantes préchargées par les agents : `human-authorship-check`, `sqs-scoring`, `context-budget`, `grill-me`, `regulatory-veto`, `ears-validator`, `reasons-canvas`, `drift-detection`, `traceability`.

## 8. Definition of Output Done (DoOD)

- [x] Code + lint passing
- [x] Tests CA-001 à CA-012
- [x] Annotations `@intent INTENT-036` / `@spec SPEC-036-1-agents-de-role` / `@verified-by`
- [x] SPEC et code dans le même changement (Drift Lock)
- [x] SPEC validée par l'auteur (2026-11-15, après implémentation)
- [ ] Code review passée
- [x] Essai en session réelle (`claude --agent aiad-pe`) — un agent de rôle sur cinq, voir § 6
- [x] Gouvernance : aucune donnée personnelle (RGPD) ; zéro dépendance, modèles sobres par défaut pour les sous-agents de balayage (RGESN)

## Historique des modifications

| Date | Changement | Raison |
|------|------------|--------|
| 2026-11-15 | Création et implémentation dans la même session. SQS auto-évalué 4/5 : Complétude 1, Testabilité 1, Atomicité 0 (la SPEC couvre registre, 26 agents, 16 skills, CLI et distribution — plus d'une PR au sens du critère), Non-ambiguïté 1, Traçabilité 1. | Consigne de l'auteur du 2026-11-15 demandant conception et implémentation ensemble. Découpage a posteriori possible si l'auteur le souhaite. |
| 2026-11-15 | Essai en session réelle de `aiad-pe` ; § 6 mis à jour (délégation bornée constatée, skills non préchargées en session principale, défaut du hook `drift-lock` relevé). Corps des agents de rôle ajusté : « invoque la skill si son contenu est absent ». | Empirisme : ne pas affirmer ce qui n'a pas été observé. |
| 2026-11-15 | Validation par l'auteur (« validé ») : SPEC acceptée en l'état, sans découpage. Statut → ready. Version cible : 2.0 (décision de l'auteur). Limite `update` / sous-agents du projet documentée (README, guide SDD Mode, `docs/agents-de-role.md`, `/aiad agents`). | Réponse de l'auteur au compte rendu. |
