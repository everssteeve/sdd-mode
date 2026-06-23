# SDD Trace — Matrice de traçabilité

> Généré le 2026-06-23T08:06:16.675Z

## Synthèse

| Métrique | Valeur |
|----------|--------|
| Intents | 25 |
| SPECs | 41 |
| Fichiers code | 381 (annotés : 72) |
| Fichiers test | 258 (annotés : 37) |

## Matrice Forward — Intent → SPEC → Code → Tests

| Intent | SPEC | Code | Tests | Verdict |
|--------|------|------|-------|---------|
| INTENT-001-feedback-qualitatif | SPEC-001-1-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` | `templates/projects/fastapi-aiad/tests/test_main.py`<br/>`test/ai-act-audit.test.js`<br/>`test/annotations.test.js`<br/>`test/dashboard-pm-v39.test.js`<br/>`test/dpia.test.js`<br/>`test/leadership-metrics.test.js`<br/>`test/multi-language.test.js`<br/>`test/spec-suggester.test.js`<br/>`test/suggest-annotations.test.js`<br/>`test/trace-cache.test.js`<br/>`test/trace-git.test.js`<br/>`test/trace-perf.test.js`<br/>`test/trace-watch.test.js`<br/>`test/trace.test.js`<br/>`test/veto.test.js`<br/>`tests/export.test.ts',`<br/>`tests/test_main.py`<br/>`test/index.test.js` | ✅ |
| INTENT-002-gouvernance-enforced | SPEC-002-1-gouvernance-enforced | `lib/drift-verdict.js`<br/>`lib/jnsp.js`<br/>`lib/verdict.js`<br/>`lib/veto.js` | `test/dashboard-pm-v39.test.js`<br/>`test/suggest-annotations.test.js`<br/>`test/trace-cache.test.js`<br/>`test/drift-verdict.test.js`<br/>`test/jnsp.test.js`<br/>`test/verdict.test.js`<br/>`test/veto.test.js` | ✅ |
| INTENT-003-research-phase | SPEC-003-1-research-phase | `lib/research.js` | `test/research.test.js` | ✅ |
| INTENT-004-execution-phasee | SPEC-004-1-execution-phasee | `lib/exec-status.js`<br/>`lib/mini-gate.js` | `test/exec-status.test.js`<br/>`test/mini-gate.test.js` | ✅ |
| INTENT-005-context-pull | SPEC-005-1-context-pull | `lib/emit-rules.js`<br/>`lib/skills.js` | `test/annotations.test.js`<br/>`test/emit-rules-pull.test.js`<br/>`tests/path/file.test.ts`<br/>`test/skills.test.js` | ✅ |
| INTENT-006-canary-suite | SPEC-006-1-canary-suite | `lib/canary.js` | `test/canary.test.js` | ✅ |
| INTENT-007-memory-native | SPEC-007-1-memory-native | `lib/memory.js` | `test/spec-suggester.test.js`<br/>`test/memory.test.js` | ✅ |
| INTENT-008-cycle-graph | SPEC-008-1-cycle-graph | `lib/cycle-graph.js` | `test/cycle-graph.test.js` | ✅ |
| INTENT-009-observabilite-native | SPEC-009-1-observabilite-native | `lib/statusline.js` | `test/archive.test.js`<br/>`test/statusline.test.js` | ✅ |
| INTENT-010-cross-model-review | SPEC-010-1-cross-model-review | `lib/cross-model.js` | `test/cross-model.test.js` | ✅ |
| INTENT-011-distribution-plugin-goal | SPEC-011-1-hooks-toggles | `lib/hooks-config.js` | `test/hooks-config.test.js` | ✅ |
| INTENT-012-garde-fous | SPEC-012-1-garde-fous | `lib/grill.js`<br/>`lib/proportionality.js`<br/>`lib/sunset.js` | `test/grill.test.js`<br/>`test/proportionality.test.js`<br/>`test/sunset.test.js` | ✅ |
| INTENT-013-zero-drift-sur-soi | SPEC-013-1-deploiement-site-valeurs | _(aucun)_ | _(aucun)_ | ⚠ non-implémentée |
| INTENT-013-zero-drift-sur-soi | SPEC-013-1a-deploiement-site | _(aucun)_ | _(aucun)_ | ⚠ non-implémentée |
| INTENT-013-zero-drift-sur-soi | SPEC-013-1b-unification-7-valeurs | _(aucun)_ | _(aucun)_ | ⚠ non-implémentée |
| INTENT-013-zero-drift-sur-soi | SPEC-013-2-unification-docs-racine | _(aucun)_ | _(aucun)_ | ⚠ non-implémentée |
| INTENT-013-zero-drift-sur-soi | SPEC-013-3-sync-version-zones-marquees | `lib/version-sync.js` | `test/version-sync.test.js` | ✅ |
| INTENT-013-zero-drift-sur-soi | SPEC-013-4-deploy-site-workflow | `.github/workflows/site-deploy.yml`<br/>`.github/workflows/site-deploy.yml`<br/>`.github/workflows/site-deploy.yml` | _(aucun)_ | ⚠ non-testée |
| INTENT-013-zero-drift-sur-soi | SPEC-013-4a-deploy-workflow | `.github/workflows/site-deploy.yml`<br/>`.github/workflows/site-deploy.yml`<br/>`.github/workflows/site-deploy.yml` | _(aucun)_ | ⚠ non-testée |
| INTENT-013-zero-drift-sur-soi | SPEC-013-4b-gate-rgaa | `.github/workflows/site-deploy.yml`<br/>`.github/workflows/site-deploy.yml`<br/>`.github/workflows/site-deploy.yml` | _(aucun)_ | ⚠ non-testée |
| INTENT-014-empirisme-prouve | SPEC-014-1-gates-bloquants-badge | `scripts/coverage-threshold.js` | `test/coverage-threshold.test.js` | ✅ |
| INTENT-014-empirisme-prouve | SPEC-014-2-sourcing-claims | `scripts/lint-claims.js` | `test/lint-claims.test.js` | ✅ |
| INTENT-015-sobriete-cli | SPEC-015-1-telemetrie-usage | `lib/telemetry.js` | `test/telemetry-usage.test.js` | ✅ |
| INTENT-015-sobriete-cli | SPEC-015-2-1-registre-commandes | `lib/commands-registry.js`<br/>`lib/deprecation.js` | `test/commands-registry.test.js`<br/>`test/deprecation.test.js` | ✅ |
| INTENT-015-sobriete-cli | SPEC-015-2-2-cycle-depreciation | `lib/commands-registry.js`<br/>`lib/deprecation.js` | `test/commands-registry.test.js`<br/>`test/deprecation.test.js` | ✅ |
| INTENT-015-sobriete-cli | SPEC-015-3-matrice-garde-fous | `.aiad/hooks/veto.js`<br/>`lib/guardrails.js` | `test/guardrails.test.js` | ✅ |
| INTENT-016-dashboard-fondations | SPEC-016-1-architecture-4-couches | `lib/dashboard/model/index.js`<br/>`lib/dashboard/render.js`<br/>`lib/dashboard/ui/badges.js`<br/>`lib/dashboard/ui/helpers.js`<br/>`lib/dashboard/ui/sparklines.js`<br/>`lib/dashboard/views/changelog.js`<br/>`lib/dashboard/views/drifts.js`<br/>`lib/dashboard/views/intents.js`<br/>`lib/dashboard/views/metrics.js`<br/>`lib/dashboard/views/overview.js`<br/>`lib/dashboard/views/specs.js`<br/>`lib/dashboard/views/traceability.js` | _(aucun)_ | ⚠ non-testée |
| INTENT-016-dashboard-fondations | SPEC-016-2-design-system-rgaa | `dashboard/assets/app.js`<br/>`dashboard/assets/app.js`<br/>`dashboard/assets/app.js`<br/>`lib/dashboard/assets.js`<br/>`lib/dashboard/assets.js`<br/>`lib/dashboard/assets.js`<br/>`lib/dashboard/assets.js`<br/>`lib/dashboard/assets.js`<br/>`lib/dashboard/assets.js`<br/>`lib/dashboard/ui/sparklines.js` | `test/dashboard-assets.test.js`<br/>`dans` | ✅ |
| INTENT-016-dashboard-fondations | SPEC-016-3-data-json-v2 | `lib/dashboard.js`<br/>`scripts/validate-data-schema.js` | `test/dashboard.test.js`<br/>`test/validate-data-schema.test.js` | ✅ |
| INTENT-016-dashboard-fondations | SPEC-016-4-rgesn-budgets | `scripts/check-page-budgets.js` | `test/check-page-budgets.test.js` | ✅ |
| INTENT-017-dashboard-quotidien | SPEC-017-1-page-aujourdhui | `lib/dashboard/views/today.js` | `test/dashboard-today.test.js`<br/>`test/dashboard.test.js` | ✅ |
| INTENT-017-dashboard-quotidien | SPEC-017-2-inbox-triage | `lib/dashboard/views/inbox.js`<br/>`lib/dashboard/model/index.js` | `test/dashboard-inbox.test.js` | ✅ |
| INTENT-017-dashboard-quotidien | SPEC-017-3-digest-delta | `lib/dashboard/digest-delta.js`<br/>`lib/dashboard.js`<br/>`lib/dashboard/model/index.js`<br/>`lib/dashboard/model/index.js`<br/>`lib/dashboard/views/today.js` | `test/dashboard-digest.test.js`<br/>`test/dashboard-today.test.js` | ✅ |
| INTENT-017-dashboard-quotidien | SPEC-017-4-pages-detail-spec | `lib/dashboard.js`<br/>`lib/dashboard/collect.js`<br/>`lib/dashboard/spec-page.js`<br/>`lib/dashboard/views/specs.js` | `test/dashboard-spec-pages.test.js` | ✅ |
| INTENT-018-valeur-boussole | SPEC-018-1-matrice-outcomes-intents | `lib/dashboard/model/index.js`<br/>`lib/dashboard/outcome-attribution.js` | `test/dashboard-matrice-outcomes.test.js` | ✅ |
| INTENT-018-valeur-boussole | SPEC-018-2-aires-ebm-investment-balance | _(aucun)_ | _(aucun)_ | ⚠ non-implémentée |
| INTENT-018-valeur-boussole | SPEC-018-3-hill-charts-sdd | _(aucun)_ | _(aucun)_ | ⚠ non-implémentée |
| INTENT-018-valeur-boussole | SPEC-018-4-bilan-humains-agents | _(aucun)_ | _(aucun)_ | ⚠ non-implémentée |
| INTENT-018-valeur-boussole | SPEC-018-5-impact-effort-en-attente | _(aucun)_ | _(aucun)_ | ⚠ non-implémentée |
| INTENT-019-verification-first | _(aucune SPEC)_ | — | — | ❌ orphelin |
| INTENT-020-spec-anchored-deltas | _(aucune SPEC)_ | — | — | ❌ orphelin |
| INTENT-021-empreinte-mesuree | _(aucune SPEC)_ | — | — | ❌ orphelin |
| INTENT-022-dogfooding-cli | _(aucune SPEC)_ | — | — | ❌ orphelin |
| INTENT-023-rayonnement-honnete | _(aucune SPEC)_ | — | — | ❌ orphelin |
| INTENT-024-trace-exemption-specs-sans-code | SPEC-024-1-trace-exemption | `lib/sdd-trace.js` | `test/trace.test.js`<br/>`chemin/relatif/test.ts` | ✅ |
| INTENT-025-contraste-kicker | SPEC-025-1-gold-contrast-fix | _(aucun)_ | _(aucun)_ | ⚠ non-implémentée |

