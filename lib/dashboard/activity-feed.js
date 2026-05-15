// AIAD SDD Mode — Dashboard : weekly PM activity feed (#557).
//
// Feed chronologique de tous les événements PM des **7 derniers jours** :
//   - Intents modifiés (mtime dans la fenêtre)
//   - SPECs modifiées
//   - Entrées journal
//   - Facts capturés
//   - Démos lancées
//
// Tri date desc.
//
// Pure lecture filesystem.

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DAY = 24 * 3600 * 1000;
const SEM = 7 * DAY;

function lireRep(rep) {
  try { return readdirSync(rep); } catch { return []; }
}

export function calculerActivityFeed(racineProjet, donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const limite = now - (options.dureeJours || 7) * DAY;
  const events = [];
  // Intents
  for (const i of donnees?.intents || []) {
    if (!i.mtime || i.mtime < limite) continue;
    events.push({
      type: 'intent',
      id: i.id,
      titre: i.titre || '',
      statut: i.statut,
      mtime: i.mtime,
    });
  }
  // SPECs
  for (const s of donnees?.specs || []) {
    if (!s.mtime || s.mtime < limite) continue;
    events.push({
      type: 'spec',
      id: s.id,
      titre: s.titre || '',
      statut: s.statut,
      mtime: s.mtime,
    });
  }
  // Journal entries
  const repJournal = join(racineProjet || '.', '.aiad', 'metrics', 'pm-journal');
  for (const n of lireRep(repJournal)) {
    if (!n.endsWith('.md')) continue;
    try {
      const mtime = statSync(join(repJournal, n)).mtimeMs;
      if (mtime < limite) continue;
      events.push({ type: 'journal', id: n, titre: '', mtime });
    } catch { /* ignore */ }
  }
  // Facts
  const repFacts = join(racineProjet || '.', '.aiad', 'facts');
  for (const n of lireRep(repFacts)) {
    if (!n.endsWith('.md')) continue;
    try {
      const mtime = statSync(join(repFacts, n)).mtimeMs;
      if (mtime < limite) continue;
      events.push({ type: 'fact', id: n, titre: '', mtime });
    } catch { /* ignore */ }
  }
  // Demo
  const repDemo = join(racineProjet || '.', '.aiad', 'metrics', 'demo');
  for (const n of lireRep(repDemo)) {
    try {
      const mtime = statSync(join(repDemo, n)).mtimeMs;
      if (mtime < limite) continue;
      events.push({ type: 'demo', id: n, titre: '', mtime });
    } catch { /* ignore */ }
  }
  events.sort((a, b) => b.mtime - a.mtime);
  return {
    events: events.slice(0, 30),
    totaux: {
      total: events.length,
      intents: events.filter((e) => e.type === 'intent').length,
      specs: events.filter((e) => e.type === 'spec').length,
      journal: events.filter((e) => e.type === 'journal').length,
      facts: events.filter((e) => e.type === 'fact').length,
      demos: events.filter((e) => e.type === 'demo').length,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const AF_CSS = `<style>
.af-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap:.4rem; margin:.4rem 0; }
.af-stat { padding:.4rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.af-stat .af-val { font-size:1.2rem; font-weight:700; }
.af-stat .af-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.af-feed { list-style:none; padding:0; margin:.3rem 0; max-height:340px; overflow-y:auto; border:1px solid var(--border, #eee); border-radius:.3rem; }
.af-item { padding:.3rem .55rem; border-bottom:1px solid var(--border, #f3f3f3); display:flex; gap:.4rem; align-items:baseline; font-size:.82rem; }
.af-item:last-child { border-bottom:0; }
.af-tag { padding:.05rem .35rem; border-radius:.15rem; font-size:.7rem; }
.af-tag.t-intent { background:rgba(76,110,245,.12); color:#3a4cba; }
.af-tag.t-spec { background:rgba(232,89,12,.12); color:#7a3a08; }
.af-tag.t-journal { background:rgba(245,166,35,.15); color:#7a560f; }
.af-tag.t-fact { background:rgba(43,138,62,.12); color:#1c5a2a; }
.af-tag.t-demo { background:rgba(201,42,42,.12); color:#7a1717; }
.af-meta { font-size:.72rem; color:var(--muted, #777); margin-left:auto; }
.af-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
</style>`;

function fmtRel(ts, now) {
  const delta = now - ts;
  if (delta < 3600 * 1000) return `${Math.floor(delta / 60000)} min`;
  if (delta < DAY) return `${Math.floor(delta / 3600000)} h`;
  return `${Math.floor(delta / DAY)} j`;
}

export function blocActivityFeed(donnees) {
  const f = donnees?.activityFeed;
  if (!f) return '';
  if (f.events.length === 0) {
    return `${AF_CSS}<section>
      <h2>Feed activité 7j <span class="count">aucune activité</span></h2>
      <div class="af-empty">Feed chronologique des Intents/SPECs/journal/facts/demos modifiés dans les 7 derniers jours.</div>
    </section>`;
  }
  const t = f.totaux;
  const grid = [
    `<div class="af-stat"><div class="af-val">${t.total}</div><div class="af-label">Total</div></div>`,
    `<div class="af-stat"><div class="af-val">${t.intents}</div><div class="af-label">Intents</div></div>`,
    `<div class="af-stat"><div class="af-val">${t.specs}</div><div class="af-label">SPECs</div></div>`,
    `<div class="af-stat"><div class="af-val">${t.journal}</div><div class="af-label">Journal</div></div>`,
    `<div class="af-stat"><div class="af-val">${t.facts}</div><div class="af-label">Facts</div></div>`,
    `<div class="af-stat"><div class="af-val">${t.demos}</div><div class="af-label">Demos</div></div>`,
  ].join('');
  const now = Date.now();
  const list = f.events.map((e) => {
    const idDisplay = e.type === 'intent' || e.type === 'spec'
      ? `<code>${escape(e.id)}</code>${e.titre ? ' <span>' + escape(e.titre.slice(0, 40)) + '</span>' : ''}`
      : `<code>${escape(e.id)}</code>`;
    return `<li class="af-item">
      <span class="af-tag t-${escape(e.type)}">${escape(e.type)}</span>
      ${idDisplay}
      ${e.statut ? `<span class="muted" style="font-size:.7rem">[${escape(e.statut)}]</span>` : ''}
      <span class="af-meta">il y a ${escape(fmtRel(e.mtime, now))}</span>
    </li>`;
  }).join('');
  return `${AF_CSS}<section>
    <h2>Feed activité 7j <span class="count">${t.total} événement(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Feed chronologique des artefacts modifiés sur 7j (Intents, SPECs, journal, facts, demos). Tri date desc. Max 30 items affichés.</p>
    <div class="af-grid">${grid}</div>
    <ul class="af-feed">${list}</ul>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerActivityFeed as computeActivityFeed,
  blocActivityFeed as activityFeedSection,
};
