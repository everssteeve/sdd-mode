// AIAD SDD Mode — Dashboard : Intent state transitions timeline (#510).
//
// Lit `.aiad/metrics/pm-snapshots/*.json` (déjà persisté par
// `aiad-sdd dashboard --persist` ou snapshot manuel) puis détecte les
// **transitions d'état** par Intent : `draft → active → done`,
// régressions (`done → active`, signal), ou stagnations longues.
//
// Format snapshot attendu (existe dans bench) :
//   { "date": "YYYY-MM-DD", "intents": [{ "id": "...", "statut": "..." }], "specs": [...] }
//
// Pour chaque Intent traversant plusieurs snapshots, retient la liste
// des transitions horodatées + détecte les régressions.
//
// Aucun effet de bord. Pure lecture filesystem.
//
// Documentation : https://aiad.ovh

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function lireRep(rep) {
  try { return readdirSync(rep); } catch { return []; }
}

const RANK = { draft: 0, active: 1, 'in-progress': 1, review: 2, validation: 2, done: 3, archived: 4 };

export function lireSnapshotsPm(racineProjet) {
  const rep = join(racineProjet || '.', '.aiad', 'metrics', 'pm-snapshots');
  const out = [];
  for (const n of lireRep(rep)) {
    if (!n.endsWith('.json')) continue;
    try {
      const data = JSON.parse(readFileSync(join(rep, n), 'utf8'));
      const date = data.date || n.replace(/\.json$/, '');
      const ts = Date.parse(date);
      if (isNaN(ts)) continue;
      out.push({ date, ts, intents: data.intents || [], specs: data.specs || [] });
    } catch { /* ignore */ }
  }
  out.sort((a, b) => a.ts - b.ts);
  return out;
}

function normaliserStatut(s) {
  if (!s) return 'unknown';
  const k = String(s).toLowerCase().trim();
  if (k === 'in_progress' || k === 'inprogress') return 'in-progress';
  return k;
}

function detectionRegression(de, vers) {
  if (de == null || vers == null) return false;
  const rde = RANK[de];
  const rvers = RANK[vers];
  if (rde == null || rvers == null) return false;
  return rvers < rde;
}

