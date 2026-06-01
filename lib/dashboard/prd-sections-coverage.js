// AIAD SDD Mode — Dashboard : PRD section-level coverage (#529).
//
// `#495 prd-freshness` regarde le fichier PRD entier. Ce module va
// plus loin en parsant les sections h2 du PRD et indique :
//   - Longueur (mots) par section
//   - Section vide (titre seul ou < 30 mots) = signal de complétion
//   - Présence des sections canoniques AIAD : Contexte (§1), North Star
//     (§2), Personas (§3), Outcomes (§4), User Stories (§6), Décisions (§7)
//
// Pure lecture filesystem.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SECTIONS_CANONIQUES = [
  { motCle: /contexte|context/i, label: 'Contexte', numero: 1 },
  { motCle: /north\s*star|product\s*goal|nord/i, label: 'North Star', numero: 2 },
  { motCle: /personas?|users?|cas\s*d/i, label: 'Personas / Cas', numero: 3 },
  { motCle: /outcomes?|criteres?\s*mesurables|criteres?\s*de/i, label: 'Outcomes', numero: 4 },
  { motCle: /user\s*stor|jobs?|cas\s*d.usage/i, label: 'User Stories', numero: 6 },
  { motCle: /decisions?|adrs?|architecture/i, label: 'Décisions', numero: 7 },
];

function lireFichier(chemin) {
  if (!existsSync(chemin)) return null;
  try { return readFileSync(chemin, 'utf8'); } catch { return null; }
}

