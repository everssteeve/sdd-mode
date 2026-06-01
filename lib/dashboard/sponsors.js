// AIAD SDD Mode — Dashboard : portefeuille par sponsor / stakeholder (#437).
//
// Lit le frontmatter `sponsor:` / `stakeholder:` / `business_owner:` des
// Intents pour permettre au PM de préparer ses 1:1 sponsor / COMEX :
// « pour chaque sponsor, qu'est-ce qu'on porte pour lui ? Quelle est sa
// part livrée vs. encore en pipeline ? ».
//
// Différencie un sponsor (qui finance / oriente, niveau exec) d'un owner
// (qui gère l'exécution, niveau PM) — cohérent avec la pratique produit
// classique (PRD AIAD §3 Personas / RACI sponsor vs. owner).
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const STATUTS_LIVRES = new Set(['done', 'archived']);
const STATUTS_ACTIFS = new Set(['active', 'in-progress', 'review', 'validation']);

function lireSponsors(intent) {
  if (!intent) return [];
  const candidats = [
    intent.sponsor, intent.Sponsor, intent.sponsors, intent.Sponsors,
    intent.stakeholder, intent.stakeholders, intent.Stakeholders,
    intent.business_owner, intent.businessOwner,
  ];
  const out = new Set();
  for (const c of candidats) {
    if (c == null) continue;
    if (Array.isArray(c)) {
      for (const v of c) if (v) out.add(String(v).trim());
    } else if (typeof c === 'string' && c.trim() !== '') {
      for (const v of c.split(/[,;]/)) {
        const s = v.trim();
        if (s) out.add(s);
      }
    }
  }
  return [...out];
}

export function calculerSponsors(donnees) {
  const intents = donnees?.intents || [];
  const par = new Map();
  for (const i of intents) {
    const sponsors = lireSponsors(i);
    if (sponsors.length === 0) continue; // sans sponsor → ignoré (≠ owner #435)
    for (const s of sponsors) {
      if (!par.has(s)) par.set(s, []);
      par.get(s).push(i);
    }
  }
  const sponsors = [];
  for (const [nom, intentsOfSponsor] of par) {
    const actifs = intentsOfSponsor.filter((i) => STATUTS_ACTIFS.has(i.statut));
    const drafts = intentsOfSponsor.filter((i) => i.statut === 'draft');
    const livres = intentsOfSponsor.filter((i) => STATUTS_LIVRES.has(i.statut));
    sponsors.push({
      nom,
      intents: intentsOfSponsor.map((i) => ({
        id: i.id,
        titre: i.titre || '',
        statut: i.statut,
        file: i.file || null,
        priority: i.priority || null,
      })),
      totaux: {
        total: intentsOfSponsor.length,
        actifs: actifs.length,
        drafts: drafts.length,
        livres: livres.length,
      },
    });
  }
  // Tri par total desc.
  sponsors.sort((a, b) => b.totaux.total - a.totaux.total);
  // Compte les Intents sans sponsor (signal pour les ajouter).
  const sansSponsor = intents.filter((i) => lireSponsors(i).length === 0).length;
  return {
    sponsors,
    totaux: {
      sponsors: sponsors.length,
      sansSponsor,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const SPONSORS_CSS = `<style>
.sponsor-card { padding:.55rem .75rem; margin:.4rem 0; border:1px solid var(--border, #ddd); border-radius:.4rem; background:var(--card-bg, #fff); font-size:.85rem; }
.sponsor-card-head { display:flex; align-items:baseline; gap:.5rem; flex-wrap:wrap; }
.sponsor-card-head strong { font-size:.95rem; }
.sponsor-stats { display:flex; gap:.4rem; flex-wrap:wrap; margin:.3rem 0; }
.sponsor-stat { padding:.2rem .45rem; background:rgba(127,127,127,.06); border-radius:.2rem; font-size:.75rem; }
.sponsor-stat-actifs { background:rgba(76,110,245,.12); color:#3a4cba; }
.sponsor-stat-drafts { background:rgba(232,89,12,.12); color:#a2410d; }
.sponsor-stat-livres { background:rgba(43,138,62,.12); color:#1f6b2f; }
.sponsor-intents { display:flex; flex-wrap:wrap; gap:.3rem; margin-top:.3rem; }
.sponsor-intent-chip { padding:.15rem .4rem; background:rgba(127,127,127,.06); border-radius:.2rem; font-size:.75rem; }
.sponsor-intent-chip.statut-done, .sponsor-intent-chip.statut-archived { opacity:.55; }
</style>`;

function chipIntent(i) {
  const idCell = i.file ? lienSource(i.file, i.id) : `<code>${escape(i.id)}</code>`;
  const prio = i.priority ? `<span class="muted">[${escape(String(i.priority).toUpperCase())}]</span>` : '';
  return `<span class="sponsor-intent-chip statut-${escape(i.statut || 'unknown')}" title="${escape(i.titre)} (${escape(i.statut || '?')})">${idCell} ${prio}</span>`;
}

export function blocSponsors(donnees) {
  const s = donnees?.sponsors;
  if (!s || s.sponsors.length === 0) {
    if (!s) return '';
    return `<section>
      <h2>Portefeuille par sponsor <span class="count">aucun sponsor déclaré</span></h2>
      <p class="muted" style="font-size:.85rem">Aucun Intent ne déclare de <code>sponsor:</code> dans son frontmatter. ${s.totaux.sansSponsor} Intent(s) au total — ajouter <code>sponsor: Direction Marketing</code> dans le frontmatter pour préparer les 1:1 sponsor / COMEX.</p>
    </section>`;
  }
  const cards = s.sponsors.map((sp) => {
    const chips = sp.intents.map(chipIntent).join(' ');
    return `<div class="sponsor-card">
      <div class="sponsor-card-head">
        <strong>${escape(sp.nom)}</strong>
        <span class="muted">${sp.totaux.total} Intent(s)</span>
      </div>
      <div class="sponsor-stats">
        <span class="sponsor-stat sponsor-stat-actifs">${sp.totaux.actifs} actif(s)</span>
        ${sp.totaux.drafts > 0 ? `<span class="sponsor-stat sponsor-stat-drafts">${sp.totaux.drafts} draft(s)</span>` : ''}
        ${sp.totaux.livres > 0 ? `<span class="sponsor-stat sponsor-stat-livres">${sp.totaux.livres} livré(s)</span>` : ''}
      </div>
      <div class="sponsor-intents">${chips}</div>
    </div>`;
  }).join('');
  const banniere = s.totaux.sansSponsor > 0
    ? `<p class="muted" style="font-size:.85rem">${s.totaux.sansSponsor} Intent(s) sans <code>sponsor:</code> — ils ne remontent pas dans cette vue.</p>`
    : '';
  return `${SPONSORS_CSS}<section>
    <h2>Portefeuille par sponsor <span class="count">${s.totaux.sponsors} sponsor(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Pour chaque sponsor déclaré dans le frontmatter (<code>sponsor:</code> / <code>stakeholder:</code> / <code>business_owner:</code>), inventaire des Intents qu'il finance avec part actifs/drafts/livrés. Utile pour préparer les 1:1 sponsor et les COMEX.</p>
    ${banniere}
    ${cards}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerSponsors as computeSponsors,
  blocSponsors as sponsorsSection,
};
