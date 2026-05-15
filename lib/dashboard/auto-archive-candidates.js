// AIAD SDD Mode — Dashboard : auto-archive candidates suggestions (#541).
//
// Détecte les Intents éligibles à l'archivage :
//   - done depuis > 60j (résultat consolidé, archivable)
//   - draft depuis > 120j sans bascule (intention non-pursuée)
//   - active depuis > 365j sans SPEC livrée (zombie chronique)
//
// Pure transformation.

const DAY = 24 * 3600 * 1000;
const STATUTS_LIVRES = new Set(['done', 'archived']);

export function calculerAutoArchiveCandidates(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const specsParCourt = new Map();
  for (const s of donnees?.specs || []) {
    if (!s.parentIntent) continue;
    const court = String(s.parentIntent).split('-').slice(0, 2).join('-');
    if (!specsParCourt.has(court)) specsParCourt.set(court, []);
    specsParCourt.get(court).push(s);
  }
  const items = [];
  for (const i of donnees?.intents || []) {
    if (i.statut === 'archived') continue;
    if (!i.mtime) continue;
    const age = Math.floor((now - i.mtime) / DAY);
    const court = i.id.split('-').slice(0, 2).join('-');
    const specs = specsParCourt.get(court) || [];
    let raison = null, motif = null;
    if (i.statut === 'done' && age > 60) {
      raison = 'done-vieux';
      motif = `Done depuis ${age}j — archivable`;
    } else if (i.statut === 'draft' && age > 120) {
      raison = 'draft-abandonne';
      motif = `Draft depuis ${age}j sans bascule — intention non-pursuivie`;
    } else if (i.statut === 'active' && age > 365 && !specs.some((s) => STATUTS_LIVRES.has(s.statut))) {
      raison = 'zombie-chronique';
      motif = `Active depuis ${age}j sans SPEC livrée — zombie chronique`;
    }
    if (raison) {
      items.push({
        id: i.id,
        titre: i.titre || '',
        file: i.file || null,
        statut: i.statut,
        age,
        raison,
        motif,
      });
    }
  }
  items.sort((a, b) => b.age - a.age);
  const totaux = {
    total: items.length,
    doneVieux: items.filter((i) => i.raison === 'done-vieux').length,
    draftAbandonne: items.filter((i) => i.raison === 'draft-abandonne').length,
    zombieChronique: items.filter((i) => i.raison === 'zombie-chronique').length,
  };
  return { items, totaux };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const AA_CSS = `<style>
.aa-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:.4rem; margin:.4rem 0; }
.aa-stat { padding:.4rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.aa-stat .aa-val { font-size:1.2rem; font-weight:700; }
.aa-stat .aa-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.aa-stat.r-done-vieux { background:rgba(76,110,245,.05); border-color:rgba(76,110,245,.3); }
.aa-stat.r-draft-abandonne { background:rgba(232,89,12,.05); border-color:rgba(232,89,12,.3); }
.aa-stat.r-zombie-chronique { background:rgba(201,42,42,.06); border-color:rgba(201,42,42,.3); }
.aa-row { padding:.4rem .55rem; margin:.2rem 0; border-radius:.3rem; background:rgba(127,127,127,.04); font-size:.82rem; }
.aa-row.r-done-vieux { border-left:3px solid #4c6ef5; }
.aa-row.r-draft-abandonne { border-left:3px solid #e8590c; }
.aa-row.r-zombie-chronique { border-left:3px solid #c92a2a; background:rgba(201,42,42,.04); }
.aa-head { display:flex; gap:.4rem; align-items:baseline; flex-wrap:wrap; }
.aa-motif { font-size:.72rem; color:var(--muted, #777); margin-top:.2rem; }
.aa-empty { padding:.5rem .7rem; background:rgba(43,138,62,.06); border-left:3px solid #2b8a3e; border-radius:.25rem; font-size:.85rem; color:#1c5a2a; }
</style>`;

export function blocAutoArchiveCandidates(donnees) {
  const a = donnees?.autoArchiveCandidates;
  if (!a) return '';
  if (a.items.length === 0) {
    return `${AA_CSS}<section>
      <h2>Candidats archivage <span class="count">aucun candidat</span></h2>
      <div class="aa-empty">✓ Aucun Intent éligible à l'archivage automatique. Backlog propre : pas de done > 60j, draft > 120j, ou zombie chronique > 365j sans livraison.</div>
    </section>`;
  }
  const t = a.totaux;
  const grid = [
    `<div class="aa-stat r-done-vieux"><div class="aa-val">${t.doneVieux}</div><div class="aa-label">Done &gt; 60j</div></div>`,
    `<div class="aa-stat r-draft-abandonne"><div class="aa-val">${t.draftAbandonne}</div><div class="aa-label">Draft &gt; 120j</div></div>`,
    `<div class="aa-stat r-zombie-chronique"><div class="aa-val">${t.zombieChronique}</div><div class="aa-label">Zombie chronique</div></div>`,
  ].join('');
  const rows = a.items.slice(0, 15).map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    return `<div class="aa-row r-${escape(it.raison)}">
      <div class="aa-head">
        <strong>${idCell}</strong>
        <span>${escape((it.titre || '').slice(0, 60))}</span>
        <span class="muted">[${escape(it.statut)}]</span>
      </div>
      <div class="aa-motif">→ ${escape(it.motif)}</div>
    </div>`;
  }).join('');
  return `${AA_CSS}<section>
    <h2>Candidats archivage <span class="count">${t.total} Intent(s) suggéré(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Détecte Intents éligibles à <code>statut: archived</code> : done &gt; 60j (résultat consolidé), draft &gt; 120j (non-pursuivi), active &gt; 365j sans SPEC livrée (zombie chronique). Archiver libère le cockpit.</p>
    <div class="aa-grid">${grid}</div>
    <div>${rows}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerAutoArchiveCandidates as computeAutoArchiveCandidates,
  blocAutoArchiveCandidates as autoArchiveCandidatesSection,
};
