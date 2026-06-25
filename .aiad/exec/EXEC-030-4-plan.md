# EXEC-030-4 — Plan d'exécution phasé

> Exécution phasée (§3.6) — tranches verticales testables.
> Marqueurs : `[ ]` à faire · `[~]` en cours · `[x]` validé · `[!]` bloqué · `[-]` hors-scope.

**SPEC** : SPEC-030-4-dashboard-eco
**Intent** : INTENT-030
**SQS** : 5/5 — Gate ouverte 2026-06-25
**Gouvernance** : WARN RGAA (th scope + contraste — à livrer dans phase 1)

---

## Phase 1 — lib/eco-dashboard.js : collecterEcoMetrics() + pageEco()  [x]

- Objectif : module ESM complet avec collecte des 30 dernières entrées hook-runs.jsonl, calcul co2Total30/moyenne/tendance, et renderer HTML pageEco() conforme RGAA
- Fichiers : `lib/eco-dashboard.js` (nouveau)
- Tests : `test/eco-dashboard.test.js` — 7 critères d'acceptation (absent, <15 sessions, unknown, null co2g, malformé, tendance, normal)
- Done : `node --test test/eco-dashboard.test.js` vert, `<th scope="col">` présent dans pageEco(), libellé "estimation indicative (non certifiée)" présent
- Conditions : contraste AA non testable automatiquement en node:test (visuel uniquement, noted)

## Phase 2 — Intégration lib/dashboard.js + génération eco.html  [x]

- Objectif : entrée `eco` dans RENDERERS + entrée `eco` dans PAGES (render.js) → eco.html généré à chaque `/aiad dashboard-html`
- Fichiers : `lib/dashboard.js`, `lib/dashboard/render.js`
- Tests : vérification via `node -e "import('./lib/dashboard.js').then(m => m.dashboard('.', {out: 'dashboard'}))"` sans erreur
- Done : `dashboard/eco.html` généré, widget visible dans `dashboard/metrics.html`
- Conditions : —
