// AIAD SDD Mode — Dashboard : outcome attribution rollup (#492).
//
// Pour chaque outcome déclaré dans le PRD (#428 prdCoverage.outcomes),
// liste les **SPECs livrées** (statut done/archived) qui ont contribué
// — via leur Intent parent rattaché à cet outcome. Mesure la
// contribution réelle au plan PRD.
//
// Sources :
//   - `donnees.prdCoverage.outcomes` : { titre, intents: [{ id }] }
//   - `donnees.specs` : SPECs livrées avec parentIntent
//
// Politique :
//   - SPECs `done` ou `archived` uniquement comptent
//   - Matching court (INTENT-NNN) ↔ parentIntent SPEC
//   - Ratio livraison par outcome : SPECs livrées / SPECs totales liées
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const STATUTS_LIVRES = new Set(['done', 'archived']);

function indexerSpecsParCourt(specs) {
  const m = new Map();
  for (const s of specs || []) {
    if (!s.parentIntent) continue;
    const court = String(s.parentIntent).split('-').slice(0, 2).join('-');
    if (!m.has(court)) m.set(court, []);
    m.get(court).push(s);
  }
  return m;
}

export function calculerOutcomeAttribution(donnees) {
  const outcomes = donnees?.prdCoverage?.outcomes || [];
  const specsParCourt = indexerSpecsParCourt(donnees?.specs);
  const items = outcomes.map((o) => {
    const intentsRattaches = (o.intents || []);
    let livrees = 0;
    let total = 0;
    const specsAttribues = [];
    for (const i of intentsRattaches) {
      const court = String(i.id || '').split('-').slice(0, 2).join('-');
      const specs = specsParCourt.get(court) || [];
      total += specs.length;
      for (const s of specs) {
        if (STATUTS_LIVRES.has(s.statut)) {
          livrees++;
          specsAttribues.push({
            id: s.id,
            statut: s.statut,
            parentIntent: court,
            mtime: s.mtime,
          });
        }
      }
    }
    const ratio = total === 0 ? null : Math.round((livrees / total) * 100) / 100;
    return {
      titre: o.titre || o.label || '?',
      target: o.target || null,
      nbIntents: intentsRattaches.length,
      specsLivrees: livrees,
      specsTotal: total,
      ratio,
      specsAttribues,
    };
  });
  // Tri : outcomes avec le plus de contribution livrée d'abord.
  items.sort((a, b) => b.specsLivrees - a.specsLivrees);
  const totaux = {
    outcomes: items.length,
    avecContribution: items.filter((i) => i.specsLivrees > 0).length,
    sansContribution: items.filter((i) => i.specsLivrees === 0).length,
    totalSpecsLivrees: items.reduce((s, i) => s + i.specsLivrees, 0),
  };
  return { items, totaux };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const OA_CSS = `<style>
.oa-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:.5rem; margin:.5rem 0; }
.oa-stat { padding:.5rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.oa-stat .oa-val { font-size:1.25rem; font-weight:700; }
.oa-stat .oa-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.oa-card { padding:.6rem .7rem; margin:.4rem 0; border-radius:.3rem; background:var(--card-bg, rgba(127,127,127,.04)); border-left:3px solid var(--border, #ccc); }
.oa-card.has-contrib { border-left-color:#2b8a3e; background:rgba(43,138,62,.04); }
.oa-card.zero-contrib { opacity:.85; }
.oa-head { display:flex; gap:.5rem; align-items:baseline; flex-wrap:wrap; }
.oa-titre { font-weight:600; flex:1; min-width:0; }
.oa-ratio { font-size:.8rem; padding:.15rem .4rem; border-radius:.2rem; background:rgba(127,127,127,.1); }
.oa-ratio.r-strong { background:rgba(43,138,62,.15); color:#1c5a2a; font-weight:500; }
.oa-ratio.r-weak { background:rgba(232,89,12,.12); color:#7a3a08; }
.oa-meta { font-size:.78rem; color:var(--muted, #777); margin-top:.25rem; }
.oa-specs { font-size:.75rem; margin-top:.3rem; }
.oa-spec-chip { display:inline-block; padding:.1rem .35rem; margin:.05rem .1rem .05rem 0; background:rgba(43,138,62,.1); border-radius:.18rem; color:#1c5a2a; }
</style>`;

export function blocOutcomeAttribution(donnees) {
  const a = donnees?.outcomeAttribution;
  if (!a) return '';
  if (a.items.length === 0) {
    return `${OA_CSS}<section>
      <h2>Attribution outcomes <span class="count">aucun outcome déclaré dans le PRD</span></h2>
      <p class="muted" style="font-size:.85rem">Le module croise les outcomes du PRD (#428) avec les SPECs livrées via leur Intent parent. Ajoute une section <code>## Outcome Criteria</code> au PRD pour mesurer la contribution livrée par outcome.</p>
    </section>`;
  }
  const t = a.totaux;
  const grid = [
    `<div class="oa-stat"><div class="oa-val">${t.outcomes}</div><div class="oa-label">Outcomes PRD</div></div>`,
    `<div class="oa-stat"><div class="oa-val" style="color:#2b8a3e">${t.avecContribution}</div><div class="oa-label">Avec contribution</div></div>`,
    `<div class="oa-stat"><div class="oa-val" style="color:#c92a2a">${t.sansContribution}</div><div class="oa-label">Sans contribution</div></div>`,
    `<div class="oa-stat"><div class="oa-val">${t.totalSpecsLivrees}</div><div class="oa-label">SPECs livrées total</div></div>`,
  ].join('');
  const cards = a.items.slice(0, 15).map((it) => {
    const has = it.specsLivrees > 0;
    const ratioPct = it.ratio != null ? Math.round(it.ratio * 100) : null;
    const ratioCls = ratioPct == null ? '' : ratioPct >= 60 ? 'r-strong' : ratioPct >= 1 ? '' : 'r-weak';
    const ratioTxt = it.specsTotal > 0 ? `${it.specsLivrees}/${it.specsTotal} (${ratioPct}%)` : 'pas de SPEC liée';
    const specs = it.specsAttribues.slice(0, 8).map((s) => `<span class="oa-spec-chip">${escape(s.id)}</span>`).join('');
    return `<div class="oa-card ${has ? 'has-contrib' : 'zero-contrib'}">
      <div class="oa-head">
        <div class="oa-titre">${escape(it.titre)}</div>
        <span class="oa-ratio ${ratioCls}">${escape(ratioTxt)}</span>
      </div>
      <div class="oa-meta">${it.nbIntents} Intent(s) rattaché(s)${it.target ? ' · cible ' + escape(it.target) : ''}</div>
      ${specs ? `<div class="oa-specs">${specs}</div>` : ''}
    </div>`;
  }).join('');
  return `${OA_CSS}<section>
    <h2>Attribution outcomes <span class="count">${t.outcomes} outcome(s) — ${t.totalSpecsLivrees} SPEC(s) livrée(s) contributrice(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Pour chaque outcome PRD (#428), liste les SPECs <strong>livrées</strong> (done/archived) qui contribuent via leur Intent parent. Mesure la contribution réelle au plan PRD — un outcome à 0 contribution est soit prématuré, soit en danger.</p>
    <div class="oa-grid">${grid}</div>
    ${cards}
  </section>`;
}

// ─── Matrice outcomes ↔ Intents ──────────────────────────────────────────────

function normaliserTitre(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/**
 * @intent INTENT-018
 * @spec SPEC-018-1-matrice-outcomes-intents
 */
export function calculerMatriceOutcomesIntents(donnees) {
  const intents = donnees?.intents || [];
  const attribution = donnees?.outcomeAttribution;
  if (!attribution || attribution.items.length === 0) return [];

  // Index inverse : titre normalisé → Intent[]
  const intentParOutcome = new Map();
  for (const intent of intents) {
    const refs = [].concat(intent.outcomes || intent.outcome || []);
    for (const ref of refs) {
      const key = normaliserTitre(ref);
      if (!key) continue;
      if (!intentParOutcome.has(key)) intentParOutcome.set(key, []);
      intentParOutcome.get(key).push(intent);
    }
  }

  return attribution.items.map((item) => {
    const key = normaliserTitre(item.titre);
    const contributeurs = intentParOutcome.get(key) || [];
    if (key && intentParOutcome.has(key) === false && contributeurs.length === 0) {
      // Aucune correspondance après normalisation — pas d'erreur, log indicatif
    }
    return {
      outcomeTitre: item.titre,
      ratio: item.ratio,
      specsLivrees: item.specsLivrees,
      specsTotal: item.specsTotal,
      intentsContributeurs: contributeurs.map((i) => ({
        id: i.id,
        titre: i.titre || i.id,
        statut: i.statut || 'unknown',
      })),
      intentsActifs: contributeurs.filter((i) => {
        const s = i.statut || '';
        return s === 'active' || s === 'in-progress';
      }).length,
      intentsTermines: contributeurs.filter((i) => (i.statut || '') === 'done').length,
    };
  });
}

export function blocMatriceOutcomesIntents(donnees) {
  const items = donnees?.matriceOutcomesIntents;
  if (!items || items.length === 0) {
    return `<section>
      <h2>Matrice outcomes ↔ Intents</h2>
      <p class="muted" style="font-size:.85rem">Aucun outcome défini dans PRD.md.</p>
    </section>`;
  }
  const rows = items.map((it) => {
    const ratioPct = it.ratio != null ? Math.round(it.ratio * 100) : null;
    const ratioTxt = ratioPct != null ? `${it.specsLivrees}/${it.specsTotal} (${ratioPct}%)` : '—';
    const contribs = it.intentsContributeurs.length > 0
      ? it.intentsContributeurs.map((i) => `<span class="oa-spec-chip">${escape(i.id)}</span>`).join('')
      : '<span class="muted" aria-label="aucun Intent déclaré">—</span>';
    return `<tr>
      <td><strong>${escape(it.outcomeTitre)}</strong></td>
      <td>${escape(ratioTxt)}</td>
      <td>${contribs}</td>
      <td>${escape(String(it.intentsActifs))}</td>
      <td>${escape(String(it.intentsTermines))}</td>
    </tr>`;
  }).join('');
  return `<section>
    <h2>Matrice outcomes ↔ Intents <span class="count">${items.length}</span></h2>
    <p class="muted" style="font-size:.85rem">Lien outcomes PRD ↔ Intents contributeurs via frontmatter <code>outcomes:</code>.</p>
    <table>
      <caption>Matrice des outcomes PRD et des Intents contributeurs</caption>
      <thead>
        <tr>
          <th scope="col">Outcome</th>
          <th scope="col">Livraison</th>
          <th scope="col">Intents contributeurs</th>
          <th scope="col">Actifs</th>
          <th scope="col">Terminés</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerOutcomeAttribution as computeOutcomeAttribution,
  blocOutcomeAttribution as outcomeAttributionSection,
  calculerMatriceOutcomesIntents as computeOutcomesIntentsMatrix,
  blocMatriceOutcomesIntents as outcomesIntentsMatrixSection,
};
