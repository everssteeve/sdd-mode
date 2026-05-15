// AIAD SDD Mode — Dashboard : ownership / "Mes Intents" (#435).
//
// Lit le frontmatter `owner:` / `pm:` / `assignee:` des Intents pour
// permettre au PM de voir « qu'est-ce que je porte personnellement ? ».
// Construit une map `owner → [intents]` + rend un portefeuille par owner
// sur pm.html.
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

function lireOwners(intent) {
  if (!intent) return [];
  const candidats = [
    intent.owner, intent.Owner, intent.owners, intent.Owners,
    intent.pm, intent.PM, intent.assignee, intent.assignees, intent.responsable,
  ];
  const out = new Set();
  for (const c of candidats) {
    if (c == null) continue;
    if (Array.isArray(c)) {
      for (const v of c) if (v) out.add(String(v).trim());
    } else if (typeof c === 'string' && c.trim() !== '') {
      // Permet `owner: alice, bob` ou `owner: alice`
      for (const v of c.split(/[,;]/)) {
        const s = v.trim();
        if (s) out.add(s);
      }
    }
  }
  return [...out];
}

const STATUTS_LIVRES = new Set(['done', 'archived']);

// Construit la map owner → portefeuille. Un Intent sans owner explicite
// rejoint le bucket virtuel "_unassigned" (rendu si non-vide).
export function calculerOwnership(donnees) {
  const intents = donnees?.intents || [];
  const par = new Map();
  for (const i of intents) {
    const owners = lireOwners(i);
    if (owners.length === 0) {
      ajouter(par, '_unassigned', i);
    } else {
      for (const o of owners) ajouter(par, o, i);
    }
  }
  // Calcule stats par owner
  const owners = [];
  for (const [nom, intentsOfOwner] of par) {
    const actifs = intentsOfOwner.filter((i) => !STATUTS_LIVRES.has(i.statut)).length;
    const livres = intentsOfOwner.filter((i) => STATUTS_LIVRES.has(i.statut)).length;
    owners.push({
      nom,
      intents: intentsOfOwner.map((i) => ({
        id: i.id,
        titre: i.titre || '',
        statut: i.statut,
        file: i.file || null,
      })),
      totaux: { total: intentsOfOwner.length, actifs, livres },
    });
  }
  // Tri : owners "réels" d'abord (total desc), puis _unassigned en queue.
  owners.sort((a, b) => {
    if (a.nom === '_unassigned') return 1;
    if (b.nom === '_unassigned') return -1;
    return b.totaux.total - a.totaux.total;
  });
  return {
    owners,
    totaux: {
      ownersReels: owners.filter((o) => o.nom !== '_unassigned').length,
      sansOwner: owners.find((o) => o.nom === '_unassigned')?.totaux.total || 0,
    },
  };
}

function ajouter(map, cle, intent) {
  if (!map.has(cle)) map.set(cle, []);
  map.get(cle).push(intent);
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const OWNERSHIP_CSS = `<style>
.owner-card { padding:.55rem .75rem; margin:.4rem 0; border:1px solid var(--border, #ddd); border-radius:.4rem; background:var(--card-bg, #fff); font-size:.85rem; }
.owner-card.unassigned { border-left:4px solid #e8590c; background:rgba(232,89,12,.04); }
.owner-card-head { display:flex; align-items:baseline; gap:.5rem; flex-wrap:wrap; }
.owner-card-head strong { font-size:.95rem; }
.owner-intents { display:flex; flex-wrap:wrap; gap:.35rem; margin-top:.3rem; }
.owner-intent-chip { padding:.15rem .4rem; background:rgba(127,127,127,.06); border-radius:.2rem; font-size:.75rem; }
.owner-intent-chip.statut-done, .owner-intent-chip.statut-archived { opacity:.55; }
</style>`;

function chipIntent(i) {
  const idCell = i.file ? lienSource(i.file, i.id) : `<code>${escape(i.id)}</code>`;
  return `<span class="owner-intent-chip statut-${escape(i.statut || 'unknown')}" title="${escape(i.titre)} (${escape(i.statut || '?')})">${idCell}</span>`;
}

export function blocOwnership(donnees) {
  const o = donnees?.ownership;
  if (!o || o.owners.length === 0) return '';
  const cards = o.owners.map((own) => {
    const cls = own.nom === '_unassigned' ? 'unassigned' : '';
    const label = own.nom === '_unassigned' ? 'Sans owner' : own.nom;
    const chips = own.intents.map(chipIntent).join(' ');
    return `<div class="owner-card ${cls}">
      <div class="owner-card-head">
        <strong>${escape(label)}</strong>
        <span class="muted">${own.totaux.total} Intent(s) · ${own.totaux.actifs} actif/draft · ${own.totaux.livres} livré</span>
      </div>
      <div class="owner-intents">${chips}</div>
    </div>`;
  }).join('');
  const banniere = o.totaux.sansOwner > 0
    ? `<p class="muted" style="font-size:.85rem">⚠ ${o.totaux.sansOwner} Intent(s) sans <code>owner:</code> assigné — ajouter le champ dans le frontmatter pour les associer à un PM/responsable.</p>`
    : '<p class="muted" style="font-size:.85rem">Tous les Intents ont un owner explicite.</p>';
  return `${OWNERSHIP_CSS}<section>
    <h2>Portefeuille par owner <span class="count">${o.totaux.ownersReels} owner(s) · ${o.totaux.sansOwner} sans owner</span></h2>
    ${banniere}
    ${cards}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerOwnership as computeOwnership,
  blocOwnership as ownershipSection,
};
