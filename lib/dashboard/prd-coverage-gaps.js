// AIAD SDD Mode — Dashboard : PRD coverage gap finder (#535).
//
// Détecte les **trous de couverture** dans le PRD :
//   - Outcomes déclarés mais aucun Intent rattaché
//   - Personas déclarés mais aucun Intent ne les sert
//   - User Stories déclarées mais aucun Intent ne les couvre
//
// Sources : #423 prd-coverage (personas + outcomes + user-stories).
//
// Pure transformation.

function lireIntentsParCible(intents, champ) {
  const m = new Map();
  for (const i of intents || []) {
    const v = i?.[champ];
    if (!v) continue;
    if (Array.isArray(v)) {
      for (const x of v) {
        const cle = String(x).toLowerCase().trim();
        if (!m.has(cle)) m.set(cle, new Set());
        m.get(cle).add(i.id);
      }
    } else if (typeof v === 'string') {
      const cle = v.toLowerCase().trim();
      if (!m.has(cle)) m.set(cle, new Set());
      m.get(cle).add(i.id);
    }
  }
  return m;
}

export function calculerPrdCoverageGaps(donnees) {
  const intents = donnees?.intents || [];
  // Outcomes
  const outcomesDeclares = donnees?.prdCoverage?.outcomes || [];
  const outcomesSansIntent = outcomesDeclares
    .filter((o) => !o.intents || o.intents.length === 0)
    .map((o) => ({ titre: o.titre || o.label || '?', target: o.target || null }));
  // Personas
  const personasDeclares = donnees?.prdCoverage?.personas?.personas || [];
  const intentsParPersona = lireIntentsParCible(intents, 'personas');
  const personasSansIntent = personasDeclares
    .filter((p) => {
      const cle = (p.nom || '').toLowerCase().trim();
      return !intentsParPersona.has(cle) || intentsParPersona.get(cle).size === 0;
    })
    .map((p) => ({ nom: p.nom || '?', besoin: p.besoin || null }));
  // User stories
  const userStoriesDeclarees = donnees?.prdCoverage?.userStories || [];
  const intentsParUS = lireIntentsParCible(intents, 'user_stories');
  const intentsParUS2 = lireIntentsParCible(intents, 'userStories');
  const usSansIntent = userStoriesDeclarees
    .filter((us) => {
      const cle = (us.id || '').toLowerCase().trim();
      const ensemble1 = intentsParUS.get(cle);
      const ensemble2 = intentsParUS2.get(cle);
      return (!ensemble1 || ensemble1.size === 0) && (!ensemble2 || ensemble2.size === 0);
    })
    .map((us) => ({ id: us.id, libelle: us.libelle || us.titre || '' }));
  return {
    outcomesSansIntent,
    personasSansIntent,
    usSansIntent,
    totaux: {
      outcomesDeclares: outcomesDeclares.length,
      outcomesSansIntent: outcomesSansIntent.length,
      personasDeclares: personasDeclares.length,
      personasSansIntent: personasSansIntent.length,
      usDeclares: userStoriesDeclarees.length,
      usSansIntent: usSansIntent.length,
      total: outcomesSansIntent.length + personasSansIntent.length + usSansIntent.length,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const CG_CSS = `<style>
.cg-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:.4rem; margin:.4rem 0; }
.cg-stat { padding:.4rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.cg-stat .cg-val { font-size:1.2rem; font-weight:700; }
.cg-stat .cg-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.cg-stat.has-gap { background:rgba(232,89,12,.06); border-color:rgba(232,89,12,.3); }
.cg-buckets { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:.5rem; margin:.4rem 0; }
.cg-bucket { padding:.5rem .65rem; background:rgba(127,127,127,.04); border-radius:.35rem; border-left:3px solid #f5a623; }
.cg-bucket h4 { font-size:.85rem; margin:.05rem 0 .25rem; }
.cg-list { list-style:none; padding:0; margin:0; font-size:.78rem; }
.cg-list li { padding:.1rem 0; }
.cg-meta { font-size:.72rem; color:var(--muted, #777); }
.cg-clean { padding:.5rem .7rem; background:rgba(43,138,62,.06); border-left:3px solid #2b8a3e; border-radius:.25rem; font-size:.85rem; color:#1c5a2a; }
</style>`;

export function blocPrdCoverageGaps(donnees) {
  const g = donnees?.prdCoverageGaps;
  if (!g) return '';
  const t = g.totaux;
  if (t.outcomesDeclares + t.personasDeclares + t.usDeclares === 0) {
    return `${CG_CSS}<section>
      <h2>Trous de couverture PRD <span class="count">aucune cible déclarée</span></h2>
      <p class="muted" style="font-size:.85rem">Le PRD n'a pas encore d'outcomes / personas / user-stories déclarés. Lance <code>/sdd prd</code> pour les capturer.</p>
    </section>`;
  }
  if (t.total === 0) {
    return `${CG_CSS}<section>
      <h2>Trous de couverture PRD <span class="count">couverture complète</span></h2>
      <div class="cg-clean">✓ Tous les outcomes (${t.outcomesDeclares}), personas (${t.personasDeclares}) et user-stories (${t.usDeclares}) ont au moins 1 Intent rattaché. Couverture parfaite.</div>
    </section>`;
  }
  const grid = [
    `<div class="cg-stat ${t.outcomesSansIntent > 0 ? 'has-gap' : ''}"><div class="cg-val">${t.outcomesSansIntent}/${t.outcomesDeclares}</div><div class="cg-label">Outcomes sans Intent</div></div>`,
    `<div class="cg-stat ${t.personasSansIntent > 0 ? 'has-gap' : ''}"><div class="cg-val">${t.personasSansIntent}/${t.personasDeclares}</div><div class="cg-label">Personas sans Intent</div></div>`,
    `<div class="cg-stat ${t.usSansIntent > 0 ? 'has-gap' : ''}"><div class="cg-val">${t.usSansIntent}/${t.usDeclares}</div><div class="cg-label">US sans Intent</div></div>`,
  ].join('');
  function bucket(items, titre, render) {
    if (items.length === 0) return '';
    const li = items.slice(0, 8).map(render).join('');
    return `<div class="cg-bucket">
      <h4>${escape(titre)} <span class="count">${items.length}</span></h4>
      <ul class="cg-list">${li}</ul>
    </div>`;
  }
  const buckets = [
    bucket(g.outcomesSansIntent, 'Outcomes sans Intent', (o) => `<li><strong>${escape(o.titre)}</strong>${o.target ? ` <span class="cg-meta">cible ${escape(o.target)}</span>` : ''}</li>`),
    bucket(g.personasSansIntent, 'Personas sans Intent', (p) => `<li><strong>${escape(p.nom)}</strong>${p.besoin ? ` <span class="cg-meta">${escape(p.besoin.slice(0, 40))}</span>` : ''}</li>`),
    bucket(g.usSansIntent, 'User Stories sans Intent', (u) => `<li><code>${escape(u.id)}</code> ${escape((u.libelle || '').slice(0, 50))}</li>`),
  ].join('');
  return `${CG_CSS}<section>
    <h2>Trous de couverture PRD <span class="count">${t.total} gap(s) — sur ${t.outcomesDeclares + t.personasDeclares + t.usDeclares} cibles</span></h2>
    <p class="muted" style="font-size:.85rem">Détecte les cibles PRD (outcomes §4, personas §3, user-stories §6) sans Intent rattaché. Un trou de couverture signale soit un manque d'Intents, soit une cible PRD obsolète à archiver.</p>
    <div class="cg-grid">${grid}</div>
    <div class="cg-buckets">${buckets}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerPrdCoverageGaps as computePrdCoverageGaps,
  blocPrdCoverageGaps as prdCoverageGapsSection,
};
