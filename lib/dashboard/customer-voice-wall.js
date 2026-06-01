// AIAD SDD Mode — Dashboard : customer voice quote wall (#505).
//
// Sélectionne et met en valeur les **extraits les plus impactants** de
// `customerFeedback` (#496) sous forme de mur de citations. Aide à garder
// la voix client visible en haut du dashboard plutôt que noyée dans une
// liste neutre.
//
// Politique de sélection :
//   - Priorité aux sentiments `negatif` et `question` (signaux d'action)
//   - Top 6 extraits (3 negatifs + 2 questions + 1 positif si dispo)
//   - Récents d'abord (date desc déjà appliquée en amont)
//   - Extrait nettoyé : pas de markdown, normalisé
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

function nettoyerCitation(s) {
  return String(s || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

export function selectionnerCitations(items, options = {}) {
  const max = options.max || 6;
  if (!Array.isArray(items) || items.length === 0) return [];
  // Items déjà triés date desc en amont (customerFeedback).
  const negatifs = items.filter((i) => i.sentiment === 'negatif').slice(0, 3);
  const questions = items.filter((i) => i.sentiment === 'question').slice(0, 2);
  const positifs = items.filter((i) => i.sentiment === 'positif').slice(0, 1);
  // Concat puis dédup par fichier
  const out = [];
  const vus = new Set();
  for (const it of [...negatifs, ...questions, ...positifs]) {
    if (vus.has(it.fichier)) continue;
    vus.add(it.fichier);
    out.push(it);
  }
  return out.slice(0, max);
}

export function calculerCustomerVoiceWall(donnees, options = {}) {
  const items = donnees?.customerFeedback?.items || [];
  const citations = selectionnerCitations(items, options).map((it) => ({
    fichier: it.fichier,
    sentiment: it.sentiment,
    author: it.author || null,
    source: it.source || null,
    intent: it.intent || null,
    date: it.date,
    citation: nettoyerCitation(it.extrait),
  }));
  return {
    citations,
    totalSource: items.length,
    totaux: {
      affiches: citations.length,
      negatifs: citations.filter((c) => c.sentiment === 'negatif').length,
      questions: citations.filter((c) => c.sentiment === 'question').length,
      positifs: citations.filter((c) => c.sentiment === 'positif').length,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const CV_CSS = `<style>
.cv-wall { display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:.55rem; margin:.5rem 0; }
.cv-quote { padding:.65rem .8rem; border-radius:.4rem; background:var(--card-bg, rgba(127,127,127,.04)); border-left:4px solid var(--accent, #4c6ef5); position:relative; }
.cv-quote.s-negatif { border-left-color:#c92a2a; background:rgba(201,42,42,.04); }
.cv-quote.s-positif { border-left-color:#2b8a3e; background:rgba(43,138,62,.04); }
.cv-quote.s-question { border-left-color:#4c6ef5; background:rgba(76,110,245,.04); }
.cv-quote.s-neutre { border-left-color:rgba(127,127,127,.3); }
.cv-citation { font-style:italic; font-size:.95rem; line-height:1.4; color:var(--text, #222); }
.cv-citation::before { content:'« '; opacity:.5; }
.cv-citation::after { content:' »'; opacity:.5; }
.cv-attrib { font-size:.78rem; color:var(--muted, #777); margin-top:.4rem; display:flex; gap:.4rem; flex-wrap:wrap; align-items:baseline; }
.cv-tag { padding:.05rem .35rem; background:rgba(127,127,127,.1); border-radius:.18rem; font-size:.7rem; }
.cv-tag.s-negatif { background:rgba(201,42,42,.12); color:#7a1717; }
.cv-tag.s-question { background:rgba(76,110,245,.12); color:#3a4cba; }
.cv-tag.s-positif { background:rgba(43,138,62,.12); color:#1c5a2a; }
.cv-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
</style>`;

const ICONS = { negatif: '👎', positif: '👍', question: '❓', neutre: '·' };

function fmtDate(ts) { return ts ? new Date(ts).toLocaleDateString('fr-FR') : '—'; }

export function blocCustomerVoiceWall(donnees) {
  const w = donnees?.customerVoiceWall;
  if (!w) return '';
  if (w.citations.length === 0) {
    return `${CV_CSS}<section>
      <h2>Mur de la voix client <span class="count">aucun feedback impactant</span></h2>
      <div class="cv-empty">Quand des fichiers <code>.aiad/feedback/*.md</code> sont présents, les extraits les plus impactants (sentiment négatif/question d'abord) sont affichés ici sous forme de citations.</div>
    </section>`;
  }
  const cartes = w.citations.map((c) => {
    const author = c.author ? `<span class="cv-tag">— ${escape(String(c.author))}</span>` : '';
    const source = c.source ? `<span class="cv-tag">${escape(String(c.source))}</span>` : '';
    const intent = c.intent ? `<span class="cv-tag">${escape(String(c.intent))}</span>` : '';
    return `<div class="cv-quote s-${escape(c.sentiment)}">
      <div class="cv-citation">${escape(c.citation)}</div>
      <div class="cv-attrib">
        <span class="cv-tag s-${escape(c.sentiment)}">${ICONS[c.sentiment]} ${escape(c.sentiment)}</span>
        ${author}${source}${intent}
        <span class="cv-tag">${escape(fmtDate(c.date))}</span>
      </div>
    </div>`;
  }).join('');
  const t = w.totaux;
  return `${CV_CSS}<section>
    <h2>Mur de la voix client <span class="count">${t.affiches} extrait(s) saillant(s) sur ${w.totalSource} feedback(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Sélection automatique des extraits les plus impactants depuis <code>customerFeedback</code> (#496) : sentiments <strong>négatif</strong> et <strong>question</strong> en priorité (signaux d'action), puis 1 positif récent. Aide à garder la voix client visible.</p>
    <div class="cv-wall">${cartes}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  selectionnerCitations as selectQuotes,
  calculerCustomerVoiceWall as computeCustomerVoiceWall,
  blocCustomerVoiceWall as customerVoiceWallSection,
};
