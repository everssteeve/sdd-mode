# SDD Trace — Matrice de traçabilité

> Généré le 2026-06-25T08:22:22.129Z

## Synthèse

| Métrique | Valeur |
|----------|--------|
| Intents | 8 |
| SPECs | 1 |
| Fichiers code | 388 (annotés : 81) |
| Fichiers test | 267 (annotés : 45) |

## Matrice Forward — Intent → SPEC → Code → Tests

| Intent | SPEC | Code | Tests | Verdict |
|--------|------|------|-------|---------|
| INTENT-020-spec-anchored-deltas | _(aucune SPEC)_ | — | — | ❌ orphelin |
| INTENT-021-empreinte-mesuree | _(aucune SPEC)_ | — | — | ❌ orphelin |
| INTENT-022-dogfooding-cli | _(aucune SPEC)_ | — | — | ❌ orphelin |
| INTENT-023-rayonnement-honnete | _(aucune SPEC)_ | — | — | ❌ orphelin |
| INTENT-027-ci-metrics-automation | _(aucune SPEC)_ | — | — | ❌ orphelin |
| INTENT-028-fiabilite-ci-bin-cartographie-trace | _(aucune SPEC)_ | — | — | ❌ orphelin |
| INTENT-029-archivage-facts-resolus | _(aucune SPEC)_ | — | — | ❌ orphelin |
| INTENT-031-auto-chaining-cycle-sdd | _(aucune SPEC)_ | — | — | ❌ orphelin |

## Matrice Backward — Tests → Code → SPEC → Intent

