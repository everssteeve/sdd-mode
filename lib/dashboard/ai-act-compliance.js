// AIAD SDD Mode — Dashboard : AI-Act compliance per Intent (#482).
//
// Pour chaque Intent, détecte s'il touche à un composant IA et le classe
// selon les 4 catégories de l'EU AI Act (Règlement 2024/1689) :
//   - "unacceptable" : pratiques interdites (manipulation, social scoring)
//   - "high"         : systèmes à risque élevé (Annexe III — recrutement,
//                       éducation, services essentiels, justice…)
//   - "limited"      : transparence obligatoire (chatbots, deepfakes,
//                       génération de contenu)
//   - "minimal"      : libre usage (filtres anti-spam, jeux IA)
//
// Sources :
//   (a) frontmatter explicite : `ai_risk: high` / `ai_act_category: ...`
//   (b) heuristique sur le corpus Intent : keywords IA → triggers
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const NIVEAU_AI = ['unacceptable', 'high', 'limited', 'minimal'];

// Keywords détectés (lowercase NFD-normalisés) → niveau implicite.
// Conservateur : on tag plutôt high/limited en doute pour pousser le PM
// à clarifier en frontmatter explicite.
const KEYWORDS_AI = [
  // unacceptable
  { mot: 'social scoring', niveau: 'unacceptable', categorie: 'Score social' },
  { mot: 'manipulation', niveau: 'unacceptable', categorie: 'Manipulation' },
  // high
  { mot: 'recrutement', niveau: 'high', categorie: 'Annexe III — RH/Emploi' },
  { mot: 'cv parsing', niveau: 'high', categorie: 'Annexe III — RH/Emploi' },
  { mot: 'credit scoring', niveau: 'high', categorie: 'Annexe III — Services essentiels' },
  { mot: 'biometric', niveau: 'high', categorie: 'Annexe III — Biométrie' },
  { mot: 'biometrie', niveau: 'high', categorie: 'Annexe III — Biométrie' },
  { mot: 'reconnaissance faciale', niveau: 'high', categorie: 'Annexe III — Biométrie' },
  { mot: 'predictive policing', niveau: 'high', categorie: 'Annexe III — Justice' },
  // limited
  { mot: 'chatbot', niveau: 'limited', categorie: 'Transparence — chatbot' },
  { mot: 'agent ia', niveau: 'limited', categorie: 'Transparence — agent' },
  { mot: 'llm', niveau: 'limited', categorie: 'Modèle de langage' },
  { mot: 'gpt', niveau: 'limited', categorie: 'Modèle de langage' },
  { mot: 'deepfake', niveau: 'limited', categorie: 'Contenu synthétique' },
  { mot: 'image generation', niveau: 'limited', categorie: 'Contenu synthétique' },
  { mot: 'generation contenu', niveau: 'limited', categorie: 'Contenu synthétique' },
  // minimal
  { mot: 'recommandation', niveau: 'minimal', categorie: 'Recommandation' },
  { mot: 'classification', niveau: 'minimal', categorie: 'Classification' },
  { mot: 'machine learning', niveau: 'minimal', categorie: 'ML générique' },
  { mot: 'ml model', niveau: 'minimal', categorie: 'ML générique' },
];