## Matrice Backward — Tests → Code → SPEC → Intent

| Test | SPEC | Intent | Code couvert |
|------|------|--------|--------------|
| `test/dashboard-digest.test.js` | SPEC-017-3-digest-delta | INTENT-017-dashboard-quotidien | `lib/dashboard/digest-delta.js`<br/>`lib/dashboard.js`<br/>`lib/dashboard/model/index.js`<br/>`lib/dashboard/model/index.js`<br/>`lib/dashboard/views/today.js` |
| `test/dashboard-inbox.test.js` | SPEC-017-2-inbox-triage | INTENT-017-dashboard-quotidien | `lib/dashboard/views/inbox.js`<br/>`lib/dashboard/model/index.js` |
| `test/dashboard-matrice-outcomes.test.js` | SPEC-018-1-matrice-outcomes-intents | INTENT-018-valeur-boussole | `lib/dashboard/model/index.js`<br/>`lib/dashboard/outcome-attribution.js` |
| `templates/projects/fastapi-aiad/tests/test_main.py` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `templates/projects/node-aiad/test/index.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/ai-act-audit.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/ai-act-audit.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/annotations.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/annotations.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/annotations.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/annotations.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/annotations.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/annotations.test.js` | SPEC-005-1-context-pull | INTENT-005-context-pull | `lib/emit-rules.js`<br/>`lib/skills.js` |
| `test/annotations.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/anonymize.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/archive.test.js` | SPEC-009-1-observabilite-native | INTENT-009-observabilite-native | `lib/statusline.js` |
| `test/audit.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/azure-devops.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/backup.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/badge.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/badges-block.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/bench-comparison.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/bench-compose-prod.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/bench-dockerfile.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/bench-history.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/bench-start-script.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/bench.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/bitbucket.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/brief.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/bun-compat.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/bun-parity.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/canary.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/cert.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/check-page-budgets.test.js` | SPEC-016-4-rgesn-budgets | INTENT-016-dashboard-fondations | `scripts/check-page-budgets.js` |
| `test/ci-templates.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/cli-adrs.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/cli-parsing.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/cli-schema.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/command-hooks.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/commands-registry.test.js` | SPEC-015-2-1-registre-commandes | INTENT-015-sobriete-cli | `lib/commands-registry.js`<br/>`lib/deprecation.js` |
| `test/completion.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/confluence.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/coverage-threshold.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/cross-model.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/csp.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/cycle-graph.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-_history-utils.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-adrs.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-assets-autotag.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-assets.test.js` | SPEC-016-2-design-system-rgaa | INTENT-016-dashboard-fondations | `dashboard/assets/app.js`<br/>`dashboard/assets/app.js`<br/>`dashboard/assets/app.js`<br/>`lib/dashboard/assets.js`<br/>`lib/dashboard/assets.js`<br/>`lib/dashboard/assets.js`<br/>`lib/dashboard/assets.js`<br/>`lib/dashboard/assets.js`<br/>`lib/dashboard/assets.js`<br/>`lib/dashboard/ui/sparklines.js` |
| `test/dashboard-audit-trail.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-collect-supplementary.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-collect.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-dpo.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-edge-cases.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-glossaire.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-graph.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-kanban.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-learnings.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-legal.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-onboarding.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-outcomes-history.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-outcomes.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-perf-budgets.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-extras.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v10.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v11.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v12.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v13.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v14.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v15.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v16.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v17.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v18.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v19.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v2.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v20.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v21.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v22.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v23.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v24.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v25.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v26.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v27.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v28.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v29.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v3.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v30.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v31.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v32.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v33.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v34.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v35.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v36.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v37.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v38.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v39.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/dashboard-pm-v39.test.js` | SPEC-002-1-gouvernance-enforced | INTENT-002-gouvernance-enforced | `lib/drift-verdict.js`<br/>`lib/jnsp.js`<br/>`lib/verdict.js`<br/>`lib/veto.js` |
| `test/dashboard-pm-v4.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v40.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v41.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v42.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v43.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v44.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v45.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v46.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v47.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v5.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v6.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v7.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v8.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm-v9.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-pm.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-qa.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-render.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-rituels.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-sante-globale-history.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-sante-globale.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-source-base.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-spec-pages.test.js` | SPEC-017-4-pages-detail-spec | INTENT-017-dashboard-quotidien | `lib/dashboard.js`<br/>`lib/dashboard/collect.js`<br/>`lib/dashboard/spec-page.js`<br/>`lib/dashboard/views/specs.js` |
| `test/dashboard-sre.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-tech-debt-history.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-tech-debt.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-today.test.js` | SPEC-017-1-page-aujourdhui | INTENT-017-dashboard-quotidien | `lib/dashboard/views/today.js` |
| `test/dashboard-violations.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-watch.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard.test.js` | SPEC-017-1-page-aujourdhui | INTENT-017-dashboard-quotidien | `lib/dashboard/views/today.js` |
| `test/dashboard.test.js` | SPEC-017-1-page-aujourdhui | INTENT-017-dashboard-quotidien | `lib/dashboard/views/today.js` |
| `test/dashboard.test.js` | SPEC-016-3-data-json-v2 | INTENT-016-dashboard-fondations | `lib/dashboard.js`<br/>`scripts/validate-data-schema.js` |
| `test/deprecation.test.js` | SPEC-015-2-1-registre-commandes | INTENT-015-sobriete-cli | `lib/commands-registry.js`<br/>`lib/deprecation.js` |
| `test/dinum.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/discovery-gate.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/docs-dora-flow.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/docs.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/doctor-fix.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/doctor-supplementaire.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/doctor.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dora-record.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dpia.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/dpia.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/drift-verdict.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dry-run.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/emit-rules-agents.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/emit-rules-concurrent.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/emit-rules-pull.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/emit-rules.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/en-aliases.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/exec-status.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/favicon.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/forges-ci.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/frontmatter-integration.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/frontmatter.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/fs-ops-errors.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/fs-ops.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/github-action.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/github-app.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/gitlab.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/governance-apac.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/governance-ch-fadp.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/governance-cra.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/governance-eu-extended-vague2.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/governance-eu-extended.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/governance-eu-financial.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/governance-eu-platforms.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/governance-fr-anssi.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/governance-iso-standards.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/governance-latam.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/governance-lint.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/governance-marketplace.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/governance-packs.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/grill.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/guardrails.test.js` | SPEC-015-3-matrice-garde-fous | INTENT-015-sobriete-cli | `.aiad/hooks/veto.js`<br/>`lib/guardrails.js` |
| `test/hook-sandbox.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/hooks-config.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/i18n-coverage.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/i18n.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/import.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/init-parallel.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/init-snapshot.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/init-tui.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/init.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/jnsp.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/json-output.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/leadership-metrics.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/leadership-metrics.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/leadership-metrics.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/leadership-metrics.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/leadership-metrics.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/leadership-metrics.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/lint-claims.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/lint-deps.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/lint-esm.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/lint-size.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/lockfile.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/manifest.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/marketplace.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/memory.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/meta-share.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/meta.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/migrate-v2.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/migrate.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/mini-gate.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/multi-language.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/multi-language.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/multi-language.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/multi-language.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/mutation-batch.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/mutation-test.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/negotiate.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/notfound.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/obsidian-export.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/offline.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/openapi-conformity.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/openapi-export.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/org-config.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/pii-scan.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/plugins.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/pre-commit.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/proportionality.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/provenance.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/rbac.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/refactor-spec.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/reflect.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/release.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/repl.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/reproducibility.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/research.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/review.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/sarif.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/sarif.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/sbom.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/score.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/sdd-trace-aliases.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/security-md.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/self-update.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/server-mime.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/sitemap.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/skills.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/sla.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/sovereignty-score.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/spec-suggester.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/spec-suggester.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/spec-suggester.test.js` | SPEC-007-1-memory-native | INTENT-007-memory-native | `lib/memory.js` |
| `test/spec-suggester.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/spec-suggester.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/spec-suggester.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/spec-suggester.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/spec-version.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/specs-library-vague2.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/specs-library-vague3.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/specs-library.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/standup-url.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/status.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/statusline.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/storybook.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/suggest-annotations.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/suggest-annotations.test.js` | SPEC-002-1-gouvernance-enforced | INTENT-002-gouvernance-enforced | `lib/drift-verdict.js`<br/>`lib/jnsp.js`<br/>`lib/verdict.js`<br/>`lib/veto.js` |
| `test/suggest-annotations.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/suggest-annotations.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/suggest.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/sunset.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/tarball-hygiene.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/telemetry-usage.test.js` | SPEC-015-1-telemetrie-usage | INTENT-015-sobriete-cli | `lib/telemetry.js` |
| `test/telemetry.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/templates.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/term.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/tour.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/trace-cache.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/trace-cache.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/trace-cache.test.js` | SPEC-002-1-gouvernance-enforced | INTENT-002-gouvernance-enforced | `lib/drift-verdict.js`<br/>`lib/jnsp.js`<br/>`lib/verdict.js`<br/>`lib/veto.js` |
| `test/trace-git.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/trace-git.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/trace-git.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/trace-perf.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/trace-watch.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/trace-watch.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/trace-worker.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/trace.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/trace.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/trace.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/tutorial.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/uninstall.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/update-check.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/update.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/upgrade.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/validate-data-schema.test.js` | SPEC-016-3-data-json-v2 | INTENT-016-dashboard-fondations | `lib/dashboard.js`<br/>`scripts/validate-data-schema.js` |
| `test/verdict.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/version-sync.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/veto.test.js` | SPEC-001-1-feedback-qualitatif | INTENT-001-feedback-qualitatif | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/vscode-extension.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/vscode-snippets.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/webhooks.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/workspace-analytics.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/workspace.test.js` | ❌ non-tracé | — | _(aucun)_ |

## Gaps détectés

### Orphelins
- Intents sans SPEC : **5**
  - INTENT-019-verification-first — Verification-first — dériver des tests des critères EARS
  - INTENT-020-spec-anchored-deltas — Spec-anchored par construction — deltas et redevabilité bidirectionnelle
  - INTENT-021-empreinte-mesuree — Empreinte mesurée — tokens et coût par fonctionnalité
  - INTENT-022-dogfooding-cli — Dogfooding complet — le CLI sous SPEC
  - INTENT-023-rayonnement-honnete — Rayonnement honnête — comparatif public et runtimes élargis
- SPECs sans code (hors draft/review) : **5**
  - SPEC-013-1-deploiement-site-valeurs (statut : split)
  - SPEC-013-1a-deploiement-site (statut : done)
  - SPEC-013-1b-unification-7-valeurs (statut : archived)
  - SPEC-013-2-unification-docs-racine (statut : done)
  - SPEC-025-1-gold-contrast-fix (statut : done)
- SPECs orphelins référencés dans le code : **0**
- Intents orphelins référencés dans le code : **0**

### Non-implémentés
- SPECs validées sans code (statut ready/validation/done) : **0**

### Non-tracés
- Code sans `@spec` : **325**
  - .aiad/config.yml
  - .aiad/hook-bypass.yml
  - .aiad/hooks/discovery-gate.js
  - .aiad/hooks/drift-lock.js
  - .aiad/hooks/jnsp-scan.js
  - .aiad/hooks/session-start.js
  - .aiad/hooks/skill-usage.js
  - .aiad/hooks/statusline.js
  - .aiad/schema/cli-openapi.yaml
  - .github/actions/aiad-sdd/action.yml
  - .github/aiad-app-manifest.yml
  - .github/workflows/aiad-docs-check.yml
  - .github/workflows/aiad-emit-rules-check.yml
  - .github/workflows/aiad-pr-review.yml
  - .github/workflows/aiad-version-check.yml
  - .github/workflows/bun-smoke.yml
  - .github/workflows/canary.yml
  - .github/workflows/ci.yml
  - .github/workflows/mutation.yml
  - .github/workflows/release.yml
  - .github/workflows/sdd-trace.yml
  - bench/scenario-autonomous-run/url-shortener/.aiad/config.yml
  - bench/scenario-autonomous-run/url-shortener/.aiad/hook-bypass.yml
  - bench/scenario-autonomous-run/url-shortener/.aiad/hooks/session-start.js
  - bench/scenario-autonomous-run/url-shortener/.aiad/pm-links.yml
  - bench/scenario-autonomous-run/url-shortener/.github/aiad-app-manifest.yml
  - bench/scenario-autonomous-run/url-shortener/.github/workflows/aiad-dashboard.yml
  - bench/scenario-autonomous-run/url-shortener/.github/workflows/aiad-docs-check.yml
  - bench/scenario-autonomous-run/url-shortener/.github/workflows/aiad-emit-rules-check.yml
  - bench/scenario-autonomous-run/url-shortener/.github/workflows/aiad-pr-review.yml
  - bench/scenario-autonomous-run/url-shortener/.github/workflows/sdd-trace.yml
  - bench/scenario-autonomous-run/url-shortener/dashboard/assets/app.js
  - bench/scenario-autonomous-run/url-shortener/docker-compose.prod.yml
  - bench/scenario-autonomous-run/url-shortener/docker-compose.yml
  - bin/aiad-sdd.js
  - docs/_config.yml
  - lib/ai-act-audit.js
  - lib/anonymize.js
  - lib/archive.js
  - lib/audit.js
  - lib/azure-devops.js
  - lib/backup.js
  - lib/badge.js
  - lib/bench-history.js
  - lib/bitbucket.js
  - lib/brief.js
  - lib/cert.js
  - lib/ci-templates.js
  - lib/cli-schema.js
  - lib/coldstart.js
  - … (+275 autres)
- Code annoté sans tests liés : **10**
  - .github/workflows/site-deploy.yml
  - lib/dashboard/render.js
  - lib/dashboard/ui/badges.js
  - lib/dashboard/ui/helpers.js
  - lib/dashboard/views/changelog.js
  - lib/dashboard/views/drifts.js
  - lib/dashboard/views/intents.js
  - lib/dashboard/views/metrics.js
  - lib/dashboard/views/overview.js
  - lib/dashboard/views/traceability.js
