// AIAD SDD Mode — Dashboard : customer feedback inbox (#496).
//
// Surface les fichiers `.aiad/feedback/*.md` (ou
// `.aiad/customer-feedback/*.md` en alias) pour donner au PM une vue
// agrégée du retour stakeholder/utilisateur dans le dashboard.
//
// Heuristique sentiment (simpliste mais utile en triage rapide) :
//   - mots positifs (FR/EN) : "super", "génial", "love", "merci", "bravo"
//   - mots négatifs : "bug", "problème", "marche pas", "trop lent", "deçu"
//   - mots questions : "?", "comment", "pourquoi", "where"
//   - défaut : neutre
//
// Format attendu (libre, mais bonus si frontmatter) :
//   ---
//   source: utilisateur | sponsor | sav
//   date: YYYY-MM-DD
//   author: Alice
//   intent: INTENT-101
//   ---
//   Texte libre du feedback…
//
// Aucun effet de bord. Pure lecture filesystem.
//
// Documentation : https://aiad.ovh

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from '../frontmatter.js';

const REPS = ['feedback', 'customer-feedback'];

const MOTS_POSITIFS = ['super', 'génial', 'genial', 'top', 'love', 'merci', 'bravo', 'awesome', 'great', 'parfait'];
const MOTS_NEGATIFS = ['bug', 'problème', 'probleme', 'broken', 'cassé', 'casse', 'marche pas', "doesn't work", 'trop lent', 'lent', 'déçu', 'decu', 'frustrant'];
const MOTS_QUESTIONS = ['comment', 'pourquoi', 'where', 'how', 'why', 'when'];

function lireRep(rep) {
  try { return readdirSync(rep); } catch { return []; }
}

export function classerSentiment(texte) {
  if (!texte || typeof texte !== 'string') return 'neutre';
  const t = texte.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const compteur = { positif: 0, negatif: 0, question: 0 };
  for (const m of MOTS_POSITIFS) if (t.includes(m.toLowerCase())) compteur.positif++;
  for (const m of MOTS_NEGATIFS) if (t.includes(m.toLowerCase())) compteur.negatif++;
  for (const m of MOTS_QUESTIONS) if (t.includes(m)) compteur.question++;
  if ((t.match(/\?/g) || []).length >= 1) compteur.question++;
  if (compteur.negatif > compteur.positif && compteur.negatif > 0) return 'negatif';
  if (compteur.positif > 0) return 'positif';
  if (compteur.question >= 2) return 'question';
  return 'neutre';
}

function lireFeedbackFichier(chemin, nom) {
  let contenu = '';
  let mtime = 0;
  try {
    contenu = readFileSync(chemin, 'utf8');
    mtime = statSync(chemin).mtimeMs;
  } catch { return null; }
  const { data, body } = parseFrontmatter(contenu);
  const sentiment = classerSentiment(body || contenu);
  // Date depuis frontmatter ou nom de fichier YYYY-MM-DD.
  let date = null;
  if (data?.date) {
    const t = Date.parse(String(data.date));
    if (!isNaN(t)) date = t;
  }
  if (date == null) {
    const m = nom.match(/(\d{4}-\d{2}-\d{2})/);
    if (m) {
      const t = Date.parse(m[1]);
      if (!isNaN(t)) date = t;
    }
  }
  if (date == null) date = mtime;
  return {
    fichier: nom,
    source: data?.source || null,
    author: data?.author || null,
    intent: data?.intent || null,
    date,
    sentiment,
    extrait: (body || contenu).trim().slice(0, 240),
  };
}

