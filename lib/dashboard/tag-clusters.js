// AIAD SDD Mode — Dashboard : tag clusters (Intent thematic clusters) (#514).
//
// `#449 tag-cloud` rend une cloud globale ; ce module va plus loin en
// **regroupant les Intents par paire de tags co-occurents** pour
// identifier les vrais thèmes produit ("paiement + sepa", "onboarding
// + mobile"). Aide au narratif stratégique.
//
// Algorithme :
//   - Pour chaque paire de tags présente sur ≥ 2 Intents, compte
//     l'effectif et capture les IDs concernés.
//   - Trie par effectif desc, top N (défaut 8).
//   - Filtre les paires triviales (tags identiques).
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

function lireTags(intent) {
  const v = intent?.tags || intent?.Tags || intent?.labels || intent?.Labels;
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x).toLowerCase().trim()).filter(Boolean);
  if (typeof v === 'string') {
    return v.split(/[,;]/).map((x) => x.toLowerCase().trim()).filter(Boolean);
  }
  return [];
}

export function calculerTagClusters(donnees, options = {}) {
  const maxClusters = options.maxClusters || 8;
  const seuilMin = options.seuilMin || 2;
  const intents = (donnees?.intents || []).filter((i) => !['archived'].includes(i.statut));
  const pairesCount = new Map();
  const pairesIntents = new Map();
  for (const i of intents) {
    const tags = [...new Set(lireTags(i))].sort();
    for (let a = 0; a < tags.length; a++) {
      for (let b = a + 1; b < tags.length; b++) {
        if (tags[a] === tags[b]) continue;
        const cle = `${tags[a]}|${tags[b]}`;
        pairesCount.set(cle, (pairesCount.get(cle) || 0) + 1);
        if (!pairesIntents.has(cle)) pairesIntents.set(cle, []);
        pairesIntents.get(cle).push({ id: i.id, titre: i.titre || '' });
      }
    }
  }
  const clusters = [...pairesCount.entries()]
    .filter(([_, n]) => n >= seuilMin)
    .map(([cle, n]) => {
      const [a, b] = cle.split('|');
      return {
        tags: [a, b],
        effectif: n,
        intents: pairesIntents.get(cle).slice(0, 5),
      };
    })
    .sort((x, y) => y.effectif - x.effectif)
    .slice(0, maxClusters);
  // Stats tag-level (tag → counts) pour contexte
  const tagsCount = new Map();
  for (const i of intents) {
    for (const t of lireTags(i)) tagsCount.set(t, (tagsCount.get(t) || 0) + 1);
  }
  const topTags = [...tagsCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));
  return {
    clusters,
    topTags,
    totaux: {
      intents: intents.length,
      tagsUniques: tagsCount.size,
      clusters: clusters.length,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const TC_CSS = `<style>
.tc-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:.5rem; margin:.5rem 0; }
.tc-cluster { padding:.55rem .7rem; border-radius:.35rem; background:rgba(127,127,127,.04); border-left:3px solid var(--accent, #4c6ef5); }
.tc-cluster h4 { font-size:.82rem; margin:.1rem 0 .2rem; display:flex; gap:.3rem; align-items:baseline; flex-wrap:wrap; }
.tc-tag { padding:.1rem .35rem; background:rgba(76,110,245,.1); color:#3a4cba; border-radius:.18rem; font-weight:500; font-size:.78rem; }
.tc-effectif { padding:.05rem .35rem; background:rgba(127,127,127,.1); border-radius:.18rem; font-size:.7rem; }
.tc-intents { list-style:none; padding:0; margin:.2rem 0 0; font-size:.78rem; }
.tc-intents li { margin:.1rem 0; }
.tc-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
.tc-toptags { display:flex; gap:.3rem; flex-wrap:wrap; margin:.4rem 0; }
.tc-toptag { padding:.15rem .45rem; background:rgba(127,127,127,.08); border-radius:.2rem; font-size:.75rem; }
</style>`;

export function blocTagClusters(donnees) {
  const t = donnees?.tagClusters;
  if (!t) return '';
  if (t.clusters.length === 0) {
    return `${TC_CSS}<section>
      <h2>Clusters thématiques (paires de tags) <span class="count">aucun cluster détecté</span></h2>
      <div class="tc-empty">Aucune paire de tags co-occurente sur ≥ 2 Intents. Enrichis le frontmatter <code>tags: [theme1, theme2, ...]</code> pour identifier les vrais thèmes produit.</div>
    </section>`;
  }
  const totaux = t.totaux;
  const topTagsBar = t.topTags.length > 0
    ? `<div class="tc-toptags">${t.topTags.map((tt) => `<span class="tc-toptag">${escape(tt.tag)} ×${tt.count}</span>`).join('')}</div>`
    : '';
  const cards = t.clusters.map((c) => {
    const intentsLi = c.intents.map((i) => `<li><code>${escape(i.id)}</code> ${escape((i.titre || '').slice(0, 50))}</li>`).join('');
    return `<div class="tc-cluster">
      <h4><span class="tc-tag">#${escape(c.tags[0])}</span> + <span class="tc-tag">#${escape(c.tags[1])}</span> <span class="tc-effectif">×${c.effectif}</span></h4>
      <ul class="tc-intents">${intentsLi}</ul>
    </div>`;
  }).join('');
  return `${TC_CSS}<section>
    <h2>Clusters thématiques (paires de tags) <span class="count">${totaux.clusters} cluster(s) · ${totaux.tagsUniques} tag(s) sur ${totaux.intents} Intent(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Regroupe les Intents par <strong>paires de tags co-occurents</strong> pour identifier les vrais thèmes produit (vs cloud globale du #449). Top 10 tags + clusters effectif ≥ 2.</p>
    ${topTagsBar}
    <div class="tc-grid">${cards}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerTagClusters as computeTagClusters,
  blocTagClusters as tagClustersSection,
};
