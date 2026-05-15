// AIAD SDD Mode — Dashboard : cycle time / lead time Intent (#438).
//
// Réponds à la question « combien de temps met-on à livrer un Intent
// entre le moment où il est capturé et le moment où il passe done ? »
// Statistiques p50/p95 + distribution + top 5 plus lents.
//
// Source de vérité : snapshots PM persistés par #433 (`.aiad/metrics/
// pm-snapshots/YYYY-MM-DD.json`). Pour chaque Intent done dans le
// snapshot le plus récent, on cherche dans l'historique le snapshot le
// plus ancien où il est apparu (= date approximative de capture).
// Fallback : `intent.date` du frontmatter ou `intent.mtime`.
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const JOUR_MS = 24 * 3600 * 1000;
const STATUTS_LIVRES = new Set(['done', 'archived']);

// Pour un Intent, retourne la date approximative de capture sous forme
// `Date.getTime()` ou null. Priorité :
//   1. plus ancien snapshot où l'Intent apparaît (peu importe son statut)
//   2. `date` frontmatter parsable
//   3. `mtime` filesystem (moins juste, mais fail-safe)
export function dateCapture(intent, snapshots) {
  if (snapshots && snapshots.length > 0) {
    for (const s of snapshots) {
      const trouve = (s.data?.intents || []).find((i) => i.id === intent.id);
      if (trouve) return new Date(s.date).getTime();
    }
  }
  if (intent.date) {
    const ts = Date.parse(intent.date);
    if (!isNaN(ts)) return ts;
  }
  return intent.mtime || null;
}

// Pour un Intent done/archived, retourne la date de livraison =
// premier snapshot où il apparaît avec statut livré, sinon `mtime`.
export function dateLivraison(intent, snapshots) {
  if (!STATUTS_LIVRES.has(intent.statut)) return null;
  if (snapshots && snapshots.length > 0) {
    for (const s of snapshots) {
      const trouve = (s.data?.intents || []).find((i) => i.id === intent.id);
      if (trouve && STATUTS_LIVRES.has(trouve.statut)) return new Date(s.date).getTime();
    }
  }
  return intent.mtime || null;
}

// Quantile linéaire (cohérent avec numpy/Excel PERCENTILE.INC).
export function quantile(values, q) {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (base + 1 < sorted.length) return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  return sorted[base];
}