export function calculerCustomerFeedback(racineProjet) {
  const out = [];
  for (const dossier of REPS) {
    const rep = join(racineProjet || '.', '.aiad', dossier);
    for (const n of lireRep(rep)) {
      if (!n.endsWith('.md')) continue;
      const fb = lireFeedbackFichier(join(rep, n), n);
      if (fb) out.push({ ...fb, dossier });
    }
  }
  // Tri date desc (plus récent en tête).
  out.sort((a, b) => (b.date || 0) - (a.date || 0));
  const totaux = {
    total: out.length,
    positif: out.filter((i) => i.sentiment === 'positif').length,
    negatif: out.filter((i) => i.sentiment === 'negatif').length,
    question: out.filter((i) => i.sentiment === 'question').length,
    neutre: out.filter((i) => i.sentiment === 'neutre').length,
  };
  return { items: out, totaux };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const CF_CSS = `<style>
.cf-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:.5rem; margin:.5rem 0; }
.cf-stat { padding:.45rem; border-radius:.3rem; text-align:center; }
.cf-stat.lvl-positif { background:rgba(43,138,62,.07); border:1px solid rgba(43,138,62,.3); }
.cf-stat.lvl-negatif { background:rgba(201,42,42,.07); border:1px solid rgba(201,42,42,.3); }
.cf-stat.lvl-question { background:rgba(76,110,245,.07); border:1px solid rgba(76,110,245,.3); }
.cf-stat.lvl-neutre { background:rgba(127,127,127,.05); border:1px solid var(--border, #ccc); }
.cf-stat .cf-val { font-size:1.25rem; font-weight:700; }
.cf-stat .cf-label { font-size:.72rem; text-transform:uppercase; color:var(--muted, #777); }
.cf-card { padding:.55rem .65rem; margin:.3rem 0; border-radius:.3rem; background:rgba(127,127,127,.04); border-left:3px solid var(--border, #ccc); }
.cf-card.s-positif { border-left-color:#2b8a3e; background:rgba(43,138,62,.04); }
.cf-card.s-negatif { border-left-color:#c92a2a; background:rgba(201,42,42,.04); }
.cf-card.s-question { border-left-color:#4c6ef5; background:rgba(76,110,245,.04); }
.cf-meta { font-size:.74rem; color:var(--muted, #777); margin-bottom:.2rem; display:flex; gap:.4rem; flex-wrap:wrap; }
.cf-meta .cf-tag { padding:.05rem .3rem; background:rgba(127,127,127,.1); border-radius:.15rem; }
.cf-meta .cf-tag.s-positif { background:rgba(43,138,62,.15); color:#1c5a2a; }
.cf-meta .cf-tag.s-negatif { background:rgba(201,42,42,.15); color:#7a1717; }
.cf-meta .cf-tag.s-question { background:rgba(76,110,245,.15); color:#3a4cba; }
.cf-extrait { font-size:.85rem; white-space:pre-wrap; }
.cf-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
</style>`;

const ICONS = { positif: '👍', negatif: '👎', question: '❓', neutre: '·' };

function fmtDate(ts) { return ts ? new Date(ts).toLocaleDateString('fr-FR') : '—'; }

export function blocCustomerFeedback(donnees) {
  const c = donnees?.customerFeedback;
  if (!c) return '';
  if (c.items.length === 0) {
    return `${CF_CSS}<section>
      <h2>Inbox feedback utilisateur <span class="count">aucune entrée</span></h2>
      <div class="cf-empty">Crée <code>.aiad/feedback/YYYY-MM-DD-titre.md</code> pour capturer un retour utilisateur / sponsor. Bonus si frontmatter : <code>source/author/intent/date</code>. Le dashboard classifie ensuite le sentiment et déduplique.</div>
    </section>`;
  }
  const t = c.totaux;
  const grid = ['negatif', 'question', 'positif', 'neutre']
    .map((s) => `<div class="cf-stat lvl-${s}">
      <div class="cf-val">${t[s]}</div>
      <div class="cf-label">${ICONS[s]} ${escape(s)}</div>
    </div>`).join('');
  const rows = c.items.slice(0, 12).map((it) => {
    const sentimentTag = `<span class="cf-tag s-${escape(it.sentiment)}">${ICONS[it.sentiment]} ${escape(it.sentiment)}</span>`;
    const source = it.source ? `<span class="cf-tag">${escape(String(it.source))}</span>` : '';
    const author = it.author ? `<span class="cf-tag">${escape(String(it.author))}</span>` : '';
    const intent = it.intent ? `<span class="cf-tag">${escape(String(it.intent))}</span>` : '';
    return `<div class="cf-card s-${escape(it.sentiment)}">
      <div class="cf-meta">
        ${sentimentTag}
        ${source}${author}${intent}
        <span class="cf-tag">${escape(fmtDate(it.date))}</span>
        <span class="cf-tag">${escape(it.fichier)}</span>
      </div>
      <div class="cf-extrait">${escape(it.extrait)}</div>
    </div>`;
  }).join('');
  return `${CF_CSS}<section>
    <h2>Inbox feedback utilisateur <span class="count">${t.total} entrée(s) · ${t.negatif} négatif · ${t.question} question</span></h2>
    <p class="muted" style="font-size:.85rem">Surface les fichiers <code>.aiad/feedback/*.md</code> (et <code>customer-feedback/</code>) avec classification sentiment heuristique. Tri du plus récent au plus ancien. Bonus si frontmatter <code>source/author/intent</code>.</p>
    <div class="cf-grid">${grid}</div>
    <div>${rows}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  classerSentiment as classifySentiment,
  calculerCustomerFeedback as computeCustomerFeedback,
  blocCustomerFeedback as customerFeedbackSection,
};
