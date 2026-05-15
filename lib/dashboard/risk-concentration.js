// AIAD SDD Mode — Dashboard : risk concentration by sponsor/owner (#521).
//
// Croise les risques (#439) avec les sponsors/owners pour identifier
// les **concentrations de risque** par stakeholder. Un sponsor qui
// porte 5 Intents à risque critical/high signale soit une zone très
// stratégique, soit une équipe en sur-tension.
//
// Politique :
//   - Groupe les Intents à risque (niveau critical/high) par sponsor
//   - Si l'Intent n'a pas de sponsor, group "(sans sponsor)"
//   - Compte par sponsor : nbCritique, nbHigh, total
//
// Pure transformation.

function lireSponsorsListe(intent) {
  const candidats = [intent?.sponsor, intent?.sponsors, intent?.stakeholder, intent?.stakeholders, intent?.business_owner];
  const out = [];
  for (const v of candidats) {
    if (!v) continue;
    if (Array.isArray(v)) { for (const x of v) if (x) out.push(String(x).trim()); }
    else if (typeof v === 'string') {
      for (const x of v.split(/[,;]/)) if (x.trim()) out.push(x.trim());
    }
  }
  const unique = [...new Set(out.filter(Boolean))];
  return unique.length ? unique : ['(sans sponsor)'];
}

export function calculerRiskConcentration(donnees) {
  const intentMap = new Map((donnees?.intents || []).map((i) => [i.id, i]));
  const risquesEleves = (donnees?.risks?.intents || []).filter((r) => r.niveau === 'critical' || r.niveau === 'high');
  const parSponsor = new Map();
  for (const r of risquesEleves) {
    const intent = intentMap.get(r.id);
    const sponsors = lireSponsorsListe(intent);
    for (const sp of sponsors) {
      if (!parSponsor.has(sp)) parSponsor.set(sp, { sponsor: sp, critical: 0, high: 0, intents: [] });
      const e = parSponsor.get(sp);
      if (r.niveau === 'critical') e.critical++;
      else if (r.niveau === 'high') e.high++;
      e.intents.push({ id: r.id, titre: intent?.titre || r.titre || '', niveau: r.niveau });
    }
  }
  const items = [...parSponsor.values()].map((e) => ({ ...e, total: e.critical + e.high }));
  items.sort((a, b) => b.critical - a.critical || b.high - a.high);
  return {
    items,
    totaux: {
      sponsors: items.length,
      totalCritical: items.reduce((s, i) => s + i.critical, 0),
      totalHigh: items.reduce((s, i) => s + i.high, 0),
      hotspot: items[0]?.total > 0 ? items[0].sponsor : null,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const RC_CSS = `<style>
.rc-row { padding:.45rem .6rem; margin:.25rem 0; border-radius:.3rem; background:rgba(127,127,127,.04); border-left:3px solid var(--accent, #4c6ef5); }
.rc-row.has-critical { border-left-color:#c92a2a; background:rgba(201,42,42,.04); }
.rc-row.has-high { border-left-color:#e8590c; }
.rc-head { display:flex; gap:.4rem; align-items:baseline; flex-wrap:wrap; font-size:.88rem; }
.rc-sponsor { font-weight:600; }
.rc-chip { padding:.05rem .35rem; border-radius:.18rem; font-size:.72rem; }
.rc-chip.critical { background:rgba(201,42,42,.15); color:#7a1717; }
.rc-chip.high { background:rgba(232,89,12,.15); color:#7a3a08; }
.rc-list { font-size:.75rem; color:var(--muted, #777); margin:.2rem 0 0; }
.rc-empty { padding:.5rem .7rem; background:rgba(43,138,62,.06); border-left:3px solid #2b8a3e; border-radius:.25rem; font-size:.85rem; color:#1c5a2a; }
</style>`;

export function blocRiskConcentration(donnees) {
  const r = donnees?.riskConcentration;
  if (!r) return '';
  if (r.items.length === 0) {
    return `${RC_CSS}<section>
      <h2>Concentration des risques par sponsor <span class="count">aucun risque élevé</span></h2>
      <div class="rc-empty">✓ Aucun Intent à risque critical/high — concentration nulle. Portefeuille en bon état risk-wise.</div>
    </section>`;
  }
  const t = r.totaux;
  const rows = r.items.slice(0, 12).map((it) => {
    const cls = it.critical > 0 ? 'has-critical' : it.high > 0 ? 'has-high' : '';
    const sample = it.intents.slice(0, 4).map((i) => `<code>${escape(i.id)}</code>`).join(' · ');
    return `<div class="rc-row ${cls}">
      <div class="rc-head">
        <span class="rc-sponsor">${escape(it.sponsor)}</span>
        ${it.critical > 0 ? `<span class="rc-chip critical">${it.critical} critical</span>` : ''}
        ${it.high > 0 ? `<span class="rc-chip high">${it.high} high</span>` : ''}
        <span class="rc-chip">total ${it.total}</span>
      </div>
      <div class="rc-list">${sample}</div>
    </div>`;
  }).join('');
  const hot = t.hotspot
    ? `<p class="muted" style="font-size:.85rem">🔥 <strong>${escape(t.hotspot)}</strong> concentre le plus de risques (${r.items[0].total}). Programmer un sync risk-focused.</p>`
    : '';
  return `${RC_CSS}<section>
    <h2>Concentration des risques par sponsor <span class="count">${t.sponsors} sponsor(s) · ${t.totalCritical} critical · ${t.totalHigh} high</span></h2>
    <p class="muted" style="font-size:.85rem">Croise les Intents à risque critical/high (#439) avec leur sponsor. Identifie les <strong>hotspots</strong> : sponsor qui porte plusieurs risques élevés = candidat à un sync risk-focused.</p>
    ${hot}
    <div>${rows}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerRiskConcentration as computeRiskConcentration,
  blocRiskConcentration as riskConcentrationSection,
};
