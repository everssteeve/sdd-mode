// AIAD SDD Mode — Dashboard : discovery board / dual-track (#451).
//
// Pratique dual-track Agile : séparer la discovery (exploration : spikes,
// experiments, prototypes) de la delivery (exécution : features
// production-ready). Le PM doit voir d'un coup d'œil quels Intents sont
// en mode exploration vs delivery.
//
// Source : frontmatter `kind: discovery|experiment|spike|delivery` (alias
// `track:` accepté). Sans annotation → bucket `delivery` par défaut
// (assomption canonique : tout Intent est delivery sauf marqué autrement).
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const KINDS_DISCOVERY = new Set(['discovery', 'experiment', 'spike', 'research', 'prototype']);

export function classifierIntent(intent) {
  const raw = intent?.kind ?? intent?.Kind ?? intent?.track ?? intent?.Track;
  if (raw == null) return 'delivery';
  const s = String(raw).toLowerCase().trim();
  if (KINDS_DISCOVERY.has(s)) return s;
  if (s === 'delivery' || s === 'feature') return 'delivery';
  return 'delivery'; // valeur inconnue → fallback safe
}

export function calculerDiscoveryBoard(donnees) {
  const intents = donnees?.intents || [];
  const par = { discovery: [], experiment: [], spike: [], research: [], prototype: [], delivery: [] };
  for (const i of intents) {
    const k = classifierIntent(i);
    if (!par[k]) par[k] = [];
    par[k].push({
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      statut: i.statut,
      hypothese: i.hypothesis || i.hypothese || i['hypothèse'] || (i.sections?.pourquoi ? null : null),
      hypothesisStatus: i.hypothesis_status || i.hypothesisStatus || null,
    });
  }
  const totalDiscovery = par.discovery.length + par.experiment.length + par.spike.length + par.research.length + par.prototype.length;
  return {
    discovery: par.discovery,
    experiment: par.experiment,
    spike: par.spike,
    research: par.research,
    prototype: par.prototype,
    delivery: par.delivery,
    totaux: {
      discovery: totalDiscovery,
      delivery: par.delivery.length,
      total: intents.length,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const DISCOVERY_CSS = `<style>
.disco-board { display:grid; gap:.5rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin:.5rem 0; }
.disco-col { padding:.5rem .65rem; border:1px solid var(--border, #ddd); border-radius:.4rem; background:var(--card-bg, #fff); }
.disco-col.is-discovery { border-left:4px solid #9775fa; background:rgba(151,117,250,.04); }
.disco-col.is-experiment { border-left:4px solid #4c6ef5; background:rgba(76,110,245,.04); }
.disco-col.is-spike { border-left:4px solid #fab005; background:rgba(250,176,5,.04); }
.disco-col.is-research { border-left:4px solid #20c997; background:rgba(32,201,151,.04); }
.disco-col.is-prototype { border-left:4px solid #fd7e14; background:rgba(253,126,20,.04); }
.disco-col.is-delivery { border-left:4px solid #868e96; }
.disco-col-head { display:flex; justify-content:space-between; align-items:baseline; gap:.5rem; }
.disco-col-label { font-weight:600; font-size:.85rem; }
.disco-col-count { font-size:.75rem; color:var(--muted, #777); }
.disco-card { padding:.35rem .5rem; margin-top:.35rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.78rem; }
.disco-card-id { font-size:.7rem; }
.disco-card-status { font-size:.7rem; color:var(--muted, #777); margin-top:.15rem; }
.disco-summary { font-size:.85rem; color:var(--muted, #777); margin:.3rem 0; }
</style>`;

const KIND_META = {
  discovery: { label: 'Discovery', desc: 'exploration ouverte' },
  experiment: { label: 'Experiment', desc: 'A/B test ou MVP testable' },
  spike: { label: 'Spike', desc: 'time-box d\'investigation technique' },
  research: { label: 'Research', desc: 'investigation utilisateur' },
  prototype: { label: 'Prototype', desc: 'maquette explorable' },
  delivery: { label: 'Delivery', desc: 'feature production-ready' },
};

function carteIntent(it) {
  const idCell = it.file ? lienSource(it.file, it.id) : `<code class="disco-card-id">${escape(it.id)}</code>`;
  const hypBadge = it.hypothesisStatus
    ? ` <span class="badge ${it.hypothesisStatus === 'validated' ? 'badge-ok' : it.hypothesisStatus === 'invalidated' ? 'badge-bad' : 'badge-warn'}" style="font-size:.65rem">${escape(it.hypothesisStatus)}</span>`
    : '';
  return `<div class="disco-card">
    <div>${idCell} <strong>${escape(it.titre)}</strong></div>
    <div class="disco-card-status">${escape(it.statut || '?')}${hypBadge}</div>
  </div>`;
}

function colonne(kind, items) {
  const meta = KIND_META[kind];
  const cards = items.length === 0
    ? '<div class="muted" style="font-size:.75rem">aucun</div>'
    : items.slice(0, 6).map(carteIntent).join('');
  return `<div class="disco-col is-${escape(kind)}">
    <div class="disco-col-head">
      <span class="disco-col-label">${escape(meta.label)}</span>
      <span class="disco-col-count">${items.length}</span>
    </div>
    <div class="muted" style="font-size:.7rem">${escape(meta.desc)}</div>
    ${cards}
  </div>`;
}

export function blocDiscoveryBoard(donnees) {
  const b = donnees?.discoveryBoard;
  if (!b) return '';
  if (b.totaux.discovery === 0 && b.totaux.delivery === 0) return '';
  const t = b.totaux;
  // Affiche seulement les colonnes non vides ou la colonne Delivery
  // (toujours présente — au moins en référence).
  const cols = ['discovery', 'experiment', 'spike', 'research', 'prototype', 'delivery']
    .filter((k) => (b[k] || []).length > 0 || k === 'delivery')
    .map((k) => colonne(k, b[k] || []))
    .join('');
  const banniere = t.discovery === 0
    ? '<p class="disco-summary">Aucun Intent en mode discovery / experiment / spike — tout est qualifié <code>delivery</code> (par défaut). Ajouter <code>kind: discovery</code> ou <code>kind: experiment</code> dans le frontmatter pour distinguer l\'exploration de l\'exécution (dual-track Agile).</p>'
    : `<p class="disco-summary">Dual-track : <strong>${t.discovery} en exploration</strong> · <strong>${t.delivery} en delivery</strong>. Mode <code>kind:</code> du frontmatter (discovery / experiment / spike / research / prototype / delivery). Hypothèses validées/invalidées affichées en badge.</p>`;
  return `${DISCOVERY_CSS}<section>
    <h2>Discovery board <span class="count">${t.discovery} discovery + ${t.delivery} delivery = ${t.total}</span></h2>
    ${banniere}
    <div class="disco-board">${cols}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  classifierIntent as classifyIntent,
  calculerDiscoveryBoard as computeDiscoveryBoard,
  blocDiscoveryBoard as discoveryBoardSection,
};
