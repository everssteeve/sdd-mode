// AIAD SDD Mode — Dashboard : A/B test / experiment tracker (#475).
//
// Étend #451 discovery-board avec une vue dédiée aux **expérimentations**
// (kind: experiment / spike) avec lecture du frontmatter `experiment:` :
//
//   experiment:
//     hypothesis: "Si X alors Y de Z %"
//     metric: "conversion checkout"
//     variant_a: "v1"
//     variant_b: "v2 simplifié"
//     status: running | concluded-validated | concluded-invalidated | inconclusive
//     started_at: "2026-04-15"
//     concluded_at: "2026-05-15"
//     sample_size: 5000
//     winner: "variant_b"
//     result_summary: "v2 +14 % conversion (p < 0.05)"
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const KIND_EXPERIMENT = new Set(['experiment', 'spike', 'a/b']);

function lireExperiment(intent) {
  if (!intent) return null;
  const raw = intent.experiment || intent.Experiment || intent.ab_test || intent.abTest;
  if (raw && typeof raw === 'object') return raw;
  return null;
}

function statutNorm(s) {
  if (!s) return 'unknown';
  const v = String(s).toLowerCase().trim();
  if (v === 'running' || v === 'in-progress' || v === 'en-cours') return 'running';
  if (v === 'concluded-validated' || v === 'validated' || v === 'validé') return 'concluded-validated';
  if (v === 'concluded-invalidated' || v === 'invalidated' || v === 'invalidé') return 'concluded-invalidated';
  if (v === 'inconclusive' || v === 'inconclus') return 'inconclusive';
  return 'unknown';
}

