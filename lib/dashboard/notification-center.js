// AIAD SDD Mode — Dashboard : centre de notification PM (#483).
//
// pm.html cumule désormais 54 sections — un PM scrolle pour identifier
// les signaux urgents disséminés. Ce module agrège les signaux les plus
// critiques en UNE pile triée en haut de la page :
//
//   1. Intents en retard sur target_date (#440 deadlines)
//   2. Risques niveau critical/high (#439 risks)
//   3. Pratiques AI Act unacceptable/high (#482 ai-act-compliance)
//   4. Intents zombies > 30j (#137 pm)
//   5. Intents abandonnés > 60j (#471 backlog-freshness)
//   6. Drafts vieux > 14j (#137 pm)
//
// Chaque entrée renvoie un objet `{ niveau, libelle, count, anchor }`.
// `niveau` ∈ {`critique`, `eleve`, `attention`}.
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const RANK = { critique: 0, eleve: 1, attention: 2 };

function compter(arr) { return Array.isArray(arr) ? arr.length : 0; }

export function calculerNotifications(donnees) {
  const items = [];
  const pm = donnees?.pm || {};
  const dl = donnees?.deadlines?.totaux || {};
  const risques = (donnees?.risks?.intents || []).filter((r) => r.niveau === 'critical' || r.niveau === 'high');
  const aiAct = donnees?.aiActCompliance?.totaux || {};
  const abandons = (donnees?.backlogFreshness?.items || []).filter((it) => it.bande === 'abandonne');

  if (dl.retard > 0) items.push({
    niveau: 'critique',
    libelle: `${dl.retard} Intent(s) en retard sur target_date`,
    detail: 'Échéance dépassée — replanifier ou descoper.',
    count: dl.retard,
    anchor: '#echeances-intent',
  });

  if (risques.length > 0) items.push({
    niveau: 'critique',
    libelle: `${risques.length} Intent(s) à risque critical/high`,
    detail: 'Risques structurants identifiés — challenger en revue.',
    count: risques.length,
    anchor: '#risques',
  });

  if ((aiAct.unacceptable || 0) + (aiAct.high || 0) > 0) items.push({
    niveau: 'critique',
    libelle: `${(aiAct.unacceptable || 0) + (aiAct.high || 0)} Intent(s) IA risque élevé/interdit (AI Act)`,
    detail: 'Solliciter le DPO + AGENT-GUIDE AIAD-AI-ACT avant tout dev.',
    count: (aiAct.unacceptable || 0) + (aiAct.high || 0),
    anchor: '#conformite-eu-ai-act',
  });

  if (compter(pm.zombies) > 0) items.push({
    niveau: 'eleve',
    libelle: `${pm.zombies.length} Intent(s) zombie(s) (active > 30j sans SPEC remuée)`,
    detail: 'Décider : relancer une SPEC, descoper ou archiver.',
    count: pm.zombies.length,
    anchor: '#a-valider-cette-semaine',
  });

  if (abandons.length > 0) items.push({
    niveau: 'eleve',
    libelle: `${abandons.length} item(s) abandonné(s) > 60j`,
    detail: 'Backlog non touché — rafraîchir ou archiver.',
    count: abandons.length,
    anchor: '#fraicheur-du-backlog',
  });

  if (compter(pm.draftsAnciens) > 0) items.push({
    niveau: 'attention',
    libelle: `${pm.draftsAnciens.length} draft(s) ancien(s) > 14j`,
    detail: 'Capturer une décision : promouvoir en active, descoper ou archiver.',
    count: pm.draftsAnciens.length,
    anchor: '#a-valider-cette-semaine',
  });

  items.sort((a, b) => (RANK[a.niveau] ?? 99) - (RANK[b.niveau] ?? 99));
  return {
    items,
    total: items.length,
    parNiveau: {
      critique: items.filter((i) => i.niveau === 'critique').length,
      eleve: items.filter((i) => i.niveau === 'eleve').length,
      attention: items.filter((i) => i.niveau === 'attention').length,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const NC_CSS = `<style>
.nc-stack { display:grid; gap:.4rem; margin:.5rem 0; }
.nc-card { padding:.55rem .7rem; border-radius:.35rem; background:rgba(127,127,127,.04); border:1px solid var(--border, #ddd); display:flex; align-items:center; gap:.6rem; }
.nc-card.lvl-critique { border-left:4px solid #c92a2a; background:rgba(201,42,42,.06); }
.nc-card.lvl-eleve { border-left:4px solid #e8590c; background:rgba(232,89,12,.04); }
.nc-card.lvl-attention { border-left:4px solid #f5a623; }
.nc-icon { font-size:1.1rem; line-height:1; }
.nc-text { flex:1; min-width:0; }
.nc-libelle { font-weight:500; font-size:.88rem; }
.nc-detail { font-size:.76rem; color:var(--muted, #777); margin-top:.1rem; }
.nc-cta { padding:.2rem .55rem; background:transparent; border:1px solid currentColor; border-radius:.2rem; color:inherit; font-size:.75rem; text-decoration:none; opacity:.85; }
.nc-cta:hover { opacity:1; }
.nc-empty { padding:.6rem .8rem; background:rgba(43,138,62,.07); border-left:3px solid #2b8a3e; border-radius:.25rem; font-size:.88rem; color:#1c5a2a; }
@media (prefers-color-scheme: dark) {
  .nc-empty { color:#69c98a; background:rgba(43,138,62,.12); }
}
</style>`;

const ICONES = { critique: '🔴', eleve: '🟠', attention: '🟡' };

export function blocNotificationCenter(donnees) {
  const n = donnees?.notifications;
  if (!n) return '';
  if (n.items.length === 0) {
    return `${NC_CSS}<section>
      <h2>Centre de notifications <span class="count">✓ aucun signal urgent</span></h2>
      <div class="nc-empty">PM zen : aucun retard, zombie, risque élevé, abandon ou AI Act sensible détecté. Profite — c'est rare.</div>
    </section>`;
  }
  const par = n.parNiveau;
  const stats = [
    par.critique > 0 ? `<span class="badge bad">${par.critique} critique(s)</span>` : '',
    par.eleve > 0 ? `<span class="badge warn">${par.eleve} élevé(s)</span>` : '',
    par.attention > 0 ? `<span class="badge muted">${par.attention} attention</span>` : '',
  ].filter(Boolean).join(' ');
  const cards = n.items.map((it) => `<div class="nc-card lvl-${escape(it.niveau)}">
      <span class="nc-icon" aria-hidden="true">${ICONES[it.niveau] || '•'}</span>
      <div class="nc-text">
        <div class="nc-libelle">${escape(it.libelle)}</div>
        <div class="nc-detail">${escape(it.detail)}</div>
      </div>
      <a class="nc-cta" href="${escape(it.anchor)}">Voir →</a>
    </div>`).join('');
  return `${NC_CSS}<section>
    <h2>Centre de notifications <span class="count">${n.items.length} signal(aux) à traiter</span></h2>
    <p class="muted" style="font-size:.85rem">Pile triée par criticité : retard target_date / risques critical-high / AI Act élevé-interdit en tête, puis zombies / abandons / drafts vieux. Chaque carte renvoie vers la section dédiée pour le détail.</p>
    <p style="margin:.3rem 0">${stats}</p>
    <div class="nc-stack">${cards}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerNotifications as computeNotifications,
  blocNotificationCenter as notificationCenterSection,
};
