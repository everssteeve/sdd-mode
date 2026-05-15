// AIAD SDD Mode — Dashboard : registre des risques Intent (#439).
//
// Le PM doit voir un registre consolidé des risques rattachés à ses
// Intents : frontmatter explicite (`risks: [...]`, `risk_level:`) ET
// heuristique sur la section `## CONTRAINTES` (mots-clés réglementaires
// ou techniques qui constituent des risques produit identifiés).
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

// Mots-clés détectés comme risques dans le texte des CONTRAINTES. Listés
// en lowercase + normalisé NFD (sans accents).
export const MOTS_CLES_RISQUES = [
  // Réglementaire
  { mot: 'rgpd', niveau: 'high', categorie: 'Réglementaire' },
  { mot: 'cnil', niveau: 'high', categorie: 'Réglementaire' },
  { mot: 'ai act', niveau: 'high', categorie: 'Réglementaire' },
  { mot: 'rgaa', niveau: 'medium', categorie: 'Accessibilité' },
  { mot: 'wcag', niveau: 'medium', categorie: 'Accessibilité' },
  { mot: 'iso 27001', niveau: 'medium', categorie: 'Sécurité' },
  { mot: 'pci dss', niveau: 'high', categorie: 'Sécurité' },
  // Dépendances
  { mot: 'depend', niveau: 'medium', categorie: 'Dépendance' },
  { mot: 'dependance', niveau: 'medium', categorie: 'Dépendance' },
  { mot: 'fournisseur', niveau: 'medium', categorie: 'Dépendance' },
  { mot: 'tiers', niveau: 'low', categorie: 'Dépendance' },
  // Performance / SLO
  { mot: 'latence', niveau: 'low', categorie: 'Performance' },
  { mot: 'perf ', niveau: 'low', categorie: 'Performance' },
  // Budget / délai
  { mot: 'budget', niveau: 'medium', categorie: 'Ressources' },
  { mot: 'deadline', niveau: 'medium', categorie: 'Calendrier' },
];

const NIVEAU_RANK = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 };

