# Budgets de poids RGESN — Dashboard

> Poids mesuré = taille du fichier HTML généré (non compressé), hors assets partagés.
> Budgets calibrés : tailles réelles × 1,2 (RESEARCH-022 — D2-B).
> Assets partagés (app.js + style.css) : budget global 45 KB.
> Overview relevé de 30 à 36 KB le 2026-11-15 (décision de l'auteur, règle de calibrage : taille réelle × 1,2) après l'ajout de la synthèse des métriques AIAD.
> Metrics relevé de 11 à 15 KB le 2026-11-15 (décision de l'auteur) : la page grossit avec les données de livraison accumulées, pas avec son gabarit.

| Page | Fichier | Budget HTML (KB) |
|------|---------|-----------------|
| Overview | dashboard/index.html | 36 |
| Métriques AIAD | dashboard/scorecard.html | 26 |
| PM Cockpit | dashboard/pm.html | 630 |
| Intents | dashboard/intents.html | 90 |
| Specs | dashboard/specs.html | 35 |
| Traceability | dashboard/traceability.html | 255 |
| Graph | dashboard/graph.html | 45 |
| Metrics | dashboard/metrics.html | 15 |
| QA | dashboard/qa.html | 40 |
| ADRs | dashboard/adrs.html | 35 |
| Legal | dashboard/legal.html | 15 |
| Governance | dashboard/governance.html | 33 |
| Drifts | dashboard/drifts.html | 11 |
| Changelog | dashboard/changelog.html | 15 |
| Onboarding | dashboard/onboarding.html | 25 |
| Kanban | dashboard/kanban.html | 55 |
| SRE | dashboard/sre.html | 8 |
| DPO | dashboard/dpo.html | 11 |
| Intent-pages (par page) | dashboard/intent-INTENT-*.html | 17 |
| Assets partagés (total) | dashboard/assets/ | 45 |
