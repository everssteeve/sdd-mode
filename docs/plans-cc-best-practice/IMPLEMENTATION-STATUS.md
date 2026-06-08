# Suivi d'implémentation — Roadmap CC best-practice

> Mis à jour au fil de la loop `/loop 5 implémente …`. Ordre = ordre suggéré des plans.
> Branche : `dev`. Aucun commit effectué (sera proposé en fin de loop / sur demande).

## Ordre d'implémentation retenu (dépendances)

1. **§3.4** Verdicts machine-vérifiables *(fondationnel — prérequis de 3.1/3.2/3.3/3.6/3.9)*
2. **§3.2** TODO-JNSP → hook `PreToolUse` *(modèle de hook)*
3. **§3.3** Drift Lock → hook `Stop` *(réutilise `trace`)*
4. **§3.1** Vetos Tier 1 enforced
5. **§3.5 / §3.6 / §3.7** (P1)
6. **§3.8 / §3.9 / §3.10** (P2)
7. **§3.11 / §3.12 / §3.13 + §4** (P3 + garde-fous)

## État

| # | Élément | Statut | Livrables | Tests |
|---|---------|--------|-----------|-------|
| 3.4a | Module de verdict `lib/verdict.js` (contrat + exit 0/1/2 + validateur JSON Schema) | ✅ Fait | `lib/verdict.js`, `.aiad/schema/verdicts/{gate,trace,validate,security}.schema.json` | `test/verdict.test.js` (18 ✓) |
| 3.4b | Câblage CLI + flags `--output-format verdict` / `--json-schema` au dispatch `bin/`. NB : `gate`/`validate`/`security` sont des **slash-commands** (skills), pas des commandes CLI → leur câblage verdict ira dans les corps de skills (templates). `trace` câblé (mode verdict requis par §3.3). | ✅ Fait (trace) · ⏳ skills à suivre | `bin/aiad-sdd.js` (flags + `chargerSchemaVerdict` + branche trace) | via `drift-verdict.test.js` + e2e |
| 3.3-core | Logique de verdict Drift Lock déterministe (PASS/FAIL/JNSP) | ✅ Fait | `lib/drift-verdict.js` | `test/drift-verdict.test.js` (7 ✓) |
| 3.2 | Hook `PreToolUse` JNSP enforced (logique pure `lib/jnsp.js` + hook self-contained + settings) | ✅ Fait | `lib/jnsp.js`, `.aiad/hooks/jnsp-scan.js` (+template), `templates/.claude/settings.json` (PreToolUse `if: Bash(git commit *)`) | `test/jnsp.test.js` (11 ✓, dont 3 d'intégration exécutant le hook) |
| 3.3-hook | Hook `Stop` Drift Lock (`trace --output-format verdict` + `asyncRewake`) | ✅ Fait | `.aiad/hooks/drift-lock.js` (+template), `templates/.claude/settings.json` (Stop) | smoke e2e (decision:block + exit 2) |
| — | `pre-commit.sh` conservé intact (défense en profondeur) ; init copie les nouveaux hooks (vérifié) | ✅ | — | `test/pre-commit.test.js` + init/snapshot (46 ✓) |
| 3.1-L2 | Subagents Tier 1 générés par `emit-rules` (read-only `tools`, `disallowedTools`, `PROACTIVELY`, `memory: project`, `paths:` scopés, fail-closed) | ✅ Fait | `lib/emit-rules.js` (`genererClaudeAgent` + boucle `claude-code`) → `.claude/agents/AIAD-*.md` | `test/emit-rules-agents.test.js` (3 ✓) |
| 3.1-L1 | `managed-settings.json` org (deny gouvernance + `hard_deny` anti `--no-verify`/`--force`) | ✅ Fait (template opt-in) | `templates/managed-settings.json` | JSON validé |
| 3.1-L3 | Commande CLI `veto` déterministe par diff (matcher de glob maison + check `@governance` fail-closed) + hook `PreToolUse` self-contained | ✅ Fait | `lib/veto.js`, `bin/aiad-sdd.js` (case `veto` + `--diff`), `.aiad/hooks/veto.js` (+template), `templates/.claude/settings.json`, `.aiad/schema/verdicts/veto.schema.json` | `test/veto.test.js` (13 ✓) |

## ✅ Jalon : SOCLE P0 COMPLET (§3.1–§3.4)

Toute la fondation « advisory → enforced » est livrée et vérifiée :
- **52 tests neufs** (verdict 18 · drift-verdict 7 · jnsp 11 · emit-agents 3 · veto 13)
- **Suite complète : 3632 pass / 0 fail / 1 skip** — zéro régression
- lint · esm · size : verts
- 7 schémas/verdicts versionnés, 3 hooks harness (PreToolUse JNSP+veto, Stop drift-lock), 4 subagents Tier 1, managed-settings org

### ✅ Jalon : §3.5 COMPLET (research/Discovery — SPEC-A + SPEC-B)
- **SPEC-A** — gate Research GO/NO-GO déterministe + Discovery ancré : `lib/research.js`, schéma `research.schema.json`, CLI `aiad-sdd research <id>` (exit 0/1/2), commande `/sdd research` dual-mode, template d'artefact + `.aiad/research/_index.md`, dossier créé par `init`.
- **SPEC-B** — prérequis Discovery enforced :
  - CLI `aiad-sdd discovery-check [INTENT-NNN]` (réutilise `discoveryPrete()`, exit 0/1/2) + schéma `discovery.schema.json`.
  - Hook **`UserPromptSubmit`** `discovery-gate.js` (self-contained, shell-out CLI comme `veto.js`) : rappel `additionalContext` sur `/sdd spec|exec`, mode strict opt-in `AIAD_DISCOVERY_STRICT=1` → `decision: block`, bypass `AIAD_HOOK_SILENT=1`. Enregistré dans `templates/.claude/settings.json`.
  - Prérequis Discovery écrit dans les corps `/sdd spec` + `/sdd exec` (proportionné : court-circuit tracé admis).
  - **Cycle documenté** mis à jour `Intent → Research (GO/NO-GO) → SPEC → Gate → … → Drift Lock` (générateur `lib/emit-rules.js` × 4 + `CLAUDE.md` + `templates/CLAUDE.md`).
- Tests : `test/research.test.js` (20 ✓) + `test/discovery-gate.test.js` (10 ✓). Suite complète **3662 pass / 0 fail / 1 skip**.

### ✅ Jalon : §3.6 livré (exécution phasée + mini-gates + CONDITIONAL — SPEC-A + SPEC-B)
- **SPEC-A** — 3ᵉ verdict `CONDITIONAL` (déjà au contrat `lib/verdict.js`) surfacé par le mini-gate. *(Reste opt-in : scoring dimensionnel 0-10 + evidence sur `gate`/`validate`.)*
- **SPEC-B** — exécution phasée :
  - `lib/exec-status.js` — parser de plan phasé + marqueurs `[ ][~][x][!][-]`, progression, prochaine tranche (reprise).
  - `lib/mini-gate.js` — verdict par tranche `PASS|CONDITIONAL|FAIL|JNSP` (runner injectable) + agrégat de plan, schéma `minigate.schema.json`.
  - CLI `aiad-sdd mini-gate <spec> --phase N|--all` + `exec-status <spec>` (flag `--phase`).
  - Artefacts `templates/.aiad/exec-plan-template.md` + `.aiad/exec/_index.md` ; dossier créé par `init`.
  - Corps `/sdd exec` (plan phasé + mini-gates), `/sdd resume` (reprise à `[~]`/`[!]`), skill `sqs-scoring` (3ᵉ verdict).
- Tests : `exec-status.test.js` (11 ✓) + `mini-gate.test.js` (13 ✓). Suite **3686 pass / 0 fail / 1 skip**.
- *Reste (ultérieur)* : scoring dimensionnel 0-10, hook `PostToolBatch` (warning tranche sans tests verts), toggle `config.yml exec.phased`.

### Reste à faire (P1 → P3 + garde-fous) — non démarré
- **P1** : §3.7 (contexte pull)
- **P2** : §3.8 (memory native), §3.9 (graphe Tasks), §3.10 (canary + alignement modèles)
- **P3** : §3.11 (OTel/statusLine), §3.12 (cross-model), §3.13 (plugin/goal)
- **§4** : garde-fous (doctrine + grill-me + proportionnalité + sunset)
| 3.5 | Research + GO/NO-GO + Discovery | ✅ Fait (SPEC-A + SPEC-B) | `lib/research.js`, `bin/aiad-sdd.js` (cases `research` + `discovery-check`), schémas `research`/`discovery`, `.aiad/hooks/discovery-gate.js` (+template, `UserPromptSubmit`), `templates/.claude/sdd/{research,spec,exec}.md`, `templates/.claude/settings.json`, `templates/.aiad/research-template.md` + `_index.md`, cycle (`emit-rules.js` + 2× `CLAUDE.md`), `lib/init.js` | `research.test.js` (20 ✓) + `discovery-gate.test.js` (10 ✓) |
| 3.6 | Exécution phasée + mini-gates + CONDITIONAL | ✅ Fait (SPEC-A + SPEC-B ; dimensions 0-10 + PostToolBatch ultérieurs) | `lib/exec-status.js`, `lib/mini-gate.js`, `bin/aiad-sdd.js` (cases `mini-gate` + `exec-status`), `minigate.schema.json`, `templates/.aiad/exec-plan-template.md` + `exec/_index.md`, `templates/.claude/sdd/{exec,resume}.md`, skill `sqs-scoring`, `lib/init.js` | `exec-status.test.js` (11 ✓) + `mini-gate.test.js` (13 ✓) |
| 3.7 | Budget instructions push→pull | ⏳ À faire | — | — |
| 3.8 | Memory native | ⏳ À faire | — | — |
| 3.9 | Cycle graphe Tasks | ⏳ À faire | — | — |
| 3.10 | Canary + alignement modèles | ⏳ À faire | — | — |
| 3.11 | Observabilité OTel/statusLine | ⏳ À faire | — | — |
| 3.12 | Cross-model additive | ⏳ À faire | — | — |
| 3.13 | Distribution plugin + goal | ⏳ À faire | — | — |
| 4 | Garde-fous | ⏳ À faire | — | — |

## Invariants respectés

- Zéro-dep, ESM strict, en-têtes JSDoc FR, alias EN en fin de fichier.
- `node scripts/lint.js` / `lint-esm` / `lint-size --strict` verts.
- Aucun fichier existant cassé à ce stade (`lib/verdict.js` est additif).