export function calculerCycleTime(donnees, snapshots) {
  const intents = donnees?.intents || [];
  const livres = [];
  const enCours = [];
  for (const i of intents) {
    const capture = dateCapture(i, snapshots);
    if (STATUTS_LIVRES.has(i.statut)) {
      const liv = dateLivraison(i, snapshots);
      if (capture && liv && liv >= capture) {
        livres.push({
          id: i.id,
          titre: i.titre || '',
          file: i.file || null,
          leadJours: Math.round((liv - capture) / JOUR_MS),
          capture,
          livraison: liv,
        });
      }
    } else if (!['unknown', 'draft'].includes(i.statut) && capture) {
      const now = Date.now();
      enCours.push({
        id: i.id,
        titre: i.titre || '',
        file: i.file || null,
        ageJours: Math.round((now - capture) / JOUR_MS),
        statut: i.statut,
      });
    }
  }
  const leads = livres.map((l) => l.leadJours);
  const stats = leads.length > 0 ? {
    n: leads.length,
    p50: quantile(leads, 0.5),
    p95: quantile(leads, 0.95),
    moyenne: Math.round(leads.reduce((s, v) => s + v, 0) / leads.length),
    min: Math.min(...leads),
    max: Math.max(...leads),
  } : null;
  const plusLents = livres.sort((a, b) => b.leadJours - a.leadJours).slice(0, 5);
  const ageEnCours = enCours.sort((a, b) => b.ageJours - a.ageJours).slice(0, 5);
  return { stats, livres, enCours, plusLents, ageEnCours };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const CYCLE_CSS = `<style>
.cycle-stats { display:grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap:.5rem; margin:.5rem 0; }
.cycle-stat { padding:.5rem .65rem; border:1px solid var(--border, #ddd); border-radius:.4rem; background:var(--card-bg, #fff); }
.cycle-stat-label { font-size:.7rem; text-transform:uppercase; letter-spacing:.04em; color:var(--muted, #777); }
.cycle-stat-value { font-size:1.3rem; font-weight:700; margin-top:.1rem; }
.cycle-stat-suffix { font-size:.7rem; color:var(--muted, #777); margin-left:.15rem; }
</style>`;

function tableLines(items, options) {
  if (!items.length) return '';
  const rows = items.map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    const valeur = options.col2(it);
    return `<tr><td>${idCell}</td><td>${escape(it.titre)}</td><td class="muted">${valeur}</td></tr>`;
  }).join('');
  return `<h3 style="margin-top:1rem">${escape(options.titre)}</h3>
    <table><thead><tr><th>ID</th><th>Titre</th><th>${escape(options.colLabel)}</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

export function blocCycleTime(donnees) {
  const c = donnees?.cycleTime;
  if (!c) return '';
  if (!c.stats && c.enCours.length === 0) {
    return `<section>
      <h2>Vitesse de livraison <span class="count">aucun Intent livré</span></h2>
      <p class="muted">Aucun Intent en statut <code>done</code> ou <code>archived</code> avec date de capture exploitable. Le module se nourrit des snapshots PM (#433) — relance plusieurs fois <code>aiad-sdd dashboard</code> pour construire l'historique.</p>
    </section>`;
  }
  const stats = c.stats ? `<div class="cycle-stats">
    <div class="cycle-stat"><div class="cycle-stat-label">N livrés</div><div class="cycle-stat-value">${c.stats.n}</div></div>
    <div class="cycle-stat"><div class="cycle-stat-label">p50 (médiane)</div><div class="cycle-stat-value">${c.stats.p50}<span class="cycle-stat-suffix">j</span></div></div>
    <div class="cycle-stat"><div class="cycle-stat-label">p95</div><div class="cycle-stat-value">${c.stats.p95}<span class="cycle-stat-suffix">j</span></div></div>
    <div class="cycle-stat"><div class="cycle-stat-label">Moyenne</div><div class="cycle-stat-value">${c.stats.moyenne}<span class="cycle-stat-suffix">j</span></div></div>
    <div class="cycle-stat"><div class="cycle-stat-label">Min</div><div class="cycle-stat-value">${c.stats.min}<span class="cycle-stat-suffix">j</span></div></div>
    <div class="cycle-stat"><div class="cycle-stat-label">Max</div><div class="cycle-stat-value">${c.stats.max}<span class="cycle-stat-suffix">j</span></div></div>
  </div>` : '<p class="muted">Pas encore d\'Intent livré avec date de capture exploitable.</p>';
  return `${CYCLE_CSS}<section>
    <h2>Vitesse de livraison <span class="count">lead time Intent capture → done</span></h2>
    <p class="muted" style="font-size:.85rem">Statistiques calculées sur la base des snapshots PM (#433) — la précision s'améliore avec l'historique. Date de capture = plus ancien snapshot mentionnant l'Intent, fallback frontmatter <code>date:</code> ou mtime.</p>
    ${stats}
    ${tableLines(c.plusLents.slice(0, 3), { titre: 'Top 3 plus lents livrés', colLabel: 'Lead time', col2: (it) => `${it.leadJours} j` })}
    ${tableLines(c.ageEnCours.slice(0, 3), { titre: 'Top 3 en cours (âge depuis capture)', colLabel: 'Âge', col2: (it) => `${it.ageJours} j (${escape(it.statut)})` })}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  dateCapture as captureDate,
  dateLivraison as deliveryDate,
  quantile as percentile,
  calculerCycleTime as computeCycleTime,
  blocCycleTime as cycleTimeSection,
};
