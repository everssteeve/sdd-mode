// AIAD SDD Mode — Dashboard : action items extractor from journals/facts (#544).
//
// Scan `.aiad/metrics/pm-journal/*.md` + `.aiad/facts/*.md` pour
// extraire les **action items** non-faits (`- [ ]`), agrégés et triés
// par date la plus récente. Référence à l'INTENT-NNN si présent.
//
// Pure lecture filesystem.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CHECKBOX_PAT = /^(\s*)[-*]\s+\[\s*([ xX])\s*\]\s+(.+)$/;
const INTENT_REF = /\bINTENT-\d+\b/;

function lireRep(rep) {
  try { return readdirSync(rep); } catch { return []; }
}

function dateDuNom(nom) {
  const m = nom.match(/(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  const t = Date.parse(m[1]);
  return isNaN(t) ? null : t;
}

export function extraireActions(texte, source, fichier, date) {
  if (!texte) return [];
  const out = [];
  for (const l of texte.split(/\r?\n/)) {
    const m = l.match(CHECKBOX_PAT);
    if (!m) continue;
    const fait = m[2].toLowerCase() === 'x';
    const description = m[3].trim();
    const intentRef = description.match(INTENT_REF);
    out.push({
      description: description.slice(0, 200),
      fait,
      source,
      fichier,
      date,
      intent: intentRef ? intentRef[0] : null,
    });
  }
  return out;
}

export function calculerActionItems(racineProjet) {
  const repJournal = join(racineProjet || '.', '.aiad', 'metrics', 'pm-journal');
  const repFacts = join(racineProjet || '.', '.aiad', 'facts');
  const repRetro = join(racineProjet || '.', '.aiad', 'metrics', 'retro');
  const items = [];
  function scanRep(rep, source) {
    for (const n of lireRep(rep)) {
      if (!n.endsWith('.md')) continue;
      const chemin = join(rep, n);
      let texte = '', mtime = 0;
      try {
        texte = readFileSync(chemin, 'utf8');
        mtime = statSync(chemin).mtimeMs;
      } catch { continue; }
      const date = dateDuNom(n) || mtime;
      items.push(...extraireActions(texte, source, n, date));
    }
  }
  scanRep(repJournal, 'journal');
  scanRep(repFacts, 'fact');
  scanRep(repRetro, 'retro');
  items.sort((a, b) => (b.date || 0) - (a.date || 0));
  const nonFaits = items.filter((i) => !i.fait);
  const faits = items.filter((i) => i.fait);
  return {
    items,
    nonFaits,
    faits,
    totaux: {
      total: items.length,
      nonFaits: nonFaits.length,
      faits: faits.length,
      tauxCompletion: items.length === 0 ? 0 : Math.round((faits.length / items.length) * 100),
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const AI_CSS = `<style>
.ai-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:.4rem; margin:.4rem 0; }
.ai-stat { padding:.4rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.ai-stat .ai-val { font-size:1.2rem; font-weight:700; }
.ai-stat .ai-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.ai-stat.has-todo { background:rgba(232,89,12,.05); border-color:rgba(232,89,12,.3); }
.ai-row { padding:.3rem .45rem; margin:.15rem 0; font-size:.82rem; background:rgba(127,127,127,.04); border-radius:.22rem; display:flex; gap:.4rem; align-items:baseline; flex-wrap:wrap; border-left:3px solid #e8590c; }
.ai-row.fait { border-left-color:#2b8a3e; opacity:.7; text-decoration:line-through; background:rgba(43,138,62,.04); }
.ai-tag { padding:.05rem .35rem; background:rgba(127,127,127,.1); border-radius:.18rem; font-size:.7rem; }
.ai-tag.s-journal { background:rgba(76,110,245,.12); color:#3a4cba; }
.ai-tag.s-fact { background:rgba(232,89,12,.12); color:#7a3a08; }
.ai-tag.s-retro { background:rgba(245,166,35,.15); color:#7a560f; }
.ai-tag.intent { background:rgba(43,138,62,.12); color:#1c5a2a; }
.ai-meta { font-size:.72rem; color:var(--muted, #777); }
.ai-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
</style>`;

function fmtDate(ts) { return ts ? new Date(ts).toLocaleDateString('fr-FR') : '—'; }

export function blocActionItems(donnees) {
  const a = donnees?.actionItems;
  if (!a) return '';
  if (a.items.length === 0) {
    return `${AI_CSS}<section>
      <h2>Action items journaux <span class="count">aucun</span></h2>
      <div class="ai-empty">Extrait les checkboxes <code>- [ ]</code> / <code>- [x]</code> depuis <code>pm-journal/</code>, <code>facts/</code>, <code>metrics/retro/</code>. Source primaire pour le suivi des décisions et engagements pris en réunion.</div>
    </section>`;
  }
  const t = a.totaux;
  const grid = [
    `<div class="ai-stat ${t.nonFaits > 0 ? 'has-todo' : ''}"><div class="ai-val">${t.nonFaits}</div><div class="ai-label">À faire</div></div>`,
    `<div class="ai-stat"><div class="ai-val">${t.faits}</div><div class="ai-label">Faits</div></div>`,
    `<div class="ai-stat"><div class="ai-val">${t.total}</div><div class="ai-label">Total</div></div>`,
    `<div class="ai-stat"><div class="ai-val">${t.tauxCompletion}%</div><div class="ai-label">Complétion</div></div>`,
  ].join('');
  const rows = [...a.nonFaits.slice(0, 12), ...a.faits.slice(0, 5)].map((it) => {
    const intentTag = it.intent ? `<span class="ai-tag intent">${escape(it.intent)}</span>` : '';
    return `<div class="ai-row ${it.fait ? 'fait' : ''}">
      <span class="ai-tag s-${escape(it.source)}">${escape(it.source)}</span>
      ${intentTag}
      <span>${escape(it.description.slice(0, 100))}</span>
      <span class="ai-meta">${escape(fmtDate(it.date))} · ${escape(it.fichier)}</span>
    </div>`;
  }).join('');
  return `${AI_CSS}<section>
    <h2>Action items journaux <span class="count">${t.nonFaits} à faire · ${t.faits} faits</span></h2>
    <p class="muted" style="font-size:.85rem">Extrait checkboxes (<code>- [ ]</code>/<code>- [x]</code>) depuis <code>pm-journal/</code> + <code>facts/</code> + <code>metrics/retro/</code>. Référence INTENT-NNN détectée auto. Tri date desc.</p>
    <div class="ai-grid">${grid}</div>
    <div>${rows}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  extraireActions as extractActions,
  calculerActionItems as computeActionItems,
  blocActionItems as actionItemsSection,
};
