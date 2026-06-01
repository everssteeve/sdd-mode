// AIAD SDD Mode — Dashboard : backlog hygiene suggestions (#503).
//
// Détecte 4 types de candidats au nettoyage backlog et émet des
// suggestions actionnables :
//   1. Drafts vieux > 90j → proposer descope ou archive
//   2. Active sans SPEC > 60j → proposer décomposition ou archive
//   3. Done très vieux (> 180j) → proposer archive (déblayer)
//   4. Titres potentiellement dupliqués (similarité Jaccard ≥ 0.6
//      sur tokens normalisés)
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const DAY = 24 * 3600 * 1000;

function tokens(titre) {
  return (String(titre || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 3));
}

export function jaccard(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function indexerSpecs(specs) {
  const m = new Map();
  for (const s of specs || []) {
    if (!s.parentIntent) continue;
    const court = String(s.parentIntent).split('-').slice(0, 2).join('-');
    if (!m.has(court)) m.set(court, []);
    m.get(court).push(s);
  }
  return m;
}

function detecterDoublons(intents) {
  const out = [];
  const indexes = intents.map((i, idx) => ({ idx, id: i.id, titre: i.titre, tokens: tokens(i.titre) }));
  for (let i = 0; i < indexes.length; i++) {
    for (let j = i + 1; j < indexes.length; j++) {
      if (indexes[i].tokens.length === 0 || indexes[j].tokens.length === 0) continue;
      const sim = jaccard(indexes[i].tokens, indexes[j].tokens);
      if (sim >= 0.6) {
        out.push({
          a: indexes[i].id, titreA: indexes[i].titre,
          b: indexes[j].id, titreB: indexes[j].titre,
          similarite: Math.round(sim * 100) / 100,
        });
      }
    }
  }
  // Limite à 10 paires pour éviter le bruit
  return out.slice(0, 10);
}

export function calculerBacklogHygiene(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const intents = donnees?.intents || [];
  const specsParCourt = indexerSpecs(donnees?.specs);

  const draftsVieux = [];
  const activeSansSpec = [];
  const doneTresVieux = [];

  for (const i of intents) {
    if (!i.mtime) continue;
    const age = Math.floor((now - i.mtime) / DAY);
    const court = i.id.split('-').slice(0, 2).join('-');
    const specs = specsParCourt.get(court) || [];
    if (i.statut === 'draft' && age > 90) {
      draftsVieux.push({ id: i.id, titre: i.titre || '', age, file: i.file || null });
    } else if (i.statut === 'active' && age > 60 && specs.length === 0) {
      activeSansSpec.push({ id: i.id, titre: i.titre || '', age, file: i.file || null });
    } else if ((i.statut === 'done' || i.statut === 'archived') && age > 180) {
      doneTresVieux.push({ id: i.id, titre: i.titre || '', age, file: i.file || null, statut: i.statut });
    }
  }
  // Tri âge desc.
  draftsVieux.sort((a, b) => b.age - a.age);
  activeSansSpec.sort((a, b) => b.age - a.age);
  doneTresVieux.sort((a, b) => b.age - a.age);

  const doublons = detecterDoublons(intents.filter((i) => !['archived'].includes(i.statut)));

  const totaux = {
    draftsVieux: draftsVieux.length,
    activeSansSpec: activeSansSpec.length,
    doneTresVieux: doneTresVieux.length,
    doublonsCandidats: doublons.length,
    total: draftsVieux.length + activeSansSpec.length + doneTresVieux.length + doublons.length,
  };
  return { draftsVieux, activeSansSpec, doneTresVieux, doublons, totaux };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const BH_CSS = `<style>
.bh-buckets { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:.5rem; margin:.5rem 0; }
.bh-bucket { padding:.5rem .65rem; border-radius:.35rem; background:var(--card-bg, rgba(127,127,127,.04)); border:1px solid var(--border, #ddd); }
.bh-bucket h3 { font-size:.85rem; margin:.05rem 0 .25rem; display:flex; gap:.4rem; align-items:baseline; }
.bh-bucket.b-draft { border-left:3px solid #e8590c; }
.bh-bucket.b-active { border-left:3px solid #c92a2a; background:rgba(201,42,42,.03); }
.bh-bucket.b-done { border-left:3px solid rgba(76,110,245,.5); }
.bh-bucket.b-dup { border-left:3px solid #f5a623; }
.bh-item { padding:.25rem .35rem; margin:.15rem 0; font-size:.78rem; background:rgba(127,127,127,.05); border-radius:.2rem; }
.bh-action { font-size:.7rem; color:var(--muted, #777); display:block; margin-top:.1rem; font-style:italic; }
.bh-empty-bucket { font-size:.78rem; color:var(--muted, #777); font-style:italic; padding:.2rem; }
.bh-summary { padding:.4rem .55rem; border-radius:.25rem; font-size:.85rem; margin:.3rem 0; }
.bh-summary.has-todo { background:rgba(232,89,12,.06); border-left:3px solid #e8590c; }
.bh-summary.clean { background:rgba(43,138,62,.06); border-left:3px solid #2b8a3e; }
</style>`;

function rendreItemSimple(it, action) {
  const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
  return `<div class="bh-item">${idCell} <span class="muted">${escape((it.titre || '').slice(0, 60))}</span> <span class="muted">(${it.age}j)</span><span class="bh-action">→ ${escape(action)}</span></div>`;
}

function rendreBucket(items, classe, titre, action, hint) {
  if (items.length === 0) return `<div class="bh-bucket ${classe}">
      <h3>${escape(titre)} <span class="count">0</span></h3>
      <div class="bh-empty-bucket">${escape(hint)}</div>
    </div>`;
  const rows = items.slice(0, 8).map((it) => rendreItemSimple(it, action)).join('');
  return `<div class="bh-bucket ${classe}">
    <h3>${escape(titre)} <span class="count">${items.length}</span></h3>
    ${rows}
  </div>`;
}

function rendreDoublons(doublons) {
  if (doublons.length === 0) return `<div class="bh-bucket b-dup">
      <h3>Doublons potentiels <span class="count">0</span></h3>
      <div class="bh-empty-bucket">Aucune paire d'Intents avec similarité Jaccard ≥ 0.6 sur les tokens du titre.</div>
    </div>`;
  const rows = doublons.slice(0, 6).map((d) => `<div class="bh-item">
      <code>${escape(d.a)}</code> ↔ <code>${escape(d.b)}</code> <span class="muted">(similarité ${d.similarite})</span>
      <span class="bh-action">→ vérifier si même intent à fusionner ou clarifier</span>
    </div>`).join('');
  return `<div class="bh-bucket b-dup">
    <h3>Doublons potentiels <span class="count">${doublons.length} paire(s)</span></h3>
    ${rows}
  </div>`;
}

export function blocBacklogHygiene(donnees) {
  const h = donnees?.backlogHygiene;
  if (!h) return '';
  const t = h.totaux;
  const summary = t.total === 0
    ? `<div class="bh-summary clean">✓ Backlog propre — aucun candidat au nettoyage détecté.</div>`
    : `<div class="bh-summary has-todo">⚠ <strong>${t.total} candidat(s) au nettoyage</strong> — drafts vieux + active sans SPEC + done très vieux + doublons potentiels. Programmer un sprint hygiene avant que le backlog ne devienne illisible.</div>`;
  return `${BH_CSS}<section>
    <h2>Hygiène backlog <span class="count">${t.total} suggestion(s) de nettoyage</span></h2>
    <p class="muted" style="font-size:.85rem">Détecte 4 anti-patterns backlog : drafts &gt; 90j sans bascule, active &gt; 60j sans SPEC, done &gt; 180j non-archivés (déblayage), doublons potentiels (Jaccard ≥ 0.6 sur tokens titre).</p>
    ${summary}
    <div class="bh-buckets">
      ${rendreBucket(h.draftsVieux, 'b-draft', 'Drafts vieux > 90j', 'descoper ou archiver via /sdd intent', 'Aucun draft vieillissant — discovery propre.')}
      ${rendreBucket(h.activeSansSpec, 'b-active', 'Active sans SPEC > 60j', 'décomposer en SPECs via /sdd spec ou archiver', 'Aucun Intent actif sans décomposition prolongée.')}
      ${rendreBucket(h.doneTresVieux, 'b-done', 'Done très vieux > 180j', 'archiver pour déblayer la liste', 'Aucun done très vieux — backlog clean.')}
      ${rendreDoublons(h.doublons)}
    </div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  jaccard as jaccardSimilarity,
  calculerBacklogHygiene as computeBacklogHygiene,
  blocBacklogHygiene as backlogHygieneSection,
};