| Test | SPEC | Intent | Code couvert |
|------|------|--------|--------------|
| `templates/projects/fastapi-aiad/tests/test_main.py` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `templates/projects/node-aiad/test/index.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/ai-act-audit.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/ai-act-audit.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/annotations.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/annotations.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/annotations.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/annotations.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/annotations.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/annotations.test.js` | ❌ non-tracé | — | `lib/emit-rules.js`<br/>`lib/skills.js` |
| `test/annotations.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/anonymize.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/archive.test.js` | ❌ non-tracé | — | `lib/statusline.js` |
| `test/archive.test.js` | ❌ non-tracé | — | `lib/statusline.js` |
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
| `test/check-page-budgets.test.js` | ❌ non-tracé | — | `scripts/check-page-budgets.js` |
| `test/ci-templates.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/cli-adrs.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/cli-parsing.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/cli-schema.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/command-hooks.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/commands-registry.test.js` | ❌ non-tracé | — | `lib/commands-registry.js`<br/>`lib/deprecation.js` |
| `test/completion.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/confluence.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/coverage-threshold.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/cross-model.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/csp.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/cycle-graph.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-_history-utils.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-adrs.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-assets-autotag.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-assets.test.js` | ❌ non-tracé | — | `dashboard/assets/app.js`<br/>`dashboard/assets/app.js`<br/>`dashboard/assets/app.js`<br/>`lib/dashboard/assets.js`<br/>`lib/dashboard/assets.js`<br/>`lib/dashboard/assets.js`<br/>`lib/dashboard/assets.js`<br/>`lib/dashboard/assets.js`<br/>`lib/dashboard/assets.js`<br/>`lib/dashboard/ui/sparklines.js` |
| `test/dashboard-audit-trail.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-collect-supplementary.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-collect.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-digest.test.js` | ❌ non-tracé | — | `lib/dashboard.js`<br/>`lib/dashboard/digest-delta.js`<br/>`lib/dashboard/model/index.js`<br/>`lib/dashboard/model/index.js`<br/>`lib/dashboard/views/today.js` |
| `test/dashboard-dpo.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-ebm-aires.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-edge-cases.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-glossaire.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-graph.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-hill-charts.test.js` | ❌ non-tracé | — | `lib/dashboard/hill-charts.js`<br/>`lib/dashboard/model/index.js` |
| `test/dashboard-impact-effort.test.js` | ❌ non-tracé | — | `lib/dashboard/model/index.js`<br/>`lib/dashboard/rice-matrix.js` |
| `test/dashboard-inbox.test.js` | ❌ non-tracé | — | `lib/dashboard/model/index.js`<br/>`lib/dashboard/views/inbox.js` |
| `test/dashboard-intent-humans-agents.test.js` | ❌ non-tracé | — | `lib/dashboard/intent-humans-agents.js`<br/>`lib/dashboard/model/index.js` |
| `test/dashboard-kanban.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-learnings.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-legal.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-matrice-outcomes.test.js` | ❌ non-tracé | — | `lib/dashboard/model/index.js`<br/>`lib/dashboard/outcome-attribution.js` |
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
| `test/dashboard-pm-v39.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/dashboard-pm-v39.test.js` | ❌ non-tracé | — | `lib/drift-verdict.js`<br/>`lib/jnsp.js`<br/>`lib/verdict.js`<br/>`lib/veto.js` |
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
| `test/dashboard-spec-pages.test.js` | ❌ non-tracé | — | `lib/dashboard.js`<br/>`lib/dashboard/collect.js`<br/>`lib/dashboard/spec-page.js`<br/>`lib/dashboard/views/specs.js` |
| `test/dashboard-sre.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-tech-debt-history.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-tech-debt.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-today.test.js` | ❌ non-tracé | — | `lib/dashboard/views/today.js` |
| `test/dashboard-violations.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard-watch.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dashboard.test.js` | ❌ non-tracé | — | `lib/dashboard/views/today.js` |
| `test/dashboard.test.js` | ❌ non-tracé | — | `lib/dashboard/views/today.js` |
| `test/dashboard.test.js` | ❌ non-tracé | — | `lib/dashboard.js`<br/>`scripts/validate-data-schema.js` |
| `test/deprecation.test.js` | ❌ non-tracé | — | `lib/commands-registry.js`<br/>`lib/deprecation.js` |
| `test/dinum.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/discovery-gate.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/docs-dora-flow.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/docs.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/doctor-fix.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/doctor-supplementaire.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/doctor.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dora-record.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dpia.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/dpia.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/drift-verdict.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/dry-run.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/eco-dashboard.test.js` | ❌ non-tracé | — | `lib/dashboard.js`<br/>`lib/dashboard/model/index.js`<br/>`lib/dashboard/views/metrics.js`<br/>`lib/eco-dashboard.js`<br/>`lib/eco-dashboard.js`<br/>`lib/eco-dashboard.js`<br/>`lib/eco-dashboard.js` |
| `test/eco-estimator.test.js` | ❌ non-tracé | — | `lib/eco-estimator.js`<br/>`lib/eco-estimator.js` |
| `test/eco-hook.test.js` | ❌ non-tracé | — | `lib/eco-hook.js` |
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
| `test/guardrails.test.js` | ❌ non-tracé | — | `.aiad/hooks/veto.js`<br/>`lib/guardrails.js` |
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
| `test/leadership-metrics.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/leadership-metrics.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/leadership-metrics.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/leadership-metrics.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/leadership-metrics.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/leadership-metrics.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
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
| `test/multi-language.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/multi-language.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/multi-language.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/multi-language.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/multi-language.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
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
| `test/spec-suggester.test.js` | ❌ non-tracé | — | `lib/memory.js` |
| `test/spec-suggester.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/spec-suggester.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/spec-suggester.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/spec-suggester.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/spec-version.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/specs-library-vague2.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/specs-library-vague3.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/specs-library.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/standup-url.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/status.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/statusline.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/storybook.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/suggest-annotations.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/suggest-annotations.test.js` | ❌ non-tracé | — | `lib/drift-verdict.js`<br/>`lib/jnsp.js`<br/>`lib/verdict.js`<br/>`lib/veto.js` |
| `test/suggest-annotations.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/suggest-annotations.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/suggest-tests.test.js` | ❌ non-tracé | — | `lib/test-skeleton-generator.js` |
| `test/suggest-tests.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/suggest.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/sunset.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/tarball-hygiene.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/telemetry-usage.test.js` | ❌ non-tracé | — | `lib/telemetry.js` |
| `test/telemetry.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/templates.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/term.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/tour.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/trace-cache.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/trace-cache.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/trace-cache.test.js` | ❌ non-tracé | — | `lib/drift-verdict.js`<br/>`lib/jnsp.js`<br/>`lib/verdict.js`<br/>`lib/veto.js` |
| `test/trace-ears-gap.test.js` | ❌ non-tracé | — | `lib/sdd-trace.js` |
| `test/trace-ears-gap.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/trace-ears-gap.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/trace-git.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/trace-git.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/trace-git.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/trace-perf.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/trace-watch.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/trace-watch.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/trace-worker.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/trace.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/trace.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/trace.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/tutorial.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/uninstall.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/update-check.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/update.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/upgrade.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/validate-data-schema.test.js` | ❌ non-tracé | — | `lib/dashboard.js`<br/>`scripts/validate-data-schema.js` |
| `test/verdict.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/version-sync.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/veto.test.js` | ❌ non-tracé | — | `lib/feedback.js`<br/>`lib/tour.js`<br/>`scripts/bench-trace.js`<br/>`templates/projects/fastapi-aiad/app/main.py`<br/>`templates/projects/node-aiad/src/index.js` |
| `test/vscode-extension.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/vscode-snippets.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/webhooks.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/workspace-analytics.test.js` | ❌ non-tracé | — | _(aucun)_ |
| `test/workspace.test.js` | ❌ non-tracé | — | _(aucun)_ |