function normaliser(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function lireNiveauExplicite(intent) {
  const raw = intent?.ai_risk || intent?.aiRisk || intent?.ai_act_category || intent?.aiActCategory;
  if (raw == null) return null;
  const s = String(raw).toLowerCase().trim();
  return NIVEAU_AI.includes(s) ? s : null;
}

function pireNiveau(a, b) {
  const RANK = { unacceptable: 0, high: 1, limited: 2, minimal: 3 };
  if (a == null) return b;
  if (b == null) return a;
  return RANK[a] < RANK[b] ? a : b;
}

// Détecte un Intent IA + classe selon AI Act.
export function analyserIntentIa(intent) {
  const explicite = lireNiveauExplicite(intent);
  if (explicite) {
    return {
      isAi: true,
      niveau: explicite,
      source: 'frontmatter',
      keywords: [],
      categories: [],
    };
  }
  // Heuristique sur le corpus.
  const corpus = normaliser([
    intent.titre || '',
    intent.sections?.pourquoi || '',
    intent.sections?.objectif || '',
    intent.sections?.contraintes || '',
    intent.sections?.critereDrift || '',
  ].join(' '));
  const trouves = [];
  let niveau = null;
  const categories = new Set();
  for (const kw of KEYWORDS_AI) {
    if (corpus.includes(kw.mot)) {
      trouves.push(kw.mot);
      categories.add(kw.categorie);
      niveau = pireNiveau(niveau, kw.niveau);
    }
  }
  if (trouves.length === 0) return { isAi: false, niveau: null, source: null, keywords: [], categories: [] };
  return {
    isAi: true,
    niveau,
    source: 'heuristique',
    keywords: trouves.slice(0, 5),
    categories: [...categories].slice(0, 5),
  };
}

export function calculerAiActCompliance(donnees) {
  const items = [];
  for (const i of donnees?.intents || []) {
    const a = analyserIntentIa(i);
    if (!a.isAi) continue;
    items.push({
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      statut: i.statut,
      ...a,
    });
  }
  // Tri par niveau pire d'abord.
  const RANK = { unacceptable: 0, high: 1, limited: 2, minimal: 3 };
  items.sort((a, b) => (RANK[a.niveau] ?? 99) - (RANK[b.niveau] ?? 99));
  const totaux = {
    total: items.length,
    unacceptable: items.filter((i) => i.niveau === 'unacceptable').length,
    high: items.filter((i) => i.niveau === 'high').length,
    limited: items.filter((i) => i.niveau === 'limited').length,
    minimal: items.filter((i) => i.niveau === 'minimal').length,
    explicite: items.filter((i) => i.source === 'frontmatter').length,
    heuristique: items.filter((i) => i.source === 'heuristique').length,
  };
  return { items, totaux };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

function badgeNiveau(n) {
  const map = {
    unacceptable: { cls: 'badge-bad', label: 'INTERDIT — Acte non-conforme' },
    high: { cls: 'badge-bad', label: 'Risque élevé (Annexe III)' },
    limited: { cls: 'badge-warn', label: 'Transparence requise' },
    minimal: { cls: 'badge-info', label: 'Risque minimal' },
  };
  const v = map[n] || { cls: 'badge-muted', label: '?' };
  return `<span class="badge ${v.cls}">${escape(v.label)}</span>`;
}

const AIACT_CSS = `<style>
.aiact-card { padding:.5rem .7rem; margin:.4rem 0; border:1px solid var(--border, #ddd); border-radius:.4rem; background:var(--card-bg, #fff); font-size:.85rem; }
.aiact-card.niveau-unacceptable { border-left:4px solid #c92a2a; background:rgba(201,42,42,.06); }
.aiact-card.niveau-high { border-left:4px solid #c92a2a; background:rgba(201,42,42,.04); }
.aiact-card.niveau-limited { border-left:4px solid #e8590c; background:rgba(232,89,12,.04); }
.aiact-card.niveau-minimal { border-left:4px solid #4c6ef5; }
.aiact-head { display:flex; align-items:baseline; gap:.5rem; flex-wrap:wrap; }
.aiact-meta { margin:.3rem 0 0; display:flex; gap:.3rem; flex-wrap:wrap; }
.aiact-chip { padding:.15rem .4rem; background:rgba(127,127,127,.07); border-radius:.2rem; font-size:.72rem; }
.aiact-chip.source-frontmatter { background:rgba(76,110,245,.1); color:#3a4cba; }
.aiact-chip.source-heuristique { background:rgba(232,89,12,.08); color:#a2410d; }
.aiact-stats { display:flex; gap:.5rem; flex-wrap:wrap; margin:.3rem 0; font-size:.78rem; }
</style>`;

export function blocAiActCompliance(donnees) {
  const a = donnees?.aiActCompliance;
  if (!a) return '';
  if (a.items.length === 0) {
    return `<section>
      <h2>Conformité EU AI Act <span class="count">aucun Intent IA détecté</span></h2>
      <p class="muted" style="font-size:.85rem">Aucun Intent ne touche un composant IA selon l'heuristique (keywords : <code>chatbot/llm/gpt/biométrie/recrutement/credit scoring/recommandation/…</code>) ni n'a de frontmatter <code>ai_risk:</code>. Si un Intent touche l'IA, ajouter <code>ai_risk: high|limited|minimal</code> pour activer ce registre de conformité (Règlement UE 2024/1689).</p>
    </section>`;
  }
  const t = a.totaux;
  const stats = `<div class="aiact-stats">
    <span class="aiact-chip" style="background:rgba(201,42,42,.15); color:#7a1717">${t.unacceptable + t.high} risque élevé/interdit</span>
    <span class="aiact-chip" style="background:rgba(232,89,12,.12); color:#7a3a08">${t.limited} transparence</span>
    <span class="aiact-chip" style="background:rgba(76,110,245,.1); color:#3a4cba">${t.minimal} minimal</span>
    <span class="aiact-chip">${t.explicite} via frontmatter · ${t.heuristique} via heuristique</span>
  </div>`;
  const cards = a.items.slice(0, 12).map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    const cats = it.categories.length ? `<div class="aiact-meta">${it.categories.map((c) => `<span class="aiact-chip">${escape(c)}</span>`).join('')}<span class="aiact-chip source-${escape(it.source || 'heuristique')}">via ${escape(it.source || '?')}</span></div>` : '';
    return `<div class="aiact-card niveau-${escape(it.niveau || 'unknown')}">
      <div class="aiact-head">
        ${badgeNiveau(it.niveau)}
        <strong>${idCell}</strong> — ${escape(it.titre)}
        <span class="muted" style="font-size:.7rem">(${escape(it.statut || '?')})</span>
      </div>
      ${cats}
    </div>`;
  }).join('');
  const avertissement = (t.unacceptable + t.high) > 0
    ? '<p style="font-size:.85rem; color:#7a1717"><strong>⚠ Risque AI Act élevé/interdit détecté</strong> — solliciter le DPO et l\'agent gouvernance AIAD-AI-ACT avant tout dev. Documentation Annexe IV obligatoire avant mise sur le marché EU.</p>'
    : '';
  return `${AIACT_CSS}<section>
    <h2>Conformité EU AI Act <span class="count">${t.total} Intent(s) IA détecté(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Classification automatique selon le Règlement (UE) 2024/1689 — frontmatter explicite <code>ai_risk:</code> prime sur l'heuristique (keywords AI Act). Niveaux : interdit / élevé (Annexe III) / transparence requise / minimal.</p>
    ${stats}
    ${avertissement}
    ${cards}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  analyserIntentIa as analyseIntentAi,
  calculerAiActCompliance as computeAiActCompliance,
  blocAiActCompliance as aiActComplianceSection,
  KEYWORDS_AI as AI_KEYWORDS,
};
