// AIAD SDD Mode — Dashboard : PM personal KPIs scorecard (#500).
//
// KPIs PM mesurés sur 30 jours glissants vs 30 jours précédents :
//   - Intents capturés      (mtime créé dans la fenêtre)
//   - SPECs livrées         (statut done dans la fenêtre)
//   - Décisions documentées (cumul de #490 buckets sur la fenêtre)
//   - Entrées journal       (.aiad/metrics/pm-journal/*.md)
//   - Demos réalisées       (.aiad/metrics/demo/*)
//   - Rétro / sync-strat    (.aiad/metrics/{retro,sync-strat}/*)
//
// Pour chaque KPI : valeur courante, delta vs période précédente,
// direction (up/down/flat). Permet au PM de mesurer son rythme
// d'activité sans dépendre d'outils externes.
//
// Aucun effet de bord. Pure lecture filesystem + agrégation.
//
// Documentation : https://aiad.ovh

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DAY = 24 * 3600 * 1000;
const FENETRE = 30 * DAY;

function lireRep(rep) {
  try { return readdirSync(rep); } catch { return []; }
}

function compterFichiersDansFenetre(rep, fromMs, toMs) {
  let n = 0;
  for (const nom of lireRep(rep)) {
    if (nom.startsWith('.')) continue;
    try {
      const m = statSync(join(rep, nom)).mtimeMs;
      if (m >= fromMs && m < toMs) n++;
    } catch { /* ignore */ }
  }
  return n;
}

function deltaDirection(courant, precedent) {
  if (precedent === 0 && courant === 0) return 'flat';
  if (precedent === 0) return 'up';
  const ratio = (courant - precedent) / precedent;
  if (ratio > 0.1) return 'up';
  if (ratio < -0.1) return 'down';
  return 'flat';
}

function compterIntentsCrees(intents, fromMs, toMs) {
  let n = 0;
  for (const i of intents || []) {
    if (!i.mtime) continue;
    if (i.mtime >= fromMs && i.mtime < toMs) n++;
  }
  return n;
}

function compterSpecsLivrees(specs, fromMs, toMs) {
  const livres = new Set(['done', 'archived']);
  let n = 0;
  for (const s of specs || []) {
    if (!livres.has(s.statut)) continue;
    if (!s.mtime) continue;
    if (s.mtime >= fromMs && s.mtime < toMs) n++;
  }
  return n;
}