## Gaps détectés

### Orphelins
- Intents sans SPEC : **8**
  - INTENT-020-spec-anchored-deltas — Spec-anchored par construction — deltas et redevabilité bidirectionnelle
  - INTENT-021-empreinte-mesuree — Empreinte mesurée — tokens et coût par fonctionnalité
  - INTENT-022-dogfooding-cli — Dogfooding complet — le CLI sous SPEC
  - INTENT-023-rayonnement-honnete — Rayonnement honnête — comparatif public et runtimes élargis
  - INTENT-027-ci-metrics-automation — INTENT-027 — Automatisation CI de la collecte de métriques DORA/Flow
  - INTENT-028-fiabilite-ci-bin-cartographie-trace — INTENT-028 — Fiabilité CI bin/ + cartographie consommateurs traçabilité
  - INTENT-029-archivage-facts-resolus — INTENT-029 — Archivage automatique des FACTs résolus
  - INTENT-031-auto-chaining-cycle-sdd — Chaînage automatique conditionnel du cycle SDD + correctif hook Stop
- SPECs sans code (hors draft/review) : **0**
- SPECs orphelins référencés dans le code : **0**
- Intents orphelins référencés dans le code : **0**

### Non-implémentés
- SPECs validées sans code (statut ready/validation/done) : **0**

### EARS sans tests
- SPECs EARS sans tests liés (statut ≠ draft/archived) : **0**

### Non-tracés
- Code sans `@spec` : **322**
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
  - docs/_config.yml
  - lib/ai-act-audit.js
  - lib/anonymize.js
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
  - lib/command-hooks.js
  - lib/completion.js
  - … (+272 autres)
- Code annoté sans tests liés : **11**
  - .github/workflows/site-deploy.yml
  - lib/archive.js
  - lib/dashboard/ebm-aires.js
  - lib/dashboard/render.js
  - lib/dashboard/ui/badges.js
  - lib/dashboard/ui/helpers.js
  - lib/dashboard/views/changelog.js
  - lib/dashboard/views/drifts.js
  - lib/dashboard/views/intents.js
  - lib/dashboard/views/overview.js
  - lib/dashboard/views/traceability.js
