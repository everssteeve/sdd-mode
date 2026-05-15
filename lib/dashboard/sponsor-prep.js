// AIAD SDD Mode — Dashboard : sponsor 1:1 prep card (#502).
//
// Agrège pour CHAQUE sponsor une "carte de prep 1:1" auto-générée :
//   - Intents portés (counts par statut)
//   - SPECs livrées (last delivered)
//   - Risques niveau critical/high (du portefeuille)
//   - Dernier contact (via stakeholder-comms #489)
//   - Échéances proches (deadlines #440)
//
// Permet au PM d'arriver en 1:1 sponsor avec un brief complet en
// 30 secondes, sans pivoter entre 5 sections.
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const STATUTS_LIVRES = new Set(['done', 'archived']);
const STATUTS_ACTIFS = new Set(['active', 'in-progress', 'validation', 'review']);

function lireSponsors(intent) {
  const candidats = [intent?.sponsor, intent?.sponsors, intent?.stakeholder, intent?.stakeholders, intent?.business_owner];
  const out = [];
  for (const v of candidats) {
    if (!v) continue;
    if (Array.isArray(v)) { for (const x of v) if (x) out.push(String(x).trim()); }
    else if (typeof v === 'string') {
      for (const x of v.split(/[,;]/)) if (x.trim()) out.push(x.trim());
    }
  }
  return [...new Set(out.filter(Boolean))];
}

function indexerSpecs(specs) {
  const m = new Map();
  for (const s of specs || []) {
    if (!s.parentIntent) continue;
    const court = String(s.parentIntent).split('-').slice(0, 2).join('-');
    if (!m.has(court)) m.set(court, []);
    m.get(court).push(s);
  }
  return m;
}