export function calculerPmScorecard(racineProjet, donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const fin1 = now;
  const debut1 = now - FENETRE;
  const fin0 = debut1;
  const debut0 = fin0 - FENETRE;
  const intents = donnees?.intents || [];
  const specs = donnees?.specs || [];
  const repJournal = join(racineProjet || '.', '.aiad', 'metrics', 'pm-journal');
  const repDemo = join(racineProjet || '.', '.aiad', 'metrics', 'demo');
  const repSync = join(racineProjet || '.', '.aiad', 'metrics', 'sync-strat');
  const repRetro = join(racineProjet || '.', '.aiad', 'metrics', 'retro');
  const repFacts = join(racineProjet || '.', '.aiad', 'facts');
  const kpis = [
    {
      cle: 'intents-crees',
      label: 'Intents capturés',
      courant: compterIntentsCrees(intents, debut1, fin1),
      precedent: compterIntentsCrees(intents, debut0, fin0),
      icone: '💡',
    },
    {
      cle: 'specs-livrees',
      label: 'SPECs livrées',
      courant: compterSpecsLivrees(specs, debut1, fin1),
      precedent: compterSpecsLivrees(specs, debut0, fin0),
      icone: '🚀',
    },
    {
      cle: 'journal',
      label: 'Entrées journal',
      courant: compterFichiersDansFenetre(repJournal, debut1, fin1),
      precedent: compterFichiersDansFenetre(repJournal, debut0, fin0),
      icone: '📓',
    },
    {
      cle: 'facts',
      label: 'Facts capturés',
      courant: compterFichiersDansFenetre(repFacts, debut1, fin1),
      precedent: compterFichiersDansFenetre(repFacts, debut0, fin0),
      icone: '📊',
    },
    {
      cle: 'demos',
      label: 'Demos réalisées',
      courant: compterFichiersDansFenetre(repDemo, debut1, fin1),
      precedent: compterFichiersDansFenetre(repDemo, debut0, fin0),
      icone: '🎬',
    },
    {
      cle: 'syncs',
      label: 'Sync stratégiques',
      courant: compterFichiersDansFenetre(repSync, debut1, fin1) + compterFichiersDansFenetre(repRetro, debut1, fin1),
      precedent: compterFichiersDansFenetre(repSync, debut0, fin0) + compterFichiersDansFenetre(repRetro, debut0, fin0),
      icone: '🎯',
    },
  ];
  kpis.forEach((k) => {
    k.delta = k.courant - k.precedent;
    k.direction = deltaDirection(k.courant, k.precedent);
  });
  const totalCourant = kpis.reduce((s, k) => s + k.courant, 0);
  const totalPrecedent = kpis.reduce((s, k) => s + k.precedent, 0);
  return {
    kpis,
    fenetre: { debut: debut1, fin: fin1 },
    fenetrePrecedente: { debut: debut0, fin: fin0 },
    totalActivite: totalCourant,
    totalPrecedent,
    directionGlobale: deltaDirection(totalCourant, totalPrecedent),
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const SC_CSS = `<style>
.psc-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:.5rem; margin:.5rem 0; }
.psc-kpi { padding:.55rem .7rem; border-radius:.35rem; border:1px solid var(--border, #ddd); background:var(--card-bg, rgba(127,127,127,.04)); }
.psc-kpi.d-up { border-left:3px solid #2b8a3e; }
.psc-kpi.d-down { border-left:3px solid #c92a2a; }
.psc-kpi.d-flat { border-left:3px solid rgba(127,127,127,.3); }
.psc-head { display:flex; gap:.4rem; align-items:baseline; margin-bottom:.2rem; }
.psc-icone { font-size:1.05rem; }
.psc-label { font-size:.78rem; font-weight:500; }
.psc-courant { font-size:1.5rem; font-weight:700; }
.psc-delta { font-size:.78rem; padding:.05rem .3rem; border-radius:.2rem; background:rgba(127,127,127,.1); }
.psc-delta.d-up { background:rgba(43,138,62,.15); color:#1c5a2a; }
.psc-delta.d-down { background:rgba(201,42,42,.15); color:#7a1717; }
.psc-prev { font-size:.7rem; color:var(--muted, #777); margin-top:.15rem; }
.psc-banner { padding:.4rem .55rem; background:rgba(127,127,127,.05); border-radius:.25rem; font-size:.85rem; margin:.3rem 0; }
.psc-banner.d-up { background:rgba(43,138,62,.06); border-left:3px solid #2b8a3e; }
.psc-banner.d-down { background:rgba(201,42,42,.06); border-left:3px solid #c92a2a; }
</style>`;

function fmtDateCourte(ts) {
  return ts ? new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—';
}

const ICON_DIR = { up: '↗', down: '↘', flat: '→' };

export function blocPmScorecard(donnees) {
  const s = donnees?.pmScorecard;
  if (!s) return '';
  const kpis = s.kpis.map((k) => `<div class="psc-kpi d-${escape(k.direction)}">
      <div class="psc-head">
        <span class="psc-icone">${k.icone}</span>
        <span class="psc-label">${escape(k.label)}</span>
      </div>
      <div class="psc-courant">${k.courant}</div>
      <div class="psc-prev">vs ${k.precedent} · <span class="psc-delta d-${escape(k.direction)}">${ICON_DIR[k.direction]} ${k.delta >= 0 ? '+' : ''}${k.delta}</span></div>
    </div>`).join('');
  const sens = s.directionGlobale === 'up' ? 'en accélération'
    : s.directionGlobale === 'down' ? 'en décélération' : 'stable';
  const banner = `<div class="psc-banner d-${escape(s.directionGlobale)}">Activité PM 30j (${escape(fmtDateCourte(s.fenetre.debut))} → ${escape(fmtDateCourte(s.fenetre.fin))}) : ${s.totalActivite} action(s) vs ${s.totalPrecedent} sur la période précédente — ${sens}.</div>`;
  return `${SC_CSS}<section>
    <h2>Scorecard PM personnel <span class="count">30j glissants vs précédents</span></h2>
    <p class="muted" style="font-size:.85rem">Mesure le rythme d'activité PM sur 6 KPIs (Intents capturés, SPECs livrées, journal, facts, demos, syncs/retros). Direction indiquée par flèche colorée selon le delta &gt; ±10 %.</p>
    ${banner}
    <div class="psc-grid">${kpis}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerPmScorecard as computePmScorecard,
  blocPmScorecard as pmScorecardSection,
};
