// AIAD SDD Mode — Dashboard : KPI cards de l'index.html (#220-style refactor).
//
// Extrait de render.js (#152 / #225 / #226 / #227) pour rester sous la
// limite stricte 850 LOC effectives. Chaque fonction est zero-dep, retourne
// une chaîne HTML, et omet le rendu si la source de données n'est pas
// disponible (rétro-compat projets vierges).

import { escape } from './render.js';

// (#152) KPI Composants tiers SBOM. > 50 → warn, > 200 → bad.
export function kpiSbom(donnees) {
  const sbom = donnees?.supplementaire?.sbom;
  if (!sbom?.present) return '';
  const n = sbom.components || 0, cls = n > 200 ? 'bad' : n > 50 ? 'warn' : 'ok';
  return `<a class="kpi ${cls}" href="legal.html" style="text-decoration:none;color:inherit;display:block"><div class="label">Composants tiers SBOM</div><div class="value">${n}</div><div class="delta">${n > 50 ? 'audit recommandé · voir legal' : 'sous le seuil'}</div></a>`;
}

// (#225) KPI Score Souveraineté EU. Bronze→bad, Silver→warn, Gold/Platinum→ok.
export function kpiSovereignty(donnees) {
  const sov = donnees?.supplementaire?.sovereignty;
  if (!sov?.available) return '';
  const score = Number.isFinite(sov.score) ? sov.score : null;
  const max = Number.isFinite(sov.maxScore) ? sov.maxScore : 100;
  const lvl = String(sov.level || '').toLowerCase();
  const cls = lvl === 'platinum' || lvl === 'gold' ? 'ok'
    : lvl === 'silver' ? 'warn'
    : lvl === 'bronze' ? 'bad'
    : '';
  return `<a class="kpi ${cls}" href="legal.html" style="text-decoration:none;color:inherit;display:block">
    <div class="label">Souveraineté EU</div>
    <div class="value">${score ?? '—'}<span class="muted" style="font-size:.7rem">/${max}</span></div>
    <div class="delta">${escape(sov.level || '—')} · voir legal</div>
  </a>`;
}

// (#226) KPI Hook pre-commit p95. sain→ok, attention/dégradé→warn, critique→bad.
export function kpiHookStats(donnees) {
  const h = donnees?.supplementaire?.hookStats;
  if (!h?.available) return '';
  const cls = h.sante === 'sain' ? 'ok'
    : h.sante === 'attention' || h.sante === 'dégradé' || h.sante === 'degradé' ? 'warn'
    : h.sante === 'critique' ? 'bad'
    : '';
  const p95 = Number.isFinite(h.p95) ? h.p95 : null;
  const count = Number.isFinite(h.count) ? h.count : 0;
  return `<a class="kpi ${cls}" href="sre.html" style="text-decoration:none;color:inherit;display:block">
    <div class="label">Hook pre-commit p95</div>
    <div class="value">${p95 != null ? p95 + '<span class="muted" style="font-size:.7rem">ms</span>' : '—'}</div>
    <div class="delta">${escape(h.sante || 'inconnue')} · ${count} run(s) · voir SRE</div>
  </a>`;
}

// (#227) KPI Violations Gouvernance Tier 1. 0→ok, ≤3→warn, >3→bad.
export function kpiViolations(donnees) {
  const v = donnees?.violations;
  if (!v) return '';
  const total = v.total || 0;
  const cls = total === 0 ? 'ok' : total <= 3 ? 'warn' : 'bad';
  const delta = total === 0
    ? 'aucune dérive Tier 1 · voir gouvernance'
    : `${v.typeA?.total || 0} orpheline(s) · ${v.typeB?.total || 0} non implémentée(s) · voir gouvernance`;
  return `<a class="kpi ${cls}" href="governance.html" style="text-decoration:none;color:inherit;display:block">
    <div class="label">Violations Tier 1</div>
    <div class="value">${total}</div>
    <div class="delta">${escape(delta)}</div>
  </a>`;
}
