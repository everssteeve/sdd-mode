// AIAD SDD Mode — Dashboard : prochains rituels AIAD (#548).
//
// Calcule les **prochains rituels AIAD** attendus selon leur cadence,
// basé sur le dernier mtime observé dans `.aiad/metrics/{demo,retro,
// sync-strat,standup,intention,tech-review}`.
//
// Cadences canoniques :
//   - standup       : quotidien (1j)
//   - demo          : hebdo (7j) ou bi-hebdo (14j)
//   - tech-review   : hebdo (7j)
//   - sync-strat    : mensuel (30j)
//   - retro         : trimestriel (90j)
//   - intention     : mensuel (30j)
//
// Pure lecture filesystem.

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DAY = 24 * 3600 * 1000;
const RITUELS = [
  { id: 'standup', label: 'Standup', dossier: 'standup', cadenceJours: 1, emoji: '🔁' },
  { id: 'demo', label: 'Demo & Feedback', dossier: 'demo', cadenceJours: 7, emoji: '🎬' },
  { id: 'tech-review', label: 'Tech Review', dossier: 'tech-review', cadenceJours: 7, emoji: '🔧' },
  { id: 'sync-strat', label: 'Sync stratégique', dossier: 'sync-strat', cadenceJours: 30, emoji: '🎯' },
  { id: 'retro', label: 'Rétrospective', dossier: 'retro', cadenceJours: 90, emoji: '🔄' },
  { id: 'intention', label: "Atelier d'Intention", dossier: 'intention', cadenceJours: 30, emoji: '💡' },
];

function lireRep(rep) {
  try { return readdirSync(rep); } catch { return []; }
}

function dernierMtime(rep) {
  let max = 0;
  for (const n of lireRep(rep)) {
    if (n.startsWith('.')) continue;
    try {
      const m = statSync(join(rep, n)).mtimeMs;
      if (m > max) max = m;
    } catch { /* ignore */ }
  }
  return max || null;
}

export function calculerRitualsCalendar(racineProjet, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const items = RITUELS.map((r) => {
    const rep = join(racineProjet || '.', '.aiad', 'metrics', r.dossier);
    const lastMtime = dernierMtime(rep);
    let prochain = null, etat = 'jamais', joursDepuis = null, joursAvant = null;
    if (lastMtime) {
      const delta = now - lastMtime;
      joursDepuis = Math.floor(delta / DAY);
      prochain = lastMtime + r.cadenceJours * DAY;
      joursAvant = Math.floor((prochain - now) / DAY);
      if (joursAvant < 0) etat = 'retard';
      else if (joursAvant <= 1) etat = 'imminent';
      else if (joursAvant <= 7) etat = 'proche';
      else etat = 'planifie';
    }
    return {
      ...r,
      lastMtime,
      prochain,
      joursDepuis,
      joursAvant,
      etat,
    };
  });
  // Tri : retard d'abord, puis imminent, puis proche, puis jamais
  const RANK = { retard: 0, imminent: 1, proche: 2, jamais: 3, planifie: 4 };
  items.sort((a, b) => (RANK[a.etat] ?? 99) - (RANK[b.etat] ?? 99));
  const totaux = {
    total: items.length,
    retard: items.filter((i) => i.etat === 'retard').length,
    imminent: items.filter((i) => i.etat === 'imminent').length,
    jamais: items.filter((i) => i.etat === 'jamais').length,
  };
  return { items, totaux };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const RC_CSS = `<style>
.rc-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:.5rem; margin:.4rem 0; }
.rc-card { padding:.55rem .7rem; border-radius:.35rem; background:rgba(127,127,127,.04); border-left:3px solid var(--accent, #4c6ef5); }
.rc-card.e-retard { border-left-color:#c92a2a; background:rgba(201,42,42,.05); }
.rc-card.e-imminent { border-left-color:#e8590c; background:rgba(232,89,12,.04); }
.rc-card.e-proche { border-left-color:#f5a623; }
.rc-card.e-jamais { border-left-color:rgba(127,127,127,.3); opacity:.85; }
.rc-card.e-planifie { border-left-color:#2b8a3e; }
.rc-head { display:flex; gap:.4rem; align-items:baseline; font-size:.92rem; }
.rc-emoji { font-size:1.1rem; }
.rc-tag { padding:.05rem .35rem; background:rgba(127,127,127,.1); border-radius:.18rem; font-size:.7rem; }
.rc-tag.e-retard { background:rgba(201,42,42,.15); color:#7a1717; }
.rc-tag.e-imminent { background:rgba(232,89,12,.15); color:#7a3a08; }
.rc-tag.e-proche { background:rgba(245,166,35,.15); color:#7a560f; }
.rc-tag.e-jamais { background:rgba(127,127,127,.12); }
.rc-meta { font-size:.74rem; color:var(--muted, #777); margin-top:.25rem; }
</style>`;

const LABELS = {
  retard: '⚠ en retard',
  imminent: '🔔 imminent',
  proche: '◐ cette semaine',
  jamais: '⊘ jamais lancé',
  planifie: '✓ planifié',
};

function fmtDate(ts) { return ts ? new Date(ts).toLocaleDateString('fr-FR') : '—'; }

export function blocRitualsCalendar(donnees) {
  const r = donnees?.ritualsCalendar;
  if (!r) return '';
  const t = r.totaux;
  const cards = r.items.map((it) => {
    const last = it.lastMtime ? `Dernier ${fmtDate(it.lastMtime)} (il y a ${it.joursDepuis}j)` : 'Jamais exécuté';
    const next = it.prochain ? `Prochain ${fmtDate(it.prochain)} (${it.joursAvant >= 0 ? '+' : ''}${it.joursAvant}j)` : 'Lancer dès que possible';
    return `<div class="rc-card e-${escape(it.etat)}">
      <div class="rc-head">
        <span class="rc-emoji">${it.emoji}</span>
        <strong>${escape(it.label)}</strong>
        <span class="rc-tag e-${escape(it.etat)}">${escape(LABELS[it.etat])}</span>
      </div>
      <div class="rc-meta">${escape(last)} · cadence ${it.cadenceJours}j</div>
      <div class="rc-meta">${escape(next)}</div>
    </div>`;
  }).join('');
  return `${RC_CSS}<section>
    <h2>Calendrier rituels AIAD <span class="count">${t.retard} retard · ${t.imminent} imminent · ${t.jamais} jamais</span></h2>
    <p class="muted" style="font-size:.85rem">Calcule les prochains rituels AIAD attendus selon leur cadence (standup 1j · demo 7j · tech-review 7j · sync-strat 30j · retro 90j · intention 30j) basé sur le dernier mtime dans <code>.aiad/metrics/</code>.</p>
    <div class="rc-grid">${cards}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerRitualsCalendar as computeRitualsCalendar,
  blocRitualsCalendar as ritualsCalendarSection,
  RITUELS as AIAD_RITUALS,
};
