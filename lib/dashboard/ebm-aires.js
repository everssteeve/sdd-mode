// AIAD SDD Mode — Dashboard : aires EBM + Investment Balance.
//
// Calcule les 4 aires EBM (Current Value, Unrealized Value,
// Time-to-Market, Ability to Innovate) et la répartition
// Investment Balance (features / enabler / conformité / inconnu).
//
// Sources :
//   - donnees.outcomeAttribution.items — ratios outcomes (CV/UV)
//   - donnees.discoveryDeliveryBalance.pcts.discovery — A2I
//   - donnees.intents — T2M et Investment Balance
//
// Buckets Investment Balance (exclusifs, priorité : conformite > enabler > features > inconnu).
// Cibles indicatives (non bloquantes) : features 65 %, enabler 25 %, conformite+inconnu 10 %.
//
// Aucun effet de bord. Pure transformation.
//
// @intent INTENT-018
// @spec SPEC-018-2-aires-ebm-investment-balance

import { escape } from './render.js';

const TAGS_CONFORMITE = ['rgpd', 'ai-act', 'rgaa', 'rgesn'];

function lireTagsIntent(intent) {
  const sources = [
    intent?.tags, intent?.Tags, intent?.labels, intent?.Labels,
    intent?.etiquettes, intent?.governance, intent?.Governance,
  ];
  const tags = [];
  for (const src of sources) {
    if (!src) continue;
    if (Array.isArray(src)) {
      for (const t of src) tags.push(String(t).toLowerCase());
    } else if (typeof src === 'string') {
      for (const t of src.split(/[,\s]+/)) {
        const v = t.toLowerCase().trim();
        if (v) tags.push(v);
      }
    }
  }
  return tags;
}

function estConformite(intent) {
  const tags = lireTagsIntent(intent);
  return TAGS_CONFORMITE.some((kw) => tags.some((t) => t.includes(kw)));
}

function bucketInvestment(intent) {
  if (estConformite(intent)) return 'conformite';
  const kind = String(intent?.kind || intent?.Kind || intent?.track || '').toLowerCase().trim();
  if (kind === 'enabler' || kind === 'tech' || kind === 'refactor' || kind === 'infra') return 'enabler';
  if (kind === 'delivery' || kind === 'execution' || kind === 'build' ||
      kind === 'experiment' || kind === 'experiment') return 'features';
  return 'inconnu';
}

// ─── Calcul EBM ──────────────────────────────────────────────────────────────

/**
 * @intent INTENT-018
 * @spec SPEC-018-2-aires-ebm-investment-balance
 */
export function calculerEbmAires(donnees) {
  const items = donnees?.outcomeAttribution?.items || [];
  const balance = donnees?.discoveryDeliveryBalance;
  const intents = (donnees?.intents || []).filter((i) => i.statut !== 'archived');

  // CV : ratio d'outcomes avec ratio >= 0.8
  const outcomesAvecRatio = items.filter((o) => o.ratio !== null);
  let currentValue;
  if (items.length === 0) {
    currentValue = { valeur: null, label: 'Aucun outcome défini dans PRD.md', jnsp: true };
  } else if (outcomesAvecRatio.length === 0) {
    currentValue = { valeur: null, label: 'Aucun outcome mesuré', jnsp: true };
  } else {
    const cv = outcomesAvecRatio.filter((o) => o.ratio >= 0.8).length / outcomesAvecRatio.length;
    currentValue = {
      valeur: Math.round(cv * 100) / 100,
      label: `${outcomesAvecRatio.filter((o) => o.ratio >= 0.8).length}/${outcomesAvecRatio.length} outcome(s) ≥ 80 %`,
      jnsp: false,
    };
  }

  // UV : ratio d'outcomes avec 0 < ratio < 0.8
  let unrealizedValue;
  if (items.length === 0) {
    unrealizedValue = { valeur: null, label: 'Aucun outcome défini dans PRD.md', jnsp: true };
  } else if (outcomesAvecRatio.length === 0) {
    unrealizedValue = { valeur: null, label: 'Aucun outcome mesuré', jnsp: true };
  } else {
    const uv = outcomesAvecRatio.filter((o) => o.ratio > 0 && o.ratio < 0.8).length / outcomesAvecRatio.length;
    unrealizedValue = {
      valeur: Math.round(uv * 100) / 100,
      label: `${outcomesAvecRatio.filter((o) => o.ratio > 0 && o.ratio < 0.8).length}/${outcomesAvecRatio.length} outcome(s) en cours`,
      jnsp: false,
    };
  }

  // T2M : Intents statut active/in-progress de kind=delivery / total non-archivés
  const totalIntents = intents.length;
  const deliveryActifs = intents.filter((i) => {
    const s = i.statut || '';
    const kind = String(i.kind || i.Kind || i.track || '').toLowerCase().trim();
    const estDelivery = kind === 'delivery' || kind === 'execution' || kind === 'build';
    return estDelivery && (s === 'active' || s === 'in-progress');
  }).length;
  const timeToMarket = {
    valeur: totalIntents > 0 ? Math.round((deliveryActifs / totalIntents) * 100) / 100 : 0,
    label: `${deliveryActifs} Intent(s) delivery actif(s) / ${totalIntents} total`,
    jnsp: totalIntents === 0,
  };

  // A2I : pcts.discovery depuis discoveryDeliveryBalance
  let abilityToInnovate;
  if (!balance || balance.pcts == null) {
    abilityToInnovate = { valeur: null, label: 'discoveryDeliveryBalance absent', jnsp: true };
  } else {
    const a2i = balance.pcts.discovery / 100;
    abilityToInnovate = {
      valeur: Math.round(a2i * 100) / 100,
      label: `${balance.pcts.discovery} % des Intents en mode discovery`,
      jnsp: false,
    };
  }

  return { currentValue, unrealizedValue, timeToMarket, abilityToInnovate };
}

