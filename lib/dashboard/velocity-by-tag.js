// AIAD SDD Mode — Dashboard : velocity by tag/theme (#540).
//
// Mesure la **vélocité par tag** : nb SPECs livrées (done/archived)
// dont l'Intent parent a ce tag. Identifie les thèmes où l'équipe
// shippe vs ceux qui stagnent.
//
// Pure transformation.

const STATUTS_LIVRES = new Set(['done', 'archived']);

function lireTags(intent) {
  const v = intent?.tags || intent?.Tags || intent?.labels;
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x).toLowerCase().trim()).filter(Boolean);
  if (typeof v === 'string') {
    return v.split(/[,;]/).map((x) => x.toLowerCase().trim()).filter(Boolean);
  }
  return [];
}

export function calculerVelocityByTag(donnees) {
  const intents = donnees?.intents || [];
  const specs = donnees?.specs || [];
  const tagsParCourt = new Map();
  for (const i of intents) {
    const court = i.id.split('-').slice(0, 2).join('-');
    const tags = lireTags(i);
    if (tags.length > 0) tagsParCourt.set(court, tags);
  }
  const parTag = new Map();
  for (const s of specs) {
    if (!STATUTS_LIVRES.has(s.statut) || !s.parentIntent) continue;
    const court = String(s.parentIntent).split('-').slice(0, 2).join('-');
    const tags = tagsParCourt.get(court);
    if (!tags) continue;
    for (const t of tags) {
      if (!parTag.has(t)) parTag.set(t, { tag: t, livrees: 0, intents: new Set(), specs: [] });
      const e = parTag.get(t);
      e.livrees++;
      e.intents.add(court);
      if (e.specs.length < 5) e.specs.push({ id: s.id });
    }
  }
  const items = [...parTag.values()].map((e) => ({
    tag: e.tag,
    livrees: e.livrees,
    nbIntents: e.intents.size,
    moyParIntent: Math.round((e.livrees / e.intents.size) * 10) / 10,
    specsEchantillon: e.specs,
  }));
  items.sort((a, b) => b.livrees - a.livrees);
  const totaux = {
    tags: items.length,
    totalLivrees: items.reduce((s, x) => s + x.livrees, 0),
    topTag: items[0]?.tag || null,
  };
  return { items, totaux };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const VT_CSS = `<style>
.vt-row { padding:.35rem .5rem; margin:.2rem 0; background:rgba(127,127,127,.04); border-radius:.25rem; display:flex; gap:.5rem; align-items:baseline; flex-wrap:wrap; font-size:.85rem; }
.vt-tag { padding:.05rem .4rem; background:rgba(76,110,245,.1); color:#3a4cba; border-radius:.18rem; font-weight:500; }
.vt-tag.top { background:rgba(43,138,62,.15); color:#1c5a2a; }
.vt-bar { width:120px; height:8px; background:rgba(127,127,127,.15); border-radius:4px; overflow:hidden; display:inline-block; vertical-align:middle; }
.vt-fill { height:100%; background:#2b8a3e; }
.vt-meta { font-size:.74rem; color:var(--muted, #777); }
.vt-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
</style>`;

export function blocVelocityByTag(donnees) {
  const v = donnees?.velocityByTag;
  if (!v) return '';
  if (v.items.length === 0) {
    return `${VT_CSS}<section>
      <h2>Vélocité par tag <span class="count">aucun tag livré</span></h2>
      <div class="vt-empty">Mesure SPECs livrées (done/archived) par tag d'Intent. Enrichis <code>tags: [theme1, theme2]</code> au frontmatter des Intents pour activer.</div>
    </section>`;
  }
  const t = v.totaux;
  const maxLivrees = Math.max(...v.items.map((x) => x.livrees), 1);
  const rows = v.items.slice(0, 15).map((it, idx) => {
    const pct = (it.livrees / maxLivrees) * 100;
    return `<div class="vt-row">
      <span class="vt-tag ${idx === 0 ? 'top' : ''}">#${escape(it.tag)}</span>
      <strong>${it.livrees}</strong> SPECs livrées
      <span class="vt-bar"><span class="vt-fill" style="width:${pct}%"></span></span>
      <span class="vt-meta">${it.nbIntents} Intent(s) · ${it.moyParIntent} SPECs/Intent</span>
    </div>`;
  }).join('');
  return `${VT_CSS}<section>
    <h2>Vélocité par tag <span class="count">${t.tags} tag(s) · ${t.totalLivrees} SPEC(s) livrée(s) au total</span></h2>
    <p class="muted" style="font-size:.85rem">Compte SPECs livrées (done/archived) groupées par tag d'Intent parent. Top tag : <strong>${escape(t.topTag || '?')}</strong>. Identifie les thèmes où l'équipe shippe vs ceux qui stagnent.</p>
    <div>${rows}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerVelocityByTag as computeVelocityByTag,
  blocVelocityByTag as velocityByTagSection,
};
