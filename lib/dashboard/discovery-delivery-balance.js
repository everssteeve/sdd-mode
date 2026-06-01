// AIAD SDD Mode — Dashboard : discovery vs delivery balance (#493).
//
// Mesure l'équilibre entre Intents en mode **discovery** (exploration,
// expérimentation, hypothèses à valider) et **delivery** (exécution
// engagée). Une équipe qui ne fait que du delivery accumule de la dette
// stratégique ; une équipe qui ne fait que de la discovery ne livre pas.
//
// Sources :
//   - intent.kind : 'discovery' / 'experiment' / 'delivery' / 'enabler'
//   - Si `kind` absent : heuristique sur statut et hypothesis frontmatter
//
// Politique de classification :
//   - discovery : `kind == 'discovery'` OU `kind == 'experiment'` OU
//                 (statut == draft AVEC hypothèse non validée)
//   - delivery  : `kind == 'delivery'` OU
//                 (statut active/in-progress AVEC ≥ 1 SPEC liée)
//   - enabler   : `kind == 'enabler'` (tech, refactor, plumbing)
//   - inconnu   : aucun signal
//
// Ratio sain (heuristique produit standard) :
//   - 60-70 % delivery, 20-30 % discovery, 5-15 % enabler
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const KIND_VERS_BUCKET = {
  discovery: 'discovery',
  exploration: 'discovery',
  experiment: 'discovery',
  hypothesis: 'discovery',
  delivery: 'delivery',
  execution: 'delivery',
  build: 'delivery',
  enabler: 'enabler',
  tech: 'enabler',
  refactor: 'enabler',
  infra: 'enabler',
};

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

export function classifierIntent(intent, specsLies) {
  const kind = intent?.kind ? String(intent.kind).toLowerCase().trim() : '';
  const bucket = KIND_VERS_BUCKET[kind];
  if (bucket) return { bucket, source: 'kind' };
  // Heuristique.
  const hypoStatus = intent?.hypothesis_status || intent?.hypothesisStatus || '';
  const hasHypothesis = !!intent?.hypothesis || !!intent?.Hypothesis;
  const statut = intent?.statut;
  if (hasHypothesis && hypoStatus !== 'validated' && (statut === 'draft' || statut === 'active')) {
    return { bucket: 'discovery', source: 'heuristique-hypothese' };
  }
  if ((statut === 'active' || statut === 'in-progress') && (specsLies?.length || 0) >= 1) {
    return { bucket: 'delivery', source: 'heuristique-specs' };
  }
  return { bucket: 'inconnu', source: 'aucun-signal' };
}

const CIBLES = { delivery: 65, discovery: 25, enabler: 10 };

function ecartCible(pct, bucket) {
  const cible = CIBLES[bucket];
  if (cible == null) return null;
  const delta = pct - cible;
  if (Math.abs(delta) <= 10) return { etat: 'sain', delta: Math.round(delta) };
  if (Math.abs(delta) <= 25) return { etat: 'tendu', delta: Math.round(delta) };
  return { etat: 'desequilibre', delta: Math.round(delta) };
}

