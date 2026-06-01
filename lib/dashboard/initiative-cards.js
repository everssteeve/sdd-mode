// AIAD SDD Mode — Dashboard : initiative summary cards by tag (#558).
//
// Pour chaque tag majeur (top 8 par fréquence), produit une **carte
// récap d'initiative** : nb Intents, nb SPECs livrées, % progression,
// dernier mtime, sample d'IDs.
//
// Pure transformation.

const STATUTS_LIVRES = new Set(['done', 'archived']);

function lireTags(intent) {
  const v = intent?.tags || intent?.Tags || intent?.labels;
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x).toLowerCase().trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(/[,;]/).map((x) => x.toLowerCase().trim()).filter(Boolean);
  return [];
}

export function calculerInitiativeCards(donnees, options = {}) {
  const maxCards = options.maxCards || 8;
  const intents = donnees?.intents || [];
  const specs = donnees?.specs || [];
  const specsParCourt = new Map();
  for (const s of specs) {
    if (!s.parentIntent) continue;
    const court = String(s.parentIntent).split('-').slice(0, 2).join('-');
    if (!specsParCourt.has(court)) specsParCourt.set(court, []);
    specsParCourt.get(court).push(s);
  }
  const parTag = new Map();
  for (const i of intents) {
    if (['archived'].includes(i.statut)) continue;
    const tags = lireTags(i);
    if (tags.length === 0) continue;
    const court = i.id.split('-').slice(0, 2).join('-');
    const specsLies = specsParCourt.get(court) || [];
    for (const t of tags) {
      if (!parTag.has(t)) parTag.set(t, { tag: t, intents: [], specs: [] });
      const e = parTag.get(t);
      e.intents.push({ id: i.id, titre: i.titre || '', statut: i.statut, mtime: i.mtime, priority: i.priority || null });
      for (const s of specsLies) e.specs.push(s);
    }
  }
  const items = [...parTag.values()].map((e) => {
    const total = e.specs.length;
    const livrees = e.specs.filter((s) => STATUTS_LIVRES.has(s.statut)).length;
    const ratio = total === 0 ? null : Math.round((livrees / total) * 100);
    const lastMtime = e.intents.reduce((max, i) => Math.max(max, i.mtime || 0),
      e.specs.reduce((m, s) => Math.max(m, s.mtime || 0), 0));
    return {
      tag: e.tag,
      nbIntents: e.intents.length,
      nbSpecs: total,
      livreesSpecs: livrees,
      ratio,
      lastMtime: lastMtime || null,
      intentsSample: e.intents.slice(0, 3),
    };
  });
  items.sort((a, b) => b.nbIntents - a.nbIntents || b.nbSpecs - a.nbSpecs);
  return {
    items: items.slice(0, maxCards),
    totaux: {
      total: items.length,
      affiches: Math.min(items.length, maxCards),
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const IC_CSS = `<style>
.ic-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:.5rem; margin:.4rem 0; }
.ic-card { padding:.6rem .75rem; border-radius:.4rem; background:rgba(76,110,245,.05); border-left:3px solid #4c6ef5; }
.ic-card.high { border-left-color:#2b8a3e; background:rgba(43,138,62,.05); }
.ic-head { font-weight:700; font-size:1rem; display:flex; gap:.4rem; align-items:baseline; flex-wrap:wrap; }
.ic-tag { padding:.05rem .4rem; background:rgba(76,110,245,.12); color:#3a4cba; border-radius:.18rem; font-size:.78rem; }
.ic-bar { width:100%; height:8px; background:rgba(127,127,127,.15); border-radius:4px; overflow:hidden; margin:.3rem 0; }
.ic-fill { height:100%; transition:width .15s; }
.ic-fill.high { background:#2b8a3e; }
.ic-fill.mid { background:#f5a623; }
.ic-fill.low { background:#e8590c; }
.ic-meta { font-size:.74rem; color:var(--muted, #777); }
.ic-sample { font-size:.74rem; margin-top:.3rem; }
.ic-sample code { padding:.05rem .25rem; background:rgba(127,127,127,.1); border-radius:.15rem; margin-right:.2rem; }
.ic-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
</style>`;

function fmtDate(ts) { return ts ? new Date(ts).toLocaleDateString('fr-FR') : '—'; }

export function blocInitiativeCards(donnees) {
  const i = donnees?.initiativeCards;
  if (!i) return '';
  if (i.items.length === 0) {
    return `${IC_CSS}<section>
      <h2>Cartes d'initiatives par thème <span class="count">aucune initiative</span></h2>
      <div class="ic-empty">Pour chaque tag majeur (top 8 par fréquence), génère une mini-fiche récap : Intents portés, SPECs livrées, % progression, dernière activité.</div>
    </section>`;
  }
  const t = i.totaux;
  const cards = i.items.map((it) => {
    const pct = it.ratio == null ? 0 : it.ratio;
    const fillCls = pct >= 60 ? 'high' : pct >= 30 ? 'mid' : 'low';
    const cardCls = pct >= 60 ? 'high' : '';
    const samples = it.intentsSample.map((x) => `<code>${escape(x.id)}</code>`).join('');
    return `<div class="ic-card ${cardCls}">
      <div class="ic-head">
        <span class="ic-tag">#${escape(it.tag)}</span>
        <span>${it.nbIntents} Intent(s)</span>
        <span>${it.livreesSpecs}/${it.nbSpecs} SPECs</span>
      </div>
      <div class="ic-bar"><div class="ic-fill ${fillCls}" style="width:${pct}%"></div></div>
      <div class="ic-meta">${pct}% livré · dernière activité ${escape(fmtDate(it.lastMtime))}</div>
      <div class="ic-sample">${samples}</div>
    </div>`;
  }).join('');
  return `${IC_CSS}<section>
    <h2>Cartes d'initiatives par thème <span class="count">${t.affiches}/${t.total} tag(s) affiché(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Vue compacte par thème (tag majeur). Pour chaque tag : Intents portés, SPECs livrées avec progress bar, dernière activité, sample d'IDs. Tri Intents desc.</p>
    <div class="ic-grid">${cards}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerInitiativeCards as computeInitiativeCards,
  blocInitiativeCards as initiativeCardsSection,
};