// ─── Calcul Investment Balance ────────────────────────────────────────────────

const CIBLES_IB = { features: 65, enabler: 25, conformite: 5, inconnu: 5 };

function santeInvestment(pcts) {
  const ecartFeatures = Math.abs(pcts.features - CIBLES_IB.features);
  const ecartEnabler = Math.abs(pcts.enabler - CIBLES_IB.enabler);
  if (pcts.features === 0 && pcts.enabler === 0) return 'critique';
  if (ecartFeatures > 30 || ecartEnabler > 20) return 'attention';
  return 'ok';
}

/**
 * @intent INTENT-018
 * @spec SPEC-018-2-aires-ebm-investment-balance
 */
export function calculerInvestmentBalance(donnees) {
  const intents = (donnees?.intents || []).filter((i) => i.statut !== 'archived');
  const total = intents.length;
  const buckets = { features: 0, enabler: 0, conformite: 0, inconnu: 0 };
  for (const intent of intents) {
    buckets[bucketInvestment(intent)]++;
  }
  const pcts = {};
  for (const k of Object.keys(buckets)) {
    pcts[k] = total > 0 ? Math.round((buckets[k] / total) * 100) : 0;
  }
  const sante = total === 0 ? 'critique' : santeInvestment(pcts);
  return { buckets, pcts, total, sante };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

const EBM_CSS = `<style>
.ebm-grid { display:grid; grid-template-columns:1fr 1fr; gap:.75rem; margin:.75rem 0; }
.ebm-cell { padding:.75rem 1rem; border-radius:.4rem; border:1px solid var(--border,#ddd); background:var(--card-bg,rgba(127,127,127,.04)); }
.ebm-cell-label { font-size:.7rem; text-transform:uppercase; letter-spacing:.04em; color:var(--muted,#777); margin-bottom:.25rem; }
.ebm-cell-value { font-size:1.5rem; font-weight:700; line-height:1.1; }
.ebm-cell-sub { font-size:.75rem; color:var(--muted,#777); margin-top:.2rem; }
.ebm-cell-jnsp { font-size:.85rem; font-style:italic; color:var(--muted,#777); }
.ib-table { width:100%; border-collapse:collapse; margin:.5rem 0; font-size:.85rem; }
.ib-table th, .ib-table td { padding:.35rem .5rem; border:1px solid var(--border,#ddd); text-align:left; }
.ib-table thead th { background:var(--card-bg,rgba(127,127,127,.06)); font-weight:600; }
.ib-bar-wrap { display:flex; height:.9rem; border-radius:.2rem; overflow:hidden; border:1px solid var(--border,#ddd); margin:.35rem 0; }
.ib-bar-seg { height:100%; }
.ib-sante-ok::before { content:"✓ "; }
.ib-sante-attention::before { content:"⚠ "; }
.ib-sante-critique::before { content:"✗ "; }
</style>`;

const EBM_LABELS = {
  currentValue: 'Current Value (CV)',
  unrealizedValue: 'Unrealized Value (UV)',
  timeToMarket: 'Time-to-Market (T2M)',
  abilityToInnovate: 'Ability to Innovate (A2I)',
};

function fmtPct(valeur) {
  if (valeur === null || valeur === undefined) return '—';
  return `${Math.round(valeur * 100)} %`;
}

/**
 * @intent INTENT-018
 * @spec SPEC-018-2-aires-ebm-investment-balance
 */
export function blocEbmAires(donnees) {
  const aires = donnees?.ebmAires;
  if (!aires) return '';
  const ordre = ['currentValue', 'unrealizedValue', 'timeToMarket', 'abilityToInnovate'];
  const cells = ordre.map((key) => {
    const aire = aires[key];
    const label = EBM_LABELS[key];
    if (aire.jnsp) {
      return `<div class="ebm-cell" aria-label="${escape(label)} : donnée non disponible">
        <div class="ebm-cell-label">${escape(label)}</div>
        <div class="ebm-cell-value ebm-cell-jnsp" aria-hidden="true">JNSP</div>
        <div class="ebm-cell-sub">${escape(aire.label)}</div>
      </div>`;
    }
    return `<div class="ebm-cell" aria-label="${escape(label)} : ${escape(fmtPct(aire.valeur))}">
      <div class="ebm-cell-label">${escape(label)}</div>
      <div class="ebm-cell-value" aria-hidden="true">${escape(fmtPct(aire.valeur))}</div>
      <div class="ebm-cell-sub">${escape(aire.label)}</div>
    </div>`;
  }).join('');
  return `${EBM_CSS}<section>
    <h2>Aires EBM <span class="count">Evidence-Based Management</span></h2>
    <p class="muted" style="font-size:.85rem">4 dimensions de la valeur réalisée — CV (outcomes livrés), UV (potentiel non capturé), T2M (vitesse delivery), A2I (capacité d'innovation).</p>
    <div class="ebm-grid" role="list" aria-label="4 aires EBM">${cells}</div>
  </section>`;
}

const IB_LABELS = { features: 'Features / Expérimentation', enabler: 'Enabler (tech)', conformite: 'Conformité', inconnu: 'Inconnu' };
const IB_COLORS = { features: '#4c6ef5', enabler: '#f59f00', conformite: '#2b8a3e', inconnu: '#adb5bd' };

/**
 * @intent INTENT-018
 * @spec SPEC-018-2-aires-ebm-investment-balance
 */
export function blocInvestmentBalance(donnees) {
  const ib = donnees?.investmentBalance;
  if (!ib) return '';

  const santeTexte = { ok: 'Équilibré', attention: 'Attention', critique: 'Critique' };
  const santeCls = `ib-sante-${ib.sante}`;

  const rows = Object.keys(ib.buckets).map((k) => {
    const cible = CIBLES_IB[k] ?? '—';
    return `<tr>
      <td>${escape(IB_LABELS[k] || k)}</td>
      <td>${escape(String(ib.buckets[k]))}</td>
      <td>${escape(String(ib.pcts[k]))} %</td>
      <td>${typeof cible === 'number' ? `${cible} %` : cible}</td>
    </tr>`;
  }).join('');

  const barSegs = Object.keys(ib.pcts).map((k) => {
    const pct = ib.pcts[k];
    if (pct === 0) return '';
    return `<div class="ib-bar-seg" style="width:${pct}%;background:${IB_COLORS[k]};" aria-label="${escape(IB_LABELS[k] || k)} : ${pct} %"></div>`;
  }).join('');

  return `<section>
    <h2>Investment Balance <span class="count">${ib.total} Intent(s) actif(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Répartition de l'effort par type d'Intent. Cibles indicatives : features 65 %, enabler 25 %, conformité+inconnu 10 %.</p>
    <p class="${santeCls}" aria-label="Santé Investment Balance : ${escape(santeTexte[ib.sante] || ib.sante)}">${escape(santeTexte[ib.sante] || ib.sante)}</p>
    <div class="ib-bar-wrap" role="img" aria-label="Répartition Investment Balance en barres proportionnelles">${barSegs}</div>
    <table class="ib-table">
      <caption>Répartition Investment Balance par bucket</caption>
      <thead>
        <tr>
          <th scope="col">Bucket</th>
          <th scope="col">Count</th>
          <th scope="col">%</th>
          <th scope="col">Cible</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}
