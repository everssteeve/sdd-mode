// AIAD SDD Mode — Dashboard : hypothesis lifecycle tracker (#498).
//
// `#438 hypotheses.js` montre la liste des hypothèses ; ce module
// analyse leur **cycle de vie** : transitions entre états et délais.
//
// États standard (alias FR/EN tolérés) :
//   - untested / non-teste / proposed / draft   = à valider
//   - testing  / en-cours / in-progress         = en cours de validation
//   - validated   = confirmée
//   - invalidated / refutee / refuted = réfutée
//   - partial / partielle = partiellement validée
//
// Politique :
//   - Compte total par état + taux de validation (validated / total)
//   - Calcule l'âge moyen des hypothèses non terminales (untested+testing)
//     pour détecter celles qui stagnent
//   - Mean time to validation : pour les `validated`/`invalidated`, âge
//     moyen depuis création (mtime fichier Intent)
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const DAY = 24 * 3600 * 1000;

const NORMALISE_ETAT = {
  untested: 'untested',
  'non-teste': 'untested',
  'non-testée': 'untested',
  proposed: 'untested',
  draft: 'untested',
  testing: 'testing',
  'en-cours': 'testing',
  'in-progress': 'testing',
  inprogress: 'testing',
  validated: 'validated',
  confirmed: 'validated',
  invalidated: 'invalidated',
  refuted: 'invalidated',
  refutee: 'invalidated',
  partial: 'partial',
  partielle: 'partial',
};

function normaliser(etat) {
  if (!etat) return 'untested';
  const k = String(etat).toLowerCase().trim();
  return NORMALISE_ETAT[k] || 'untested';
}

export function classerHypotheses(intents) {
  const items = [];
  for (const i of intents || []) {
    if (!i.hypothesis && !i.Hypothesis) continue;
    const etat = normaliser(i.hypothesis_status || i.hypothesisStatus || 'untested');
    items.push({
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      hypothesis: String(i.hypothesis || i.Hypothesis).slice(0, 200),
      etat,
      mtime: i.mtime || null,
    });
  }
  return items;
}

export function calculerHypothesisLifecycle(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const items = classerHypotheses(donnees?.intents || []);
  const totaux = {
    total: items.length,
    untested: items.filter((i) => i.etat === 'untested').length,
    testing: items.filter((i) => i.etat === 'testing').length,
    validated: items.filter((i) => i.etat === 'validated').length,
    invalidated: items.filter((i) => i.etat === 'invalidated').length,
    partial: items.filter((i) => i.etat === 'partial').length,
  };
  const taux = totaux.total === 0 ? null : Math.round((totaux.validated / totaux.total) * 100);
  // Stagnation : non-terminales avec mtime > 30j.
  const seuilStagnation = 30 * DAY;
  const stagnantes = items.filter((it) => {
    if (!['untested', 'testing'].includes(it.etat)) return false;
    if (!it.mtime) return false;
    return now - it.mtime > seuilStagnation;
  });
  // Mean time to resolution : âge moyen des terminales (validated/invalidated).
  const terminales = items.filter((it) => ['validated', 'invalidated', 'partial'].includes(it.etat) && it.mtime);
  const meanTtr = terminales.length === 0 ? null
    : Math.round(terminales.reduce((s, it) => s + (now - it.mtime), 0) / terminales.length / DAY);
  return {
    items,
    totaux,
    tauxValidation: taux,
    stagnantes: stagnantes.length,
    meanTtrJours: meanTtr,
    stagnantesSample: stagnantes.slice(0, 5),
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const HL_CSS = `<style>
.hl-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap:.4rem; margin:.5rem 0; }
.hl-stat { padding:.45rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.hl-stat.s-untested { background:rgba(127,127,127,.05); }
.hl-stat.s-testing { background:rgba(76,110,245,.05); border-color:rgba(76,110,245,.3); }
.hl-stat.s-validated { background:rgba(43,138,62,.07); border-color:rgba(43,138,62,.3); }
.hl-stat.s-invalidated { background:rgba(201,42,42,.06); border-color:rgba(201,42,42,.3); }
.hl-stat.s-partial { background:rgba(232,89,12,.05); border-color:rgba(232,89,12,.25); }
.hl-stat .hl-val { font-size:1.25rem; font-weight:700; }
.hl-stat .hl-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.hl-meta { padding:.45rem .55rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; margin:.3rem 0; }
.hl-warning { padding:.4rem .55rem; background:rgba(232,89,12,.07); border-left:3px solid #e8590c; border-radius:.25rem; font-size:.85rem; margin:.3rem 0; }
</style>`;

const ICONS = { untested: '?', testing: '◐', validated: '✓', invalidated: '✗', partial: '◑' };

export function blocHypothesisLifecycle(donnees) {
  const h = donnees?.hypothesisLifecycle;
  if (!h) return '';
  if (h.totaux.total === 0) {
    return `${HL_CSS}<section>
      <h2>Cycle de vie des hypothèses <span class="count">aucune hypothèse formulée</span></h2>
      <p class="muted" style="font-size:.85rem">Aucun Intent n'a de frontmatter <code>hypothesis:</code>. Une hypothèse formulée et tracée explicitement réduit le drift et permet de mesurer la pédagogie de l'équipe (taux de validation, mean time-to-validation).</p>
    </section>`;
  }
  const t = h.totaux;
  const grid = ['untested', 'testing', 'validated', 'invalidated', 'partial'].map((etat) => `<div class="hl-stat s-${etat}">
      <div class="hl-val">${t[etat]}</div>
      <div class="hl-label">${ICONS[etat]} ${escape(etat)}</div>
    </div>`).join('');
  const tauxBar = h.tauxValidation != null ? `<strong>${h.tauxValidation}%</strong> validées` : '—';
  const ttr = h.meanTtrJours != null ? `<strong>${h.meanTtrJours} jours</strong> en moyenne` : 'non mesurable (0 hypothèse terminale)';
  const stagnationBox = h.stagnantes > 0
    ? `<div class="hl-warning">⚠ <strong>${h.stagnantes} hypothèse(s) stagnent &gt; 30j</strong> sans changement d'état. Risque : pédagogie produit en panne — programmer une expérimentation rapide ou abandonner.</div>`
    : '';
  return `${HL_CSS}<section>
    <h2>Cycle de vie des hypothèses <span class="count">${t.total} hypothèse(s) — ${tauxBar}</span></h2>
    <p class="muted" style="font-size:.85rem">État des hypothèses produit formulées dans le frontmatter <code>hypothesis:</code> avec leur état (<code>hypothesis_status:</code>). Mesure la pédagogie de l'équipe : un taux de validation bas signale une discovery faiblement structurée.</p>
    <div class="hl-grid">${grid}</div>
    <div class="hl-meta">Mean time to resolution (TTR) : ${ttr}.</div>
    ${stagnationBox}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  classerHypotheses as classifyHypotheses,
  calculerHypothesisLifecycle as computeHypothesisLifecycle,
  blocHypothesisLifecycle as hypothesisLifecycleSection,
};