export function calculerAbTestTracker(donnees) {
  const intents = donnees?.intents || [];
  const items = [];
  for (const i of intents) {
    const exp = lireExperiment(i);
    // Critère d'inclusion : kind=experiment OU frontmatter experiment présent.
    const isKindExp = i.kind && KIND_EXPERIMENT.has(String(i.kind).toLowerCase());
    if (!exp && !isKindExp) continue;
    const statut = statutNorm(exp?.status);
    items.push({
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      intentStatut: i.statut,
      hypothesis: exp?.hypothesis || i.hypothesis || i.hypothese || null,
      metric: exp?.metric || null,
      variantA: exp?.variant_a || exp?.variantA || null,
      variantB: exp?.variant_b || exp?.variantB || null,
      statut,
      startedAt: exp?.started_at || exp?.startedAt || null,
      concludedAt: exp?.concluded_at || exp?.concludedAt || null,
      sampleSize: exp?.sample_size || exp?.sampleSize || null,
      winner: exp?.winner || null,
      resultSummary: exp?.result_summary || exp?.resultSummary || null,
    });
  }
  // Tri : running d'abord, puis concluded-validated, inconclusive, invalidated.
  const RANK = { running: 0, 'concluded-validated': 1, inconclusive: 2, 'concluded-invalidated': 3, unknown: 4 };
  items.sort((a, b) => RANK[a.statut] - RANK[b.statut]);
  const totaux = {
    total: items.length,
    running: items.filter((i) => i.statut === 'running').length,
    valides: items.filter((i) => i.statut === 'concluded-validated').length,
    invalides: items.filter((i) => i.statut === 'concluded-invalidated').length,
    inconcluants: items.filter((i) => i.statut === 'inconclusive').length,
  };
  return { items, totaux };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

function badgeStatut(s) {
  const map = {
    running: { cls: 'badge-info', label: 'En cours' },
    'concluded-validated': { cls: 'badge-ok', label: 'Validée ✓' },
    'concluded-invalidated': { cls: 'badge-bad', label: 'Invalidée ✗' },
    inconclusive: { cls: 'badge-warn', label: 'Inconcluante' },
    unknown: { cls: 'badge-muted', label: '?' },
  };
  const v = map[s] || map.unknown;
  return `<span class="badge ${v.cls}">${escape(v.label)}</span>`;
}

const AB_CSS = `<style>
.ab-card { padding:.55rem .75rem; margin:.4rem 0; border:1px solid var(--border, #ddd); border-radius:.4rem; background:var(--card-bg, #fff); font-size:.85rem; }
.ab-card.statut-running { border-left:4px solid #4c6ef5; background:rgba(76,110,245,.04); }
.ab-card.statut-concluded-validated { border-left:4px solid #2b8a3e; background:rgba(43,138,62,.04); }
.ab-card.statut-concluded-invalidated { border-left:4px solid #c92a2a; background:rgba(201,42,42,.04); }
.ab-card.statut-inconclusive { border-left:4px solid #e8590c; }
.ab-card-head { display:flex; align-items:baseline; gap:.5rem; flex-wrap:wrap; }
.ab-meta { display:grid; grid-template-columns: auto 1fr; column-gap:.5rem; row-gap:.2rem; margin:.3rem 0; font-size:.78rem; }
.ab-meta-key { color: var(--muted, #777); }
.ab-variants { display:flex; gap:.4rem; flex-wrap:wrap; margin-top:.3rem; }
.ab-variant { padding:.15rem .45rem; background:rgba(127,127,127,.07); border-radius:.2rem; font-size:.75rem; }
.ab-variant.winner { background:rgba(43,138,62,.15); color:#1f6b2f; font-weight:600; }
.ab-summary { font-size:.8rem; color: var(--muted, #777); font-style: italic; margin-top:.3rem; }
</style>`;

export function blocAbTestTracker(donnees) {
  const a = donnees?.abTestTracker;
  if (!a) return '';
  if (a.items.length === 0) {
    return `<section>
      <h2>A/B tests & expérimentations <span class="count">aucun</span></h2>
      <p class="muted" style="font-size:.85rem">Aucun Intent avec <code>kind: experiment</code> ou frontmatter <code>experiment:</code>. Pour tracker un test : ajouter <code>experiment: {hypothesis, metric, variant_a, variant_b, status: running, sample_size, winner, result_summary}</code> dans le frontmatter de l'Intent.</p>
    </section>`;
  }
  const cards = a.items.map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    const meta = [];
    if (it.metric) meta.push(`<div class="ab-meta-key">Métrique :</div><div>${escape(it.metric)}</div>`);
    if (it.hypothesis) meta.push(`<div class="ab-meta-key">Hypothèse :</div><div>${escape(it.hypothesis)}</div>`);
    if (it.startedAt) meta.push(`<div class="ab-meta-key">Démarré le :</div><div>${escape(it.startedAt)}</div>`);
    if (it.concludedAt) meta.push(`<div class="ab-meta-key">Conclu le :</div><div>${escape(it.concludedAt)}</div>`);
    if (it.sampleSize) meta.push(`<div class="ab-meta-key">Sample size :</div><div>${escape(String(it.sampleSize))}</div>`);
    const variants = [];
    if (it.variantA) variants.push(`<span class="ab-variant ${it.winner === 'variant_a' || it.winner === 'A' ? 'winner' : ''}">A : ${escape(it.variantA)}</span>`);
    if (it.variantB) variants.push(`<span class="ab-variant ${it.winner === 'variant_b' || it.winner === 'B' ? 'winner' : ''}">B : ${escape(it.variantB)}</span>`);
    const variantsBloc = variants.length ? `<div class="ab-variants">${variants.join('')}</div>` : '';
    const summary = it.resultSummary ? `<div class="ab-summary">→ ${escape(it.resultSummary)}</div>` : '';
    return `<div class="ab-card statut-${escape(it.statut)}">
      <div class="ab-card-head">
        ${badgeStatut(it.statut)}
        <strong>${idCell}</strong> — ${escape(it.titre)}
      </div>
      ${meta.length ? `<div class="ab-meta">${meta.join('')}</div>` : ''}
      ${variantsBloc}
      ${summary}
    </div>`;
  }).join('');
  const t = a.totaux;
  return `${AB_CSS}<section>
    <h2>A/B tests & expérimentations <span class="count">${t.total} total — ${t.running} en cours · ${t.valides} validés · ${t.invalides} invalidés · ${t.inconcluants} inconcluants</span></h2>
    <p class="muted" style="font-size:.85rem">Suit les Intents avec <code>kind: experiment</code> ou frontmatter <code>experiment:</code>. Variant gagnant mis en évidence. Tri : <code>running</code> d'abord, puis conclus.</p>
    ${cards}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerAbTestTracker as computeAbTestTracker,
  blocAbTestTracker as abTestTrackerSection,
};