export function calculerSponsorPrep(donnees) {
  const intents = donnees?.intents || [];
  const specsParCourt = indexerSpecs(donnees?.specs);
  const commsParId = new Map((donnees?.stakeholderComms?.items || []).map((c) => [c.id, c]));
  const risksParId = new Map((donnees?.risks?.intents || []).map((r) => [r.id, r]));
  const deadlinesParId = new Map((donnees?.deadlines?.items || []).map((d) => [d.id, d]));
  const parSponsor = new Map();
  for (const i of intents) {
    const sponsors = lireSponsors(i);
    if (sponsors.length === 0) continue;
    const court = i.id.split('-').slice(0, 2).join('-');
    const specs = specsParCourt.get(court) || [];
    const livres = specs.filter((s) => STATUTS_LIVRES.has(s.statut));
    for (const sp of sponsors) {
      if (!parSponsor.has(sp)) {
        parSponsor.set(sp, {
          sponsor: sp,
          intents: [],
          actifs: 0,
          livres: 0,
          drafts: 0,
          specsLivrees: 0,
          dernierLivrable: null,
          risquesEleves: [],
          echeancesProches: [],
          dernierContact: null,
        });
      }
      const entry = parSponsor.get(sp);
      entry.intents.push({ id: i.id, titre: i.titre || '', statut: i.statut, priority: i.priority || null });
      if (STATUTS_ACTIFS.has(i.statut)) entry.actifs++;
      else if (i.statut === 'done' || i.statut === 'archived') entry.livres++;
      else if (i.statut === 'draft') entry.drafts++;
      entry.specsLivrees += livres.length;
      for (const s of livres) {
        if (!entry.dernierLivrable || s.mtime > entry.dernierLivrable.mtime) {
          entry.dernierLivrable = { id: s.id, mtime: s.mtime };
        }
      }
      const r = risksParId.get(i.id);
      if (r && (r.niveau === 'critical' || r.niveau === 'high')) {
        entry.risquesEleves.push({ id: i.id, niveau: r.niveau, titre: i.titre || '' });
      }
      const d = deadlinesParId.get(i.id);
      if (d && (d.proximite === 'urgent' || d.proximite === 'proche' || d.proximite === 'retard')) {
        entry.echeancesProches.push({ id: i.id, targetDate: d.targetDate, proximite: d.proximite });
      }
      const c = commsParId.get(i.id);
      if (c && c.derniereComm) {
        if (!entry.dernierContact || c.derniereComm > entry.dernierContact) entry.dernierContact = c.derniereComm;
      }
    }
  }
  const items = [...parSponsor.values()].sort((a, b) => b.actifs - a.actifs || b.specsLivrees - a.specsLivrees);
  return {
    items,
    totaux: {
      sponsors: items.length,
      actifs: items.filter((s) => s.actifs > 0).length,
      avecRisque: items.filter((s) => s.risquesEleves.length > 0).length,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const SP_CSS = `<style>
.sprep-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:.6rem; margin:.5rem 0; }
.sprep-card { padding:.6rem .75rem; border-radius:.4rem; border:1px solid var(--border, #ddd); background:var(--card-bg, #fff); border-left:4px solid var(--accent, #4c6ef5); }
.sprep-card.has-risk { border-left-color:#c92a2a; background:rgba(201,42,42,.03); }
.sprep-card h3 { font-size:.95rem; margin:.1rem 0 .4rem; display:flex; gap:.4rem; align-items:baseline; flex-wrap:wrap; }
.sprep-tag { padding:.1rem .35rem; background:rgba(127,127,127,.1); border-radius:.18rem; font-size:.7rem; }
.sprep-tag.t-actif { background:rgba(43,138,62,.12); color:#1c5a2a; }
.sprep-tag.t-risque { background:rgba(201,42,42,.15); color:#7a1717; }
.sprep-section { margin:.3rem 0; font-size:.82rem; }
.sprep-section strong { font-size:.72rem; text-transform:uppercase; letter-spacing:.04em; color:var(--muted, #777); }
.sprep-list { margin:.15rem 0 .25rem; padding-left:1rem; font-size:.8rem; }
.sprep-list li { margin:.05rem 0; }
.sprep-list .muted-cell { color:var(--muted, #777); }
.sprep-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
</style>`;

function fmtDate(ts) { return ts ? new Date(ts).toLocaleDateString('fr-FR') : '—'; }

export function blocSponsorPrep(donnees) {
  const s = donnees?.sponsorPrep;
  if (!s) return '';
  if (s.items.length === 0) {
    return `${SP_CSS}<section>
      <h2>Prep 1:1 sponsor <span class="count">aucun sponsor déclaré</span></h2>
      <div class="sprep-empty">Ajoute <code>sponsor:</code> au frontmatter des Intents pour générer automatiquement les cartes de prep 1:1 (Intents portés, SPECs livrées, risques, échéances, dernier contact).</div>
    </section>`;
  }
  const cards = s.items.slice(0, 12).map((sp) => {
    const intents = sp.intents.slice(0, 6).map((i) => `<li>${escape(i.id)} <span class="muted-cell">${escape((i.titre || '').slice(0, 40))} [${escape(i.statut || '?')}${i.priority ? ' · ' + String(i.priority).toUpperCase() : ''}]</span></li>`).join('');
    const risques = sp.risquesEleves.length > 0
      ? `<div class="sprep-section"><strong>Risques élevés</strong><ul class="sprep-list">${sp.risquesEleves.slice(0, 4).map((r) => `<li>${escape(r.id)} <span class="sprep-tag t-risque">${escape(r.niveau)}</span></li>`).join('')}</ul></div>`
      : '';
    const echeances = sp.echeancesProches.length > 0
      ? `<div class="sprep-section"><strong>Échéances proches</strong><ul class="sprep-list">${sp.echeancesProches.slice(0, 4).map((d) => `<li>${escape(d.id)} <span class="muted-cell">${escape(String(d.targetDate || ''))} (${escape(d.proximite)})</span></li>`).join('')}</ul></div>`
      : '';
    const contact = sp.dernierContact
      ? `<div class="sprep-section"><strong>Dernier contact</strong> ${escape(fmtDate(sp.dernierContact))}</div>`
      : `<div class="sprep-section"><strong>Dernier contact</strong> <span class="muted-cell">aucune trace — relancer un sync</span></div>`;
    const livrable = sp.dernierLivrable
      ? ` · dernier livré ${escape(fmtDate(sp.dernierLivrable.mtime))} (${escape(sp.dernierLivrable.id)})`
      : ' · 0 SPEC livrée à ce jour';
    return `<div class="sprep-card${sp.risquesEleves.length > 0 ? ' has-risk' : ''}">
      <h3>${escape(sp.sponsor)}
        <span class="sprep-tag t-actif">${sp.actifs} actif</span>
        <span class="sprep-tag">${sp.livres} livré</span>
        <span class="sprep-tag">${sp.specsLivrees} SPEC</span>
        ${sp.risquesEleves.length ? `<span class="sprep-tag t-risque">${sp.risquesEleves.length} risque</span>` : ''}
      </h3>
      <div class="sprep-section"><strong>Intents portés</strong><ul class="sprep-list">${intents}</ul></div>
      ${risques}
      ${echeances}
      ${contact}
      <div class="sprep-section muted-cell" style="font-size:.72rem">${escape(sp.intents.length)} Intent(s) au total${livrable}</div>
    </div>`;
  }).join('');
  return `${SP_CSS}<section>
    <h2>Prep 1:1 sponsor <span class="count">${s.totaux.sponsors} sponsor(s) · ${s.totaux.actifs} actif(s) · ${s.totaux.avecRisque} avec risque élevé</span></h2>
    <p class="muted" style="font-size:.85rem">Une carte par sponsor avec brief 30s pour préparer le 1:1 : Intents portés, SPECs livrées (date+id), risques niveau critical/high, échéances proches, dernier contact tracé.</p>
    <div class="sprep-grid">${cards}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerSponsorPrep as computeSponsorPrep,
  blocSponsorPrep as sponsorPrepSection,
};