function normaliser(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// Lit la liste explicite des risques depuis le frontmatter.
function risquesExplicites(intent) {
  const out = [];
  const candidats = [intent.risks, intent.Risks, intent.risque, intent.risques, intent.Risques, intent.concerns];
  for (const c of candidats) {
    if (c == null) continue;
    if (Array.isArray(c)) {
      for (const v of c) if (v) out.push({ texte: String(v).trim(), source: 'frontmatter' });
    } else if (typeof c === 'string' && c.trim() !== '') {
      for (const v of c.split(/[;|]|, /)) {
        const t = v.trim();
        if (t) out.push({ texte: t, source: 'frontmatter' });
      }
    }
  }
  return out;
}

function niveauExplicite(intent) {
  const raw = intent.risk_level || intent.riskLevel || intent.niveau_risque;
  if (raw == null) return null;
  const s = String(raw).toLowerCase().trim();
  return NIVEAU_RANK[s] !== undefined ? s : null;
}

// Détecte des risques via les mots-clés présents dans CONTRAINTES + body
// de l'Intent. Évite les doublons par mot-clé.
function risquesHeuristiques(intent) {
  const corpus = normaliser([
    intent.sections?.contraintes || '',
    intent.sections?.critereDrift || '',
  ].join(' '));
  if (!corpus) return [];
  const trouves = [];
  const dejaCategories = new Set();
  for (const m of MOTS_CLES_RISQUES) {
    if (corpus.includes(m.mot)) {
      const cle = `${m.categorie}:${m.niveau}`;
      if (dejaCategories.has(cle)) continue;
      dejaCategories.add(cle);
      trouves.push({
        texte: `${m.categorie} (mot-clé "${m.mot}")`,
        source: 'heuristique',
        niveau: m.niveau,
        categorie: m.categorie,
        motCle: m.mot,
      });
    }
  }
  return trouves;
}

export function calculerRisques(donnees) {
  const out = [];
  for (const i of donnees?.intents || []) {
    const niveauFront = niveauExplicite(i);
    const explicites = risquesExplicites(i).map((r) => ({ ...r, niveau: niveauFront || 'unknown' }));
    const heuristiques = risquesHeuristiques(i);
    const risques = [...explicites, ...heuristiques];
    if (risques.length === 0 && !niveauFront) continue;
    // Niveau global = pire des niveaux trouvés.
    const niveaux = risques.map((r) => r.niveau).concat(niveauFront ? [niveauFront] : []);
    const pireNiveau = niveaux.length > 0
      ? niveaux.reduce((acc, n) => (NIVEAU_RANK[n] < NIVEAU_RANK[acc] ? n : acc), 'unknown')
      : (niveauFront || 'unknown');
    out.push({
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      statut: i.statut,
      niveau: pireNiveau,
      risques,
      countExplicites: explicites.length,
      countHeuristiques: heuristiques.length,
    });
  }
  // Tri : pire niveau d'abord.
  out.sort((a, b) => NIVEAU_RANK[a.niveau] - NIVEAU_RANK[b.niveau]);
  const parNiveau = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
  for (const r of out) parNiveau[r.niveau]++;
  return {
    intents: out,
    totaux: {
      intentsAvecRisques: out.length,
      ...parNiveau,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

function badgeNiveau(niveau) {
  const map = {
    critical: { cls: 'badge-bad', label: 'CRITIQUE' },
    high: { cls: 'badge-bad', label: 'Élevé' },
    medium: { cls: 'badge-warn', label: 'Moyen' },
    low: { cls: 'badge-info', label: 'Faible' },
    unknown: { cls: 'badge-muted', label: '?' },
  };
  const v = map[niveau] || map.unknown;
  return `<span class="badge ${v.cls}">${escape(v.label)}</span>`;
}

const RISKS_CSS = `<style>
.risk-card { padding:.5rem .7rem; margin:.4rem 0; border:1px solid var(--border, #ddd); border-radius:.4rem; background:var(--card-bg, #fff); font-size:.85rem; }
.risk-card.niveau-critical, .risk-card.niveau-high { border-left:4px solid #c92a2a; background:rgba(201,42,42,.04); }
.risk-card.niveau-medium { border-left:4px solid #e8590c; background:rgba(232,89,12,.04); }
.risk-card.niveau-low { border-left:4px solid #fab005; }
.risk-card-head { display:flex; align-items:baseline; gap:.5rem; flex-wrap:wrap; }
.risk-list { display:flex; flex-wrap:wrap; gap:.3rem; margin-top:.3rem; }
.risk-chip { padding:.15rem .4rem; background:rgba(127,127,127,.07); border-radius:.2rem; font-size:.75rem; }
.risk-chip.source-frontmatter { background:rgba(76,110,245,.1); color:#3a4cba; }
.risk-chip.source-heuristique { background:rgba(232,89,12,.08); color:#a2410d; }
</style>`;

export function blocRisks(donnees) {
  const r = donnees?.risks;
  if (!r) return '';
  if (r.intents.length === 0) {
    return `<section>
      <h2>Registre des risques <span class="count">aucun risque détecté</span></h2>
      <p class="muted">Aucun frontmatter <code>risks:</code> / <code>risk_level:</code> et aucun mot-clé risque détecté dans les sections CONTRAINTES. Ajouter <code>risks: [RGPD, dépendance Stripe]</code> dans le frontmatter pour alimenter ce registre.</p>
    </section>`;
  }
  const cards = r.intents.slice(0, 12).map((i) => {
    const idCell = i.file ? lienSource(i.file, i.id) : `<code>${escape(i.id)}</code>`;
    const chips = i.risques.map((rsq) => {
      const cat = rsq.categorie ? `<strong>${escape(rsq.categorie)}</strong> · ` : '';
      return `<span class="risk-chip source-${escape(rsq.source)}" title="${escape(rsq.source)}">${cat}${escape(rsq.texte)}</span>`;
    }).join(' ');
    return `<div class="risk-card niveau-${escape(i.niveau)}">
      <div class="risk-card-head">
        ${badgeNiveau(i.niveau)}
        <strong>${idCell}</strong> — ${escape(i.titre)} <span class="muted">(${escape(i.statut || '?')})</span>
      </div>
      <div class="risk-list">${chips}</div>
    </div>`;
  }).join('');
  const t = r.totaux;
  return `${RISKS_CSS}<section>
    <h2>Registre des risques <span class="count">${t.intentsAvecRisques} Intent(s) — ${t.critical + t.high} élevé(s) · ${t.medium} moyen(s) · ${t.low} faible(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Combinaison du frontmatter <code>risks:</code> / <code>risk_level:</code> (explicite, badge bleu) et de l'heuristique sur la section CONTRAINTES (mots-clés RGPD/CNIL/sécurité/dépendance/…, badge orange).</p>
    ${cards}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerRisques as computeRisks,
  blocRisks as risksSection,
};
export { MOTS_CLES_RISQUES as RISK_KEYWORDS };
