// AIAD SDD Mode — Dashboard : decisions/facts log par trimestre (#553).
//
// Groupe les facts (`.aiad/facts/*.md`) et les sections `## Décisions`
// des `pm-journal/*.md` par trimestre, pour préparer rapidement les
// retrospectives trimestrielles ou audits.
//
// Pure lecture filesystem.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SEC_DEC = /^##\s+(décisions|decisions)\s*$/i;
const SEC_ANY = /^##\s+/;
const BULLET = /^\s*[-*]\s+(.+)$/;

function lireRep(rep) {
  try { return readdirSync(rep); } catch { return []; }
}

function trimestreDe(ts) {
  const d = new Date(ts);
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `Q${q}-${d.getUTCFullYear()}`;
}

export function extraireDecisionsJournal(texte) {
  if (!texte) return [];
  const lignes = texte.split(/\r?\n/);
  const out = [];
  let dans = false;
  for (const l of lignes) {
    if (SEC_DEC.test(l)) { dans = true; continue; }
    if (SEC_ANY.test(l)) { dans = false; }
    if (dans) {
      const m = l.match(BULLET);
      if (m) out.push(m[1].trim());
    }
  }
  return out;
}

export function calculerQuarterlyDecisions(racineProjet) {
  const repJournal = join(racineProjet || '.', '.aiad', 'metrics', 'pm-journal');
  const repFacts = join(racineProjet || '.', '.aiad', 'facts');
  const buckets = new Map();
  function ensure(t) {
    if (!buckets.has(t)) buckets.set(t, { trim: t, decisions: [], facts: [] });
    return buckets.get(t);
  }
  // pm-journal entries
  for (const n of lireRep(repJournal)) {
    if (!n.endsWith('.md')) continue;
    const chemin = join(repJournal, n);
    let texte = '', mtime = 0;
    try {
      texte = readFileSync(chemin, 'utf8');
      mtime = statSync(chemin).mtimeMs;
    } catch { continue; }
    const dateParse = Date.parse(n.replace(/\.md$/, ''));
    const ts = !isNaN(dateParse) ? dateParse : mtime;
    const trim = trimestreDe(ts);
    const decisions = extraireDecisionsJournal(texte);
    if (decisions.length > 0) {
      const e = ensure(trim);
      for (const d of decisions) e.decisions.push({ texte: d, fichier: n, ts });
    }
  }
  // facts
  for (const n of lireRep(repFacts)) {
    if (!n.endsWith('.md')) continue;
    let mtime = 0;
    try { mtime = statSync(join(repFacts, n)).mtimeMs; } catch { continue; }
    const trim = trimestreDe(mtime);
    ensure(trim).facts.push({ fichier: n, ts: mtime });
  }
  const items = [...buckets.values()].sort((a, b) => {
    const [ta, ya] = a.trim.split('-');
    const [tb, yb] = b.trim.split('-');
    if (ya !== yb) return parseInt(yb, 10) - parseInt(ya, 10);
    return parseInt(tb.slice(1), 10) - parseInt(ta.slice(1), 10);
  });
  const totaux = {
    trimestres: items.length,
    totalDecisions: items.reduce((s, x) => s + x.decisions.length, 0),
    totalFacts: items.reduce((s, x) => s + x.facts.length, 0),
  };
  return { items, totaux };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const QD_CSS = `<style>
.qd-bucket { padding:.5rem .65rem; margin:.3rem 0; border-radius:.35rem; background:rgba(127,127,127,.04); border-left:3px solid #4c6ef5; }
.qd-bucket h4 { font-size:.92rem; margin:.05rem 0 .2rem; }
.qd-meta { font-size:.74rem; color:var(--muted, #777); }
.qd-list { list-style:none; padding:0; margin:.2rem 0; font-size:.82rem; }
.qd-list li { padding:.15rem 0; }
.qd-tag { padding:.05rem .35rem; background:rgba(127,127,127,.1); border-radius:.18rem; font-size:.7rem; }
.qd-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
</style>`;

export function blocQuarterlyDecisions(donnees) {
  const q = donnees?.quarterlyDecisions;
  if (!q) return '';
  if (q.items.length === 0) {
    return `${QD_CSS}<section>
      <h2>Décisions & facts par trimestre <span class="count">aucune décision documentée</span></h2>
      <div class="qd-empty">Groupe les décisions <code>## Décisions</code> des <code>pm-journal/</code> et les <code>facts/</code> par trimestre. Capture des décisions via <code>/aiad standup</code> ou <code>/sdd fact</code> pour alimenter l'historique.</div>
    </section>`;
  }
  const t = q.totaux;
  const cards = q.items.slice(0, 6).map((b) => {
    const decisionsLi = b.decisions.slice(0, 6).map((d) => `<li>${escape(d.texte.slice(0, 120))} <span class="qd-meta">— ${escape(d.fichier)}</span></li>`).join('');
    const factsLi = b.facts.slice(0, 4).map((f) => `<li><span class="qd-tag">fact</span> ${escape(f.fichier)}</li>`).join('');
    return `<div class="qd-bucket">
      <h4>${escape(b.trim)} <span class="qd-tag">${b.decisions.length} décision(s)</span> <span class="qd-tag">${b.facts.length} fact(s)</span></h4>
      ${decisionsLi ? `<ul class="qd-list">${decisionsLi}</ul>` : ''}
      ${factsLi ? `<ul class="qd-list">${factsLi}</ul>` : ''}
    </div>`;
  }).join('');
  return `${QD_CSS}<section>
    <h2>Décisions & facts par trimestre <span class="count">${t.trimestres} trim. · ${t.totalDecisions} décisions · ${t.totalFacts} facts</span></h2>
    <p class="muted" style="font-size:.85rem">Décisions <code>## Décisions</code> des <code>pm-journal/</code> + fichiers <code>facts/</code> groupés par trimestre. Trimestre courant en tête. Source primaire pour la rétro et l'audit.</p>
    <div>${cards}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  extraireDecisionsJournal as extractJournalDecisions,
  calculerQuarterlyDecisions as computeQuarterlyDecisions,
  blocQuarterlyDecisions as quarterlyDecisionsSection,
};