function compterMots(s) {
  if (!s) return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export function parserSectionsPrd(contenu) {
  if (!contenu) return [];
  // Strip frontmatter
  const body = contenu.replace(/^---[\s\S]*?---\s*/m, '');
  const lignes = body.split(/\r?\n/);
  const sections = [];
  let cur = null;
  for (const l of lignes) {
    const m = l.match(/^##\s+(.+?)\s*$/);
    if (m) {
      if (cur) sections.push(cur);
      cur = { titre: m[1].trim(), corps: [] };
    } else if (cur) {
      cur.corps.push(l);
    }
  }
  if (cur) sections.push(cur);
  return sections.map((s) => ({
    titre: s.titre,
    mots: compterMots(s.corps.join('\n')),
  }));
}

export function classerSection(s) {
  if (s.mots === 0) return 'vide';
  if (s.mots < 30) return 'squelette';
  if (s.mots < 150) return 'leger';
  return 'fourni';
}

export function calculerPrdSectionsCoverage(racineProjet) {
  const chemin = join(racineProjet || '.', '.aiad', 'PRD.md');
  const contenu = lireFichier(chemin);
  if (!contenu) {
    return { sections: [], canoniques: [], present: false, message: 'PRD.md absent' };
  }
  const sections = parserSectionsPrd(contenu);
  const enrichies = sections.map((s) => ({ ...s, etat: classerSection(s) }));
  // Map sections canoniques → trouvé ou non.
  const canoniques = SECTIONS_CANONIQUES.map((c) => {
    const trouve = enrichies.find((s) => c.motCle.test(s.titre));
    return {
      label: c.label,
      numero: c.numero,
      present: !!trouve,
      titre: trouve?.titre || null,
      mots: trouve?.mots || 0,
      etat: trouve?.etat || 'absent',
    };
  });
  const totaux = {
    sections: enrichies.length,
    vides: enrichies.filter((s) => s.etat === 'vide').length,
    squelettes: enrichies.filter((s) => s.etat === 'squelette').length,
    legers: enrichies.filter((s) => s.etat === 'leger').length,
    fournis: enrichies.filter((s) => s.etat === 'fourni').length,
    canoniquesPresents: canoniques.filter((c) => c.present).length,
    canoniquesAbsents: canoniques.filter((c) => !c.present).length,
  };
  return { sections: enrichies, canoniques, present: true, totaux, message: null };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const PSC_CSS = `<style>
.psc-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:.4rem; margin:.4rem 0; }
.psc-stat { padding:.4rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.psc-stat .psc-val { font-size:1.15rem; font-weight:700; }
.psc-stat .psc-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.psc-stat.s-vide { background:rgba(201,42,42,.05); border-color:rgba(201,42,42,.3); }
.psc-stat.s-squelette { background:rgba(232,89,12,.05); border-color:rgba(232,89,12,.3); }
.psc-stat.s-leger { background:rgba(245,166,35,.05); border-color:rgba(245,166,35,.3); }
.psc-stat.s-fourni { background:rgba(43,138,62,.07); border-color:rgba(43,138,62,.3); }
.psc-cano { display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:.3rem; margin:.3rem 0; }
.psc-cano-card { padding:.35rem .5rem; border-radius:.25rem; background:rgba(127,127,127,.05); border-left:3px solid var(--border, #ccc); }
.psc-cano-card.absent { border-left-color:#c92a2a; background:rgba(201,42,42,.04); }
.psc-cano-card.present { border-left-color:#2b8a3e; background:rgba(43,138,62,.04); }
.psc-cano-card h4 { font-size:.78rem; margin:0; }
.psc-cano-card .psc-meta { font-size:.7rem; color:var(--muted, #777); }
.psc-row { padding:.25rem .4rem; margin:.1rem 0; font-size:.78rem; background:rgba(127,127,127,.04); border-radius:.18rem; display:flex; gap:.4rem; align-items:baseline; }
.psc-tag { padding:.05rem .3rem; background:rgba(127,127,127,.1); border-radius:.15rem; font-size:.7rem; }
.psc-tag.s-vide { background:rgba(201,42,42,.12); color:#7a1717; }
.psc-tag.s-squelette { background:rgba(232,89,12,.12); color:#7a3a08; }
.psc-tag.s-leger { background:rgba(245,166,35,.15); color:#7a560f; }
.psc-tag.s-fourni { background:rgba(43,138,62,.12); color:#1c5a2a; }
.psc-empty { padding:.5rem .7rem; background:rgba(201,42,42,.06); border-left:3px solid #c92a2a; border-radius:.25rem; font-size:.85rem; color:#7a1717; }
</style>`;

export function blocPrdSectionsCoverage(donnees) {
  const c = donnees?.prdSectionsCoverage;
  if (!c) return '';
  if (!c.present || c.message) {
    return `${PSC_CSS}<section>
      <h2>Couverture sections PRD <span class="count">${escape(c.message || 'absent')}</span></h2>
      <div class="psc-empty">PRD.md absent — lance <code>npx aiad-sdd init</code> ou <code>/sdd prd</code> pour le scaffolder.</div>
    </section>`;
  }
  const t = c.totaux;
  const grid = ['fourni', 'leger', 'squelette', 'vide'].map((etat) => `<div class="psc-stat s-${etat}">
      <div class="psc-val">${t[etat === 'fourni' ? 'fournis' : etat === 'leger' ? 'legers' : etat === 'squelette' ? 'squelettes' : 'vides'] || 0}</div>
      <div class="psc-label">${escape(etat)}</div>
    </div>`).join('');
  const cano = c.canoniques.map((k) => `<div class="psc-cano-card ${k.present ? 'present' : 'absent'}">
      <h4>§${k.numero} ${escape(k.label)}</h4>
      <div class="psc-meta">${k.present ? `${k.mots} mots · ${escape(k.etat)}` : 'absente'}</div>
    </div>`).join('');
  const rows = c.sections.slice(0, 15).map((s) => `<div class="psc-row">
      <strong>${escape(s.titre)}</strong>
      <span class="psc-tag s-${escape(s.etat)}">${escape(s.etat)}</span>
      <span class="muted">${s.mots} mots</span>
    </div>`).join('');
  return `${PSC_CSS}<section>
    <h2>Couverture sections PRD <span class="count">${t.sections} section(s) · ${t.canoniquesPresents}/${c.canoniques.length} canoniques</span></h2>
    <p class="muted" style="font-size:.85rem">Parse le PRD section par section : nb mots, état (vide / squelette < 30 / léger < 150 / fourni). Vérifie présence des 6 sections AIAD canoniques (§1 Contexte, §2 North Star, §3 Personas, §4 Outcomes, §6 User Stories, §7 Décisions).</p>
    <div class="psc-grid">${grid}</div>
    <div class="psc-cano">${cano}</div>
    <div>${rows}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  parserSectionsPrd as parsePrdSections,
  classerSection as classifySection,
  calculerPrdSectionsCoverage as computePrdSectionsCoverage,
  blocPrdSectionsCoverage as prdSectionsCoverageSection,
};