export function calculerDiscoveryDeliveryBalance(donnees) {
  const intents = (donnees?.intents || []).filter((i) => !['archived'].includes(i.statut));
  const specsParCourt = indexerSpecs(donnees?.specs);
  const buckets = { discovery: 0, delivery: 0, enabler: 0, inconnu: 0 };
  const echantillons = { discovery: [], delivery: [], enabler: [], inconnu: [] };
  for (const i of intents) {
    const court = i.id.split('-').slice(0, 2).join('-');
    const specs = specsParCourt.get(court) || [];
    const c = classifierIntent(i, specs);
    buckets[c.bucket]++;
    if (echantillons[c.bucket].length < 5) {
      echantillons[c.bucket].push({ id: i.id, titre: i.titre || '', source: c.source });
    }
  }
  const total = intents.length;
  const pcts = {};
  for (const k of Object.keys(buckets)) {
    pcts[k] = total > 0 ? Math.round((buckets[k] / total) * 100) : 0;
  }
  const sante = {
    delivery: ecartCible(pcts.delivery, 'delivery'),
    discovery: ecartCible(pcts.discovery, 'discovery'),
    enabler: ecartCible(pcts.enabler, 'enabler'),
  };
  return { buckets, pcts, echantillons, total, sante, cibles: CIBLES };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const DD_CSS = `<style>
.dd-bar { display:flex; height:24px; border-radius:.3rem; overflow:hidden; margin:.4rem 0; background:rgba(127,127,127,.1); }
.dd-bar-seg { display:flex; align-items:center; justify-content:center; color:#fff; font-size:.75rem; font-weight:500; min-width:0; padding:0 .3rem; white-space:nowrap; overflow:hidden; }
.dd-bar-seg.b-discovery { background:#4c6ef5; }
.dd-bar-seg.b-delivery { background:#2b8a3e; }
.dd-bar-seg.b-enabler { background:#e8590c; }
.dd-bar-seg.b-inconnu { background:rgba(127,127,127,.4); }
.dd-legend { display:flex; gap:.5rem; flex-wrap:wrap; font-size:.78rem; margin:.3rem 0; }
.dd-leg { display:inline-flex; gap:.3rem; align-items:baseline; padding:.2rem .45rem; border-radius:.2rem; background:rgba(127,127,127,.06); }
.dd-leg .dd-dot { width:.55rem; height:.55rem; border-radius:50%; display:inline-block; }
.dd-dot.b-discovery { background:#4c6ef5; }
.dd-dot.b-delivery { background:#2b8a3e; }
.dd-dot.b-enabler { background:#e8590c; }
.dd-dot.b-inconnu { background:rgba(127,127,127,.4); }
.dd-sante { padding:.45rem .55rem; background:rgba(127,127,127,.05); border-radius:.25rem; font-size:.85rem; margin:.4rem 0; }
.dd-sante.is-sain { background:rgba(43,138,62,.06); border-left:3px solid #2b8a3e; }
.dd-sante.is-tendu { background:rgba(232,89,12,.06); border-left:3px solid #e8590c; }
.dd-sante.is-desequilibre { background:rgba(201,42,42,.06); border-left:3px solid #c92a2a; }
.dd-samples { font-size:.78rem; color:var(--muted, #777); margin:.25rem 0; }
.dd-samples code { padding:.05rem .25rem; background:rgba(127,127,127,.08); border-radius:.15rem; }
</style>`;

function commentaireSante(sante, pcts, cibles) {
  // Etat global = pire des 3
  const RANK = { sain: 0, tendu: 1, desequilibre: 2 };
  let pire = 'sain';
  for (const k of Object.keys(sante)) {
    const e = sante[k]?.etat;
    if (e && RANK[e] > RANK[pire]) pire = e;
  }
  const txt = [];
  for (const k of ['delivery', 'discovery', 'enabler']) {
    const s = sante[k];
    if (!s) continue;
    if (s.etat === 'sain') continue;
    if (s.delta > 0) txt.push(`${k} sur-représenté (${pcts[k]}% vs cible ${cibles[k]}%)`);
    else txt.push(`${k} sous-représenté (${pcts[k]}% vs cible ${cibles[k]}%)`);
  }
  return { etat: pire, message: txt.join(' · ') || 'Ratio équilibré delivery / discovery / enabler.' };
}

export function blocDiscoveryDeliveryBalance(donnees) {
  const b = donnees?.discoveryDeliveryBalance;
  if (!b) return '';
  if (b.total === 0) {
    return `${DD_CSS}<section>
      <h2>Discovery / Delivery balance <span class="count">aucun Intent actif</span></h2>
      <p class="muted" style="font-size:.85rem">Mesure l'équilibre entre Intents discovery (expérimentation), delivery (exécution) et enabler (tech). Cible standard : 65% delivery, 25% discovery, 10% enabler.</p>
    </section>`;
  }
  const segs = ['delivery', 'discovery', 'enabler', 'inconnu']
    .map((k) => {
      const pct = b.pcts[k];
      if (pct === 0) return '';
      return `<div class="dd-bar-seg b-${k}" style="flex:${pct} 0 0"><span>${pct}%</span></div>`;
    })
    .filter(Boolean)
    .join('');
  const legend = ['delivery', 'discovery', 'enabler', 'inconnu'].map((k) => `<span class="dd-leg"><span class="dd-dot b-${k}"></span>${escape(k)} ${b.buckets[k]} (${b.pcts[k]}%)</span>`).join('');
  const c = commentaireSante(b.sante, b.pcts, b.cibles);
  const samplesParBucket = ['discovery', 'delivery', 'enabler'].map((k) => {
    const ids = b.echantillons[k];
    if (!ids.length) return '';
    return `<div class="dd-samples"><strong>${escape(k)}</strong> · ${ids.slice(0, 4).map((s) => `<code>${escape(s.id)}</code>`).join(' ')}${ids.length > 4 ? '…' : ''}</div>`;
  }).join('');
  return `${DD_CSS}<section>
    <h2>Discovery / Delivery balance <span class="count">${b.total} Intent(s) classés — cibles ${b.cibles.delivery}/${b.cibles.discovery}/${b.cibles.enabler} %</span></h2>
    <p class="muted" style="font-size:.85rem">Une équipe qui ne fait que du delivery accumule la dette stratégique ; une équipe qui ne fait que de la discovery ne livre pas. Cible standard PM : 65% delivery / 25% discovery / 10% enabler. Source <code>kind</code> du frontmatter (delivery/discovery/experiment/enabler), sinon heuristique (hypothèse non validée → discovery, SPECs ≥ 1 + actif → delivery).</p>
    <div class="dd-bar">${segs}</div>
    <div class="dd-legend">${legend}</div>
    <div class="dd-sante is-${escape(c.etat)}">${c.etat === 'sain' ? '✓' : c.etat === 'tendu' ? '⚠' : '⛔'} ${escape(c.message)}</div>
    ${samplesParBucket}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  classifierIntent as classifyIntent,
  calculerDiscoveryDeliveryBalance as computeDiscoveryDeliveryBalance,
  blocDiscoveryDeliveryBalance as discoveryDeliveryBalanceSection,
  CIBLES as TARGET_RATIOS,
};
