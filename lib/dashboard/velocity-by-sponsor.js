// AIAD SDD Mode — Dashboard : velocity by sponsor (#494).
//
// Mesure la **vitesse de livraison agrégée par sponsor**. Pour chaque
// sponsor unique, calcule :
//   - nb Intents portés (tous statuts)
//   - nb SPECs livrées (done/archived) sur ces Intents
//   - rythme moyen : SPECs livrées / Intents portés (proxy throughput)
//   - cycle-time moyen : âge moyen d'une SPEC livrée (mtime - creation)
//
// Permet au PM de comparer la productivité par sponsor pour orienter
// les arbitrages capacité et les sync 1:1.
//
// Sources :
//   - intents[].sponsor : frontmatter
//   - specs[].mtime : pour proxy cycle-time
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const STATUTS_LIVRES = new Set(['done', 'archived']);

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

export function calculerVelocityBySponsor(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const intents = donnees?.intents || [];
  const specsParCourt = indexerSpecs(donnees?.specs);
  // sponsor → { intents: [], specsLivrees: [], cycleTimes: [] }
  const parSponsor = new Map();
  for (const i of intents) {
    const sponsors = lireSponsors(i);
    if (sponsors.length === 0) continue;
    const court = i.id.split('-').slice(0, 2).join('-');
    const specs = specsParCourt.get(court) || [];
    for (const sp of sponsors) {
      if (!parSponsor.has(sp)) parSponsor.set(sp, { intents: [], specsLivrees: [], cycleTimes: [] });
      const entry = parSponsor.get(sp);
      entry.intents.push(i.id);
      for (const s of specs) {
        if (STATUTS_LIVRES.has(s.statut) && s.mtime) {
          entry.specsLivrees.push(s);
          const ageJours = Math.floor((now - s.mtime) / (24 * 3600 * 1000));
          if (ageJours >= 0 && ageJours < 365) entry.cycleTimes.push(ageJours);
        }
      }
    }
  }
  const items = [...parSponsor.entries()].map(([sponsor, e]) => {
    const nbIntents = e.intents.length;
    const nbLivrees = e.specsLivrees.length;
    const throughput = nbIntents > 0 ? Math.round((nbLivrees / nbIntents) * 10) / 10 : 0;
    const cycleTimeMoyen = e.cycleTimes.length
      ? Math.round(e.cycleTimes.reduce((s, x) => s + x, 0) / e.cycleTimes.length)
      : null;
    return {
      sponsor,
      nbIntents,
      nbLivrees,
      throughput,
      cycleTimeMoyen,
      intents: e.intents.slice(0, 5),
    };
  });
  // Tri : nbLivrees desc, puis throughput desc.
  items.sort((a, b) => {
    if (b.nbLivrees !== a.nbLivrees) return b.nbLivrees - a.nbLivrees;
    return b.throughput - a.throughput;
  });
  return {
    items,
    totaux: {
      sponsors: items.length,
      sponsorAvecLivraison: items.filter((i) => i.nbLivrees > 0).length,
      meilleurThroughput: items.length ? items[0].sponsor : null,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const VS_CSS = `<style>
.vs-table { width:100%; border-collapse:collapse; font-size:.85rem; margin:.4rem 0; }
.vs-table th, .vs-table td { padding:.35rem .5rem; border-bottom:1px solid var(--border, #eee); text-align:left; }
.vs-table th { font-size:.75rem; text-transform:uppercase; letter-spacing:.04em; color:var(--muted, #777); }
.vs-bar { display:inline-block; width:80px; height:8px; background:rgba(127,127,127,.15); border-radius:4px; vertical-align:middle; overflow:hidden; }
.vs-bar-fill { height:100%; background:#2b8a3e; transition:width .15s; }
.vs-tag { padding:.1rem .35rem; background:rgba(127,127,127,.08); border-radius:.15rem; font-size:.72rem; color:var(--muted, #777); }
.vs-medal { font-size:1rem; margin-right:.2rem; }
.vs-empty { padding:.5rem; color:var(--muted, #777); font-size:.85rem; font-style:italic; background:rgba(127,127,127,.04); border-radius:.25rem; }
</style>`;

export function blocVelocityBySponsor(donnees) {
  const v = donnees?.velocityBySponsor;
  if (!v) return '';
  if (v.items.length === 0) {
    return `${VS_CSS}<section>
      <h2>Vélocité par sponsor <span class="count">aucun sponsor déclaré</span></h2>
      <p class="muted" style="font-size:.85rem">Ajoute <code>sponsor:</code> au frontmatter des Intents pour permettre l'agrégation des SPECs livrées par sponsor. Utile pour les 1:1 stakeholder ("ce qu'on a livré pour vous ce trimestre").</p>
    </section>`;
  }
  const maxThroughput = Math.max(...v.items.map((i) => i.throughput), 0.1);
  const rows = v.items.slice(0, 15).map((it, idx) => {
    const medal = idx === 0 && it.nbLivrees > 0 ? '🥇' : idx === 1 && it.nbLivrees > 0 ? '🥈' : idx === 2 && it.nbLivrees > 0 ? '🥉' : '';
    const pct = (it.throughput / maxThroughput) * 100;
    return `<tr>
      <td><span class="vs-medal">${escape(medal)}</span><strong>${escape(it.sponsor)}</strong></td>
      <td><span class="vs-tag">${it.nbIntents}</span></td>
      <td>${it.nbLivrees}</td>
      <td><span class="vs-bar"><span class="vs-bar-fill" style="width:${pct.toFixed(1)}%"></span></span> ${it.throughput}</td>
      <td>${it.cycleTimeMoyen != null ? it.cycleTimeMoyen + 'j' : '—'}</td>
    </tr>`;
  }).join('');
  const t = v.totaux;
  const summary = t.meilleurThroughput
    ? `<p class="muted" style="font-size:.85rem">🥇 <strong>${escape(t.meilleurThroughput)}</strong> est le sponsor avec la meilleure contribution livrée (${v.items[0].nbLivrees} SPECs livrée(s) sur ${v.items[0].nbIntents} Intent(s)).</p>`
    : `<p class="muted" style="font-size:.85rem">Aucun sponsor n'a encore vu de SPEC livrée — phase amont du portefeuille.</p>`;
  return `${VS_CSS}<section>
    <h2>Vélocité par sponsor <span class="count">${t.sponsors} sponsor(s) — ${t.sponsorAvecLivraison} avec livraison</span></h2>
    <p class="muted" style="font-size:.85rem">Pour chaque sponsor, mesure le throughput (SPECs livrées / Intents portés) et le cycle-time moyen (âge moyen d'une SPEC livrée en jours). Utile pour préparer les 1:1 sponsor et orienter les arbitrages capacité.</p>
    ${summary}
    <table class="vs-table">
      <thead><tr><th>Sponsor</th><th>Intents</th><th>SPECs livrées</th><th>Throughput</th><th>Cycle-time moyen</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerVelocityBySponsor as computeVelocityBySponsor,
  blocVelocityBySponsor as velocityBySponsorSection,
};
