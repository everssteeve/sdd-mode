// AIAD SDD Mode — Dashboard : confidence tracker (#459).
//
// Étend #440 (hypothèses) avec une dimension confidence : pour chaque
// hypothèse, lire `confidence: 80` (pourcent 0-100) ou `confidence_level:
// high|medium|low` du frontmatter. Détecte les **paris à risque** :
// hypothèses avec faible confidence + statut Intent active.
//
// Heuristiques :
//   - confidence ≥ 80 % → "solide"
//   - 50-79 %         → "raisonnable"
//   - 20-49 %         → "faible — à valider rapidement"
//   - < 20 %          → "très faible — pari risqué"
//   - level high/medium/low → mapping respectif 90/60/30
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const LEVEL_TO_PCT = { high: 90, medium: 60, low: 30 };

function lireConfidencePct(intent) {
  // confidence numérique prime sur confidence_level
  const raw = intent?.confidence;
  if (raw != null) {
    const n = Number(raw);
    if (Number.isFinite(n)) {
      // Tolère 0-1 (fraction) ou 0-100.
      if (n <= 1 && n > 0) return Math.round(n * 100);
      if (n >= 0 && n <= 100) return Math.round(n);
    }
  }
  const lvl = intent?.confidence_level || intent?.confidenceLevel;
  if (lvl != null) {
    const s = String(lvl).toLowerCase().trim();
    if (LEVEL_TO_PCT[s] != null) return LEVEL_TO_PCT[s];
  }
  return null;
}

export function bandeConfidence(pct) {
  if (pct == null) return 'inconnu';
  if (pct >= 80) return 'solide';
  if (pct >= 50) return 'raisonnable';
  if (pct >= 20) return 'faible';
  return 'tres-faible';
}

export function calculerConfidenceTracker(donnees) {
  const intents = donnees?.intents || [];
  const hyp = donnees?.hypotheses?.hypotheses || [];
  // Index hypothèses par id pour réutiliser ce qui a été calculé.
  const hypById = new Map(hyp.map((h) => [h.id, h]));
  const items = [];
  for (const i of intents) {
    const pct = lireConfidencePct(i);
    const h = hypById.get(i.id);
    if (pct == null && !h) continue;
    items.push({
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      statut: i.statut,
      pct,
      bande: bandeConfidence(pct),
      hypothese: h?.hypothese || null,
      hypStatut: h?.statut || null,
    });
  }
  // Tri : pari risqué d'abord (faible confidence + statut actif).
  const RISK = { 'tres-faible': 0, faible: 1, raisonnable: 2, solide: 3, inconnu: 4 };
  items.sort((a, b) => {
    const aActif = a.statut === 'active' || a.statut === 'in-progress' ? 0 : 1;
    const bActif = b.statut === 'active' || b.statut === 'in-progress' ? 0 : 1;
    if (aActif !== bActif) return aActif - bActif;
    return RISK[a.bande] - RISK[b.bande];
  });
  const totaux = {
    total: items.length,
    paris: items.filter((i) => (i.bande === 'tres-faible' || i.bande === 'faible') && (i.statut === 'active' || i.statut === 'in-progress')).length,
    solides: items.filter((i) => i.bande === 'solide').length,
  };
  return { items, totaux };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

function badgeBande(bande) {
  const map = {
    solide: { cls: 'badge-ok', label: 'Solide ≥ 80 %' },
    raisonnable: { cls: 'badge-info', label: 'Raisonnable 50-79 %' },
    faible: { cls: 'badge-warn', label: 'Faible 20-49 %' },
    'tres-faible': { cls: 'badge-bad', label: 'Très faible < 20 %' },
    inconnu: { cls: 'badge-muted', label: 'Inconnue' },
  };
  const v = map[bande] || map.inconnu;
  return `<span class="badge ${v.cls}">${escape(v.label)}</span>`;
}

const CONF_CSS = `<style>
.conf-bar { display:inline-block; width: 120px; height:10px; background: rgba(127,127,127,.12); border-radius:5px; overflow:hidden; vertical-align: middle; margin-right:.4rem; }
.conf-bar-fill { height:100%; transition: width .25s; }
.conf-bar-fill.bande-solide { background:#2b8a3e; }
.conf-bar-fill.bande-raisonnable { background:#4c6ef5; }
.conf-bar-fill.bande-faible { background:#e8590c; }
.conf-bar-fill.bande-tres-faible { background:#c92a2a; }
.conf-bar-fill.bande-inconnu { background:#868e96; }
.conf-card { padding:.5rem .7rem; margin:.4rem 0; border:1px solid var(--border, #ddd); border-radius:.4rem; background:var(--card-bg, #fff); font-size:.85rem; }
.conf-card.bande-tres-faible { border-left:4px solid #c92a2a; background:rgba(201,42,42,.04); }
.conf-card.bande-faible { border-left:4px solid #e8590c; background:rgba(232,89,12,.04); }
.conf-card-pct { font-size: 1.1rem; font-weight:700; min-width: 40px; display: inline-block; text-align:right; }
.conf-card-hyp { color: var(--muted, #777); font-size:.78rem; margin-top:.3rem; font-style: italic; }
</style>`;

export function blocConfidenceTracker(donnees) {
  const c = donnees?.confidenceTracker;
  if (!c) return '';
  if (c.items.length === 0) {
    return `<section>
      <h2>Confidence tracker <span class="count">aucune confidence déclarée</span></h2>
      <p class="muted" style="font-size:.85rem">Aucun Intent ne déclare <code>confidence: 75</code> ou <code>confidence_level: high|medium|low</code> dans son frontmatter. Ajouter ces champs pour quantifier le risque de pari produit.</p>
    </section>`;
  }
  const cards = c.items.slice(0, 15).map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    const pctDisplay = it.pct != null ? `${it.pct} %` : '—';
    const width = it.pct != null ? it.pct : 0;
    const hyp = it.hypothese ? `<div class="conf-card-hyp">« ${escape(it.hypothese)} »</div>` : '';
    return `<div class="conf-card bande-${escape(it.bande)}">
      <div>
        ${badgeBande(it.bande)}
        <span class="conf-card-pct">${escape(pctDisplay)}</span>
        <span class="conf-bar"><span class="conf-bar-fill bande-${escape(it.bande)}" style="width:${width}%"></span></span>
        <strong>${idCell}</strong> — ${escape(it.titre)} <span class="muted">(${escape(it.statut || '?')})</span>
      </div>
      ${hyp}
    </div>`;
  }).join('');
  return `${CONF_CSS}<section>
    <h2>Confidence tracker <span class="count">${c.totaux.total} item(s) · ${c.totaux.paris} pari(s) risqué(s) · ${c.totaux.solides} solide(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Confiance déclarée par Intent via <code>confidence: 75</code> (numérique 0-100 ou fraction 0-1) ou <code>confidence_level: high|medium|low</code> (mapping 90/60/30). Tri : Intents actifs à confidence faible d'abord (pari à valider rapidement).</p>
    ${cards}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  lireConfidencePct as readConfidencePct,
  bandeConfidence as confidenceBand,
  calculerConfidenceTracker as computeConfidenceTracker,
  blocConfidenceTracker as confidenceTrackerSection,
};