export function calculerStateTransitions(racineProjet, donnees) {
  const snapshots = lireSnapshotsPm(racineProjet);
  if (snapshots.length < 2) {
    return { items: [], snapshots: snapshots.length, totaux: {}, message: snapshots.length === 0 ? 'aucun snapshot' : '1 seul snapshot — historique insuffisant' };
  }
  const transitionsParId = new Map();
  // Construire la timeline de statut par Intent.
  for (const snap of snapshots) {
    for (const i of snap.intents) {
      const id = i.id;
      const statut = normaliserStatut(i.statut);
      if (!transitionsParId.has(id)) transitionsParId.set(id, { id, etats: [] });
      const entry = transitionsParId.get(id);
      const dernier = entry.etats[entry.etats.length - 1];
      if (!dernier || dernier.statut !== statut) {
        entry.etats.push({ statut, ts: snap.ts, date: snap.date });
      }
    }
  }
  const intentsCourants = new Map((donnees?.intents || []).map((i) => [i.id, i]));
  const items = [];
  for (const entry of transitionsParId.values()) {
    if (entry.etats.length < 2) continue; // pas de transition
    const transitions = [];
    let regressions = 0;
    for (let i = 1; i < entry.etats.length; i++) {
      const de = entry.etats[i - 1].statut;
      const vers = entry.etats[i].statut;
      const reg = detectionRegression(de, vers);
      if (reg) regressions++;
      transitions.push({ de, vers, ts: entry.etats[i].ts, date: entry.etats[i].date, regression: reg });
    }
    const intentCourant = intentsCourants.get(entry.id);
    items.push({
      id: entry.id,
      titre: intentCourant?.titre || '',
      file: intentCourant?.file || null,
      statutCourant: intentCourant?.statut || entry.etats[entry.etats.length - 1].statut,
      etats: entry.etats,
      transitions,
      regressions,
      nbEtats: entry.etats.length,
    });
  }
  // Tri : régressions d'abord (signal), puis nbEtats desc (Intents actifs).
  items.sort((a, b) => {
    if (a.regressions !== b.regressions) return b.regressions - a.regressions;
    return b.nbEtats - a.nbEtats;
  });
  const totaux = {
    intents: items.length,
    avecRegression: items.filter((i) => i.regressions > 0).length,
    transitions: items.reduce((s, i) => s + i.transitions.length, 0),
  };
  return { items, snapshots: snapshots.length, totaux, message: null };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const ST_CSS = `<style>
.st-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:.4rem; margin:.4rem 0; }
.st-stat { padding:.4rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.st-stat .st-val { font-size:1.2rem; font-weight:700; }
.st-stat .st-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.st-stat.has-reg { background:rgba(201,42,42,.07); border-color:rgba(201,42,42,.3); }
.st-card { padding:.4rem .55rem; margin:.25rem 0; background:rgba(127,127,127,.04); border-radius:.3rem; }
.st-card.has-reg { border-left:3px solid #c92a2a; background:rgba(201,42,42,.04); }
.st-head { font-size:.85rem; display:flex; gap:.4rem; align-items:baseline; flex-wrap:wrap; }
.st-flow { display:flex; gap:.3rem; flex-wrap:wrap; font-size:.74rem; margin-top:.25rem; color:var(--muted, #555); }
.st-flow .st-step { padding:.05rem .35rem; background:rgba(76,110,245,.1); color:#3a4cba; border-radius:.18rem; }
.st-flow .st-step.s-done { background:rgba(43,138,62,.12); color:#1c5a2a; }
.st-flow .st-step.s-archived { background:rgba(127,127,127,.15); color:var(--muted, #777); }
.st-flow .st-step.s-draft { background:rgba(127,127,127,.08); }
.st-flow .st-step.has-reg { background:rgba(201,42,42,.15); color:#7a1717; }
.st-flow .st-arrow { color:var(--muted, #888); }
.st-meta { font-size:.7rem; color:var(--muted, #777); }
.st-msg { padding:.5rem .65rem; background:rgba(127,127,127,.05); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
</style>`;

function fmtDate(d) { return d ? String(d).slice(5) : '—'; }

export function blocStateTransitions(donnees) {
  const t = donnees?.stateTransitions;
  if (!t) return '';
  if (t.message) {
    return `${ST_CSS}<section>
      <h2>Transitions d'état Intent <span class="count">${escape(t.message)}</span></h2>
      <p class="muted" style="font-size:.85rem">Le module lit <code>.aiad/metrics/pm-snapshots/*.json</code> pour reconstituer la timeline des statuts par Intent. Lance régulièrement <code>aiad-sdd dashboard --persist</code> pour alimenter l'historique.</p>
    </section>`;
  }
  if (t.items.length === 0) {
    return `${ST_CSS}<section>
      <h2>Transitions d'état Intent <span class="count">${t.snapshots} snapshots · aucune transition détectée</span></h2>
      <div class="st-msg">Aucun Intent n'a changé de statut entre les snapshots disponibles. Le backlog est stable — ou les snapshots sont trop rapprochés.</div>
    </section>`;
  }
  const tt = t.totaux;
  const grid = [
    `<div class="st-stat"><div class="st-val">${tt.intents}</div><div class="st-label">Intents avec transitions</div></div>`,
    `<div class="st-stat ${tt.avecRegression > 0 ? 'has-reg' : ''}"><div class="st-val">${tt.avecRegression}</div><div class="st-label">Avec régression</div></div>`,
    `<div class="st-stat"><div class="st-val">${tt.transitions}</div><div class="st-label">Transitions total</div></div>`,
    `<div class="st-stat"><div class="st-val">${t.snapshots}</div><div class="st-label">Snapshots lus</div></div>`,
  ].join('');
  const cards = t.items.slice(0, 12).map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    const steps = it.etats.map((e, idx) => {
      const isReg = idx > 0 && detectionRegression(it.etats[idx - 1].statut, e.statut);
      const arrow = idx > 0 ? `<span class="st-arrow">→</span>` : '';
      return `${arrow}<span class="st-step s-${escape(e.statut)} ${isReg ? 'has-reg' : ''}" title="${escape(e.date)}">${escape(e.statut)} <span class="st-meta">${escape(fmtDate(e.date))}</span></span>`;
    }).join('');
    return `<div class="st-card ${it.regressions > 0 ? 'has-reg' : ''}">
      <div class="st-head">
        <strong>${idCell}</strong>
        <span>${escape((it.titre || '').slice(0, 50))}</span>
        <span class="st-meta">[${escape(it.statutCourant)}]</span>
        ${it.regressions > 0 ? `<span class="st-meta" style="color:#7a1717">⚠ ${it.regressions} régression(s)</span>` : ''}
      </div>
      <div class="st-flow">${steps}</div>
    </div>`;
  }).join('');
  return `${ST_CSS}<section>
    <h2>Transitions d'état Intent <span class="count">${tt.intents} Intent(s) avec ${tt.transitions} transition(s) sur ${t.snapshots} snapshots</span></h2>
    <p class="muted" style="font-size:.85rem">Reconstitue depuis <code>.aiad/metrics/pm-snapshots/*.json</code> les transitions de statut par Intent. Une <strong>régression</strong> (ex. <code>done → active</code>) signale un retravail non planifié. Tri régressions d'abord.</p>
    <div class="st-grid">${grid}</div>
    <div>${cards}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  lireSnapshotsPm as readPmSnapshots,
  calculerStateTransitions as computeStateTransitions,
  blocStateTransitions as stateTransitionsSection,
};
