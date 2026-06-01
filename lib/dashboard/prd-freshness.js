// AIAD SDD Mode — Dashboard : PRD freshness checker (#495).
//
// Détecte si les artefacts cadrage (PRD + ARCHITECTURE + AGENT-GUIDE)
// sont restés à jour. Un PRD vieux de 6 mois sans toucher = signe que
// la vision dérive sans correction.
//
// Politique :
//   - PRD.md          : signal si mtime > 30j (warn), > 90j (alert)
//   - ARCHITECTURE.md : signal si mtime > 60j (warn), > 180j (alert)
//   - AGENT-GUIDE.md  : signal si mtime > 60j (warn), > 180j (alert)
//
// Capture aussi le nb de sections h2 par doc (proxy "richesse").
//
// Aucun effet de bord. Pure lecture filesystem.
//
// Documentation : https://aiad.ovh

import { statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DAY = 24 * 3600 * 1000;

const FICHIERS = [
  { cle: 'prd', chemin: '.aiad/PRD.md', warn: 30, alert: 90, label: 'PRD' },
  { cle: 'arch', chemin: '.aiad/ARCHITECTURE.md', warn: 60, alert: 180, label: 'ARCHITECTURE' },
  { cle: 'guide', chemin: '.aiad/AGENT-GUIDE.md', warn: 60, alert: 180, label: 'AGENT-GUIDE' },
];

function statSafe(chemin) {
  try { return statSync(chemin); } catch { return null; }
}

function lireTexte(chemin) {
  try { return readFileSync(chemin, 'utf8'); } catch { return null; }
}

export function compterSectionsH2(texte) {
  if (!texte) return 0;
  let n = 0;
  for (const l of texte.split(/\r?\n/)) {
    if (/^##\s+/.test(l)) n++;
  }
  return n;
}

function classer(jours, warn, alert) {
  if (jours == null) return 'absent';
  if (jours <= warn) return 'frais';
  if (jours <= alert) return 'tiede';
  return 'perimee';
}

export function calculerPrdFreshness(racineProjet, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const items = FICHIERS.map((f) => {
    const chemin = join(racineProjet || '.', f.chemin);
    const stat = statSafe(chemin);
    if (!stat) return { ...f, present: false, mtime: null, jours: null, etat: 'absent', sectionsH2: 0 };
    const jours = Math.floor((now - stat.mtimeMs) / DAY);
    const etat = classer(jours, f.warn, f.alert);
    const texte = lireTexte(chemin);
    return {
      cle: f.cle,
      chemin: f.chemin,
      label: f.label,
      warn: f.warn,
      alert: f.alert,
      present: true,
      mtime: stat.mtimeMs,
      jours,
      etat,
      sectionsH2: compterSectionsH2(texte),
    };
  });
  const totaux = {
    total: items.length,
    presents: items.filter((i) => i.present).length,
    frais: items.filter((i) => i.etat === 'frais').length,
    tiede: items.filter((i) => i.etat === 'tiede').length,
    perimee: items.filter((i) => i.etat === 'perimee').length,
    absents: items.filter((i) => !i.present).length,
  };
  return { items, totaux };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const PF_CSS = `<style>
.pf-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:.5rem; margin:.5rem 0; }
.pf-card { padding:.5rem .65rem; border-radius:.3rem; border:1px solid var(--border, #ddd); background:var(--card-bg, rgba(127,127,127,.04)); }
.pf-card.lvl-frais { border-left:3px solid #2b8a3e; background:rgba(43,138,62,.04); }
.pf-card.lvl-tiede { border-left:3px solid #e8590c; background:rgba(232,89,12,.04); }
.pf-card.lvl-perimee { border-left:3px solid #c92a2a; background:rgba(201,42,42,.06); }
.pf-card.lvl-absent { border-left:3px dashed var(--border, #ccc); opacity:.7; }
.pf-head { display:flex; gap:.4rem; align-items:baseline; }
.pf-label { font-weight:600; }
.pf-age { font-size:.8rem; padding:.1rem .35rem; border-radius:.2rem; }
.pf-age.lvl-frais { background:rgba(43,138,62,.15); color:#1c5a2a; }
.pf-age.lvl-tiede { background:rgba(232,89,12,.15); color:#7a3a08; }
.pf-age.lvl-perimee { background:rgba(201,42,42,.15); color:#7a1717; }
.pf-meta { font-size:.75rem; color:var(--muted, #777); margin-top:.25rem; }
</style>`;

function fmtDate(ts) {
  return ts ? new Date(ts).toLocaleDateString('fr-FR') : '—';
}

const LABELS = { frais: '✓ Frais', tiede: '⚠ Tiède', perimee: '⛔ Périmée', absent: '⊘ Absent' };

export function blocPrdFreshness(donnees) {
  const f = donnees?.prdFreshness;
  if (!f) return '';
  const cards = f.items.map((it) => {
    if (!it.present) {
      return `<div class="pf-card lvl-absent">
        <div class="pf-head"><span class="pf-label">${escape(it.label)}</span><span class="pf-age lvl-perimee">absent</span></div>
        <div class="pf-meta">Lance <code>npx aiad-sdd init</code> pour scaffolder l'artefact.</div>
      </div>`;
    }
    return `<div class="pf-card lvl-${escape(it.etat)}">
      <div class="pf-head">
        <span class="pf-label">${escape(it.label)}</span>
        <span class="pf-age lvl-${escape(it.etat)}">${escape(LABELS[it.etat] || it.etat)} · ${it.jours}j</span>
      </div>
      <div class="pf-meta">dernière édition ${escape(fmtDate(it.mtime))} · ${it.sectionsH2} sections h2 · seuil ${it.warn}/${it.alert}j</div>
    </div>`;
  }).join('');
  const t = f.totaux;
  const action = (t.perimee + t.absents) > 0
    ? `<p class="muted" style="font-size:.85rem">⚠ <strong>${t.perimee} périmé(s) / ${t.absents} absent(s)</strong> — programmer un atelier d'intention pour rafraîchir.</p>`
    : t.tiede > 0
      ? `<p class="muted" style="font-size:.85rem">⚠ <strong>${t.tiede} doc(s) tiède(s)</strong> — vérifier que la vision n'a pas dérivé.</p>`
      : `<p class="muted" style="font-size:.85rem">✓ Tous les artefacts cadrage sont frais.</p>`;
  return `${PF_CSS}<section>
    <h2>Fraîcheur cadrage <span class="count">${t.presents}/${t.total} présent(s) · ${t.frais} frais</span></h2>
    <p class="muted" style="font-size:.85rem">Vérifie que PRD / ARCHITECTURE / AGENT-GUIDE sont touchés récemment. Un doc périmé = signal que la vision dérive sans correction documentaire. Seuils par doc (warn / alert) configurés selon la cadence attendue.</p>
    <div class="pf-grid">${cards}</div>
    ${action}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  compterSectionsH2 as countH2Sections,
  calculerPrdFreshness as computePrdFreshness,
  blocPrdFreshness as prdFreshnessSection,
};
