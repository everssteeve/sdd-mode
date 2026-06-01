// AIAD SDD Mode — Dashboard : sprint commit recap (#542).
//
// Compare ce qui était dans le **commit horizon précédent** (proxy :
// SPECs avec mtime au début du sprint courant) vs ce qui a été
// effectivement livré pendant le sprint (mtime done dans la fenêtre).
//
// Sprint par défaut = 14 jours.
//
// Pure transformation.

const DAY = 24 * 3600 * 1000;
const STATUTS_LIVRES = new Set(['done', 'archived']);

export function calculerSprintRecap(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const dureeJours = options.dureeJours || 14;
  const debutSprint = now - dureeJours * DAY;
  const specs = donnees?.specs || [];
  // SPECs qui existaient au début du sprint (mtime <= debutSprint)
  const existant = specs.filter((s) => s.mtime && s.mtime <= debutSprint);
  // SPECs livrées pendant le sprint
  const livrees = specs.filter((s) => STATUTS_LIVRES.has(s.statut) && s.mtime && s.mtime > debutSprint);
  // SPECs en cours au début (non-livrées à ce moment-là — approx via statut courant + mtime)
  const enCoursAuDebut = existant.filter((s) => !STATUTS_LIVRES.has(s.statut));
  // SPECs ajoutées pendant le sprint
  const ajoutees = specs.filter((s) => s.mtime && s.mtime > debutSprint && !STATUTS_LIVRES.has(s.statut));
  const totaux = {
    duree: dureeJours,
    debutSprint,
    finSprint: now,
    livrees: livrees.length,
    enCoursAuDebut: enCoursAuDebut.length,
    ajoutees: ajoutees.length,
    existant: existant.length,
    completionRatio: enCoursAuDebut.length === 0 ? null : Math.round((livrees.length / Math.max(1, enCoursAuDebut.length)) * 100),
  };
  return {
    livreesSample: livrees.slice(0, 8).map((s) => ({ id: s.id, titre: s.titre || '', mtime: s.mtime })),
    ajouteesSample: ajoutees.slice(0, 8).map((s) => ({ id: s.id, titre: s.titre || '', mtime: s.mtime })),
    enCoursAuDebutSample: enCoursAuDebut.slice(0, 8).map((s) => ({ id: s.id, titre: s.titre || '', statut: s.statut })),
    totaux,
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const SR_CSS = `<style>
.sr-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:.4rem; margin:.4rem 0; }
.sr-stat { padding:.4rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.sr-stat .sr-val { font-size:1.2rem; font-weight:700; }
.sr-stat .sr-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.sr-stat.highlight { background:rgba(43,138,62,.07); border-color:rgba(43,138,62,.3); }
.sr-stat.warn { background:rgba(232,89,12,.05); border-color:rgba(232,89,12,.3); }
.sr-buckets { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:.5rem; margin:.4rem 0; }
.sr-bucket { padding:.45rem .55rem; border-radius:.3rem; background:rgba(127,127,127,.04); border-left:3px solid var(--accent, #4c6ef5); }
.sr-bucket.livrees { border-left-color:#2b8a3e; background:rgba(43,138,62,.04); }
.sr-bucket.ajoutees { border-left-color:#e8590c; }
.sr-bucket h4 { font-size:.85rem; margin:.05rem 0 .2rem; }
.sr-list { list-style:none; padding:0; margin:0; font-size:.78rem; }
.sr-list li { padding:.1rem 0; }
.sr-meta { font-size:.75rem; color:var(--muted, #777); }
.sr-banner { padding:.4rem .55rem; background:rgba(76,110,245,.05); border-left:3px solid #4c6ef5; border-radius:.25rem; font-size:.85rem; margin:.3rem 0; }
</style>`;

function fmtDate(ts) { return ts ? new Date(ts).toLocaleDateString('fr-FR') : '—'; }

export function blocSprintRecap(donnees) {
  const r = donnees?.sprintRecap;
  if (!r) return '';
  const t = r.totaux;
  if (t.livrees + t.ajoutees + t.enCoursAuDebut === 0) {
    return `${SR_CSS}<section>
      <h2>Recap sprint ${t.duree}j <span class="count">aucune activité</span></h2>
      <p class="muted" style="font-size:.85rem">Pas d'activité SPEC sur les ${t.duree} derniers jours.</p>
    </section>`;
  }
  const grid = [
    `<div class="sr-stat highlight"><div class="sr-val">${t.livrees}</div><div class="sr-label">SPECs livrées</div></div>`,
    `<div class="sr-stat warn"><div class="sr-val">${t.ajoutees}</div><div class="sr-label">SPECs ajoutées</div></div>`,
    `<div class="sr-stat"><div class="sr-val">${t.enCoursAuDebut}</div><div class="sr-label">En cours au début</div></div>`,
    `<div class="sr-stat ${t.completionRatio != null && t.completionRatio >= 80 ? 'highlight' : ''}"><div class="sr-val">${t.completionRatio ?? '—'}%</div><div class="sr-label">Taux complétion</div></div>`,
  ].join('');
  function bucket(items, classe, titre, render) {
    if (items.length === 0) return `<div class="sr-bucket ${classe}"><h4>${escape(titre)} <span class="count">0</span></h4><div class="sr-meta">—</div></div>`;
    const li = items.slice(0, 5).map(render).join('');
    return `<div class="sr-bucket ${classe}">
      <h4>${escape(titre)} <span class="count">${items.length}</span></h4>
      <ul class="sr-list">${li}</ul>
    </div>`;
  }
  const buckets = [
    bucket(r.livreesSample, 'livrees', '✓ Livrées pendant le sprint', (s) => `<li><code>${escape(s.id)}</code> ${escape((s.titre || '').slice(0, 40))}</li>`),
    bucket(r.ajouteesSample, 'ajoutees', '➕ Ajoutées pendant le sprint', (s) => `<li><code>${escape(s.id)}</code> ${escape((s.titre || '').slice(0, 40))}</li>`),
    bucket(r.enCoursAuDebutSample, '', '◐ En cours au début', (s) => `<li><code>${escape(s.id)}</code> [${escape(s.statut || '?')}]</li>`),
  ].join('');
  return `${SR_CSS}<section>
    <h2>Recap sprint ${t.duree}j <span class="count">${escape(fmtDate(t.debutSprint))} → ${escape(fmtDate(t.finSprint))}</span></h2>
    <p class="muted" style="font-size:.85rem">Recap du sprint ${t.duree} jours : SPECs livrées vs ajoutées en cours de route. Taux complétion = livrées / (en cours au début) × 100.</p>
    <div class="sr-banner">🎯 Engagement vs réalité : <strong>${t.livrees}/${t.enCoursAuDebut}</strong> SPECs en cours au début ont été livrées, plus ${t.ajoutees} ajoutées en cours.</div>
    <div class="sr-grid">${grid}</div>
    <div class="sr-buckets">${buckets}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerSprintRecap as computeSprintRecap,
  blocSprintRecap as sprintRecapSection,
};
