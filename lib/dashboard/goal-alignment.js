// AIAD SDD Mode — Dashboard : goal alignment Intent ↔ North Star (#526).
//
// Mesure pour chaque Intent un **score d'alignement** avec le North Star
// du PRD §2 via similarité Jaccard sur tokens normalisés (mots > 3
// chars, stopwords supprimés). Aide à identifier les Intents qui
// dérivent du North Star.
//
// Sources :
//   - donnees.northStar / donnees.goalTree.northStar
//   - Sinon parsing simple : §2 North Star / Product Goal du PRD
//   - Intent : concat sections POURQUOI + OBJECTIF
//
// Politique :
//   - Score 0.0-1.0 (Jaccard)
//   - aligne ≥ 0.15, partiel 0.05-0.15, isole < 0.05
//
// Pure transformation.

const STOPWORDS = new Set([
  'pour', 'avec', 'mais', 'sans', 'dans', 'cette', 'cette', 'cela', 'autre',
  'autres', 'tout', 'tous', 'tres', 'plus', 'moins', 'doit', 'doivent',
  'avoir', 'etre', 'etre', 'fait', 'faire', 'leur', 'leurs', 'sur', 'sous',
  'the', 'and', 'for', 'with', 'this', 'that', 'must', 'have', 'will', 'our',
  'utilisateur', 'user', 'product', 'produit',
]);

function tokens(s) {
  return (String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 3 && !STOPWORDS.has(t)));
}

function jaccard(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function classerScore(s) {
  if (s >= 0.15) return 'aligne';
  if (s >= 0.05) return 'partiel';
  return 'isole';
}

function lireNorthStar(donnees) {
  // 1. Cherche dans donnees.healthTimeline ou donnees.goalTree
  const direct = donnees?.goalTree?.northStar || donnees?.northStar;
  if (direct && typeof direct === 'string') return direct;
  if (direct && direct.texte) return direct.texte;
  // 2. Default : pas de north star
  return '';
}

function texteIntent(intent) {
  const sections = intent?.sections || {};
  const parts = [intent.titre || '', sections.pourquoi || '', sections.objectif || ''];
  return parts.filter(Boolean).join(' ');
}

export function calculerGoalAlignment(donnees) {
  const northStar = lireNorthStar(donnees);
  if (!northStar) {
    return { items: [], totaux: {}, northStar: null, message: 'North Star non détecté' };
  }
  const tokensNS = tokens(northStar);
  const items = [];
  for (const i of donnees?.intents || []) {
    if (['archived'].includes(i.statut)) continue;
    const texte = texteIntent(i);
    const tokensIntent = tokens(texte);
    const score = jaccard(tokensIntent, tokensNS);
    items.push({
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      statut: i.statut,
      score: Math.round(score * 1000) / 1000,
      etat: classerScore(score),
      tokensIntent: tokensIntent.length,
    });
  }
  items.sort((a, b) => b.score - a.score);
  const totaux = {
    total: items.length,
    aligne: items.filter((i) => i.etat === 'aligne').length,
    partiel: items.filter((i) => i.etat === 'partiel').length,
    isole: items.filter((i) => i.etat === 'isole').length,
    scoreMoyen: items.length === 0 ? 0 : Math.round(items.reduce((s, x) => s + x.score, 0) / items.length * 1000) / 1000,
  };
  return { items, totaux, northStar, tokensNorthStar: tokensNS.length, message: null };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const GA_CSS = `<style>
.ga-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:.4rem; margin:.4rem 0; }
.ga-stat { padding:.4rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.ga-stat .ga-val { font-size:1.2rem; font-weight:700; }
.ga-stat .ga-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.ga-stat.e-aligne { background:rgba(43,138,62,.07); border-color:rgba(43,138,62,.3); }
.ga-stat.e-partiel { background:rgba(232,89,12,.05); border-color:rgba(232,89,12,.3); }
.ga-stat.e-isole { background:rgba(201,42,42,.06); border-color:rgba(201,42,42,.3); }
.ga-ns { padding:.5rem .65rem; background:rgba(76,110,245,.05); border-left:3px solid #4c6ef5; border-radius:.25rem; font-size:.85rem; margin:.3rem 0; font-style:italic; }
.ga-row { padding:.3rem .45rem; margin:.15rem 0; font-size:.82rem; background:rgba(127,127,127,.04); border-radius:.22rem; display:flex; gap:.5rem; flex-wrap:wrap; align-items:baseline; }
.ga-row.r-aligne { border-left:3px solid #2b8a3e; }
.ga-row.r-partiel { border-left:3px solid #e8590c; }
.ga-row.r-isole { border-left:3px solid #c92a2a; background:rgba(201,42,42,.03); }
.ga-score { font-weight:600; padding:.05rem .35rem; border-radius:.2rem; font-size:.78rem; }
.ga-score.r-aligne { background:rgba(43,138,62,.15); color:#1c5a2a; }
.ga-score.r-partiel { background:rgba(232,89,12,.15); color:#7a3a08; }
.ga-score.r-isole { background:rgba(201,42,42,.15); color:#7a1717; }
.ga-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
</style>`;

export function blocGoalAlignment(donnees) {
  const g = donnees?.goalAlignment;
  if (!g) return '';
  if (g.message) {
    return `${GA_CSS}<section>
      <h2>Alignement Intent ↔ North Star <span class="count">${escape(g.message)}</span></h2>
      <div class="ga-empty">Ajoute une section <code>## 2. North Star / Product Goal</code> au PRD pour activer le score d'alignement (Jaccard sur tokens, seuil aligné ≥ 0.15).</div>
    </section>`;
  }
  if (g.items.length === 0) {
    return `${GA_CSS}<section>
      <h2>Alignement Intent ↔ North Star <span class="count">aucun Intent actif</span></h2>
    </section>`;
  }
  const t = g.totaux;
  const ns = (g.northStar || '').slice(0, 200);
  const grid = ['aligne', 'partiel', 'isole'].map((etat) => `<div class="ga-stat e-${etat}">
      <div class="ga-val">${t[etat]}</div>
      <div class="ga-label">${escape(etat)}</div>
    </div>`).join('');
  const rows = g.items.slice(0, 15).map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    return `<div class="ga-row r-${escape(it.etat)}">
      <span class="ga-score r-${escape(it.etat)}">${it.score.toFixed(3)}</span>
      <strong>${idCell}</strong>
      <span>${escape((it.titre || '').slice(0, 50))}</span>
      <span class="muted">[${escape(it.statut)}]</span>
    </div>`;
  }).join('');
  return `${GA_CSS}<section>
    <h2>Alignement Intent ↔ North Star <span class="count">${t.total} Intent(s) — score moyen ${t.scoreMoyen}</span></h2>
    <p class="muted" style="font-size:.85rem">Score d'alignement Jaccard (tokens normalisés > 3 chars, stopwords supprimés) entre chaque Intent (titre + POURQUOI + OBJECTIF) et le North Star du PRD §2. Seuils : aligné ≥ 0.15, partiel 0.05-0.15, isolé &lt; 0.05.</p>
    <div class="ga-ns">North Star : « ${escape(ns)}${g.northStar.length > 200 ? '…' : ''} »</div>
    <div class="ga-grid">${grid}</div>
    <div>${rows}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerGoalAlignment as computeGoalAlignment,
  blocGoalAlignment as goalAlignmentSection,
};
