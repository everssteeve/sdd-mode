// AIAD SDD Mode — Dashboard : sponsor performance scorecard (#555).
//
// Pour chaque sponsor, calcule un score composite /5 sur 5 dimensions :
//   1. Throughput (#494) : ≥ 1 SPEC livrée par Intent porté → +1
//   2. Engagement (#489 stakeholder-comms) : dernier contact ≤ 14j → +1
//   3. Couverture risque : tous ses Intents avec risque ont mitigation OU
//      acceptation (depuis #531) → +1
//   4. Pas de zombie : aucun Intent zombie sous son nom → +1
//   5. SPECs en review/validation ≤ 14j → +1
//
// Pure transformation (aggregate les autres modules).

function lireSponsors(intent) {
  const out = [];
  const candidats = [intent?.sponsor, intent?.sponsors, intent?.stakeholder, intent?.stakeholders, intent?.business_owner];
  for (const v of candidats) {
    if (!v) continue;
    if (Array.isArray(v)) { for (const x of v) if (x) out.push(String(x).trim()); }
    else if (typeof v === 'string') {
      for (const x of v.split(/[,;]/)) if (x.trim()) out.push(x.trim());
    }
  }
  return [...new Set(out.filter(Boolean))];
}

const DAY = 24 * 3600 * 1000;
const STATUTS_LIVRES = new Set(['done', 'archived']);

export function calculerSponsorScorecard(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const intents = donnees?.intents || [];
  const specsParCourt = new Map();
  for (const s of donnees?.specs || []) {
    if (!s.parentIntent) continue;
    const court = String(s.parentIntent).split('-').slice(0, 2).join('-');
    if (!specsParCourt.has(court)) specsParCourt.set(court, []);
    specsParCourt.get(court).push(s);
  }
  const commsById = new Map((donnees?.stakeholderComms?.items || []).map((c) => [c.id, c]));
  const transparencyById = new Map((donnees?.riskTransparency?.items || []).map((r) => [r.id, r]));
  const zombiesIds = new Set((donnees?.pm?.zombies || []).map((z) => z.id));
  const parSponsor = new Map();
  for (const i of intents) {
    const sponsors = lireSponsors(i);
    if (sponsors.length === 0) continue;
    const court = i.id.split('-').slice(0, 2).join('-');
    const specs = specsParCourt.get(court) || [];
    for (const sp of sponsors) {
      if (!parSponsor.has(sp)) parSponsor.set(sp, { sponsor: sp, intents: [], stats: {} });
      const entry = parSponsor.get(sp);
      entry.intents.push({ ...i, specs });
    }
  }
  const items = [...parSponsor.values()].map((e) => {
    const intentsList = e.intents;
    // 1. Throughput
    const intentsAvecLivraison = intentsList.filter((i) => i.specs.some((s) => STATUTS_LIVRES.has(s.statut)));
    const throughput = intentsList.length > 0 && intentsAvecLivraison.length / intentsList.length >= 0.5;
    // 2. Engagement
    const commsRecente = intentsList.some((i) => {
      const c = commsById.get(i.id);
      return c && c.derniereComm && now - c.derniereComm <= 14 * DAY;
    });
    // 3. Couverture risque
    const intentsAvecRisque = intentsList.filter((i) => transparencyById.has(i.id));
    const couvertureRisque = intentsAvecRisque.length === 0 || intentsAvecRisque.every((i) => transparencyById.get(i.id).couvert);
    // 4. Zombies
    const pasZombie = !intentsList.some((i) => zombiesIds.has(i.id));
    // 5. SPECs review ≤ 14j (proxy via mtime)
    const specsReview = intentsList.flatMap((i) => i.specs).filter((s) => s.statut === 'review' || s.statut === 'validation');
    const reviewOk = specsReview.length === 0 || specsReview.every((s) => s.mtime && now - s.mtime <= 14 * DAY);
    const checks = { throughput, commsRecente, couvertureRisque, pasZombie, reviewOk };
    const score = Object.values(checks).filter(Boolean).length;
    let etat;
    if (score === 5) etat = 'excellent';
    else if (score >= 4) etat = 'bon';
    else if (score >= 2) etat = 'partiel';
    else etat = 'faible';
    return {
      sponsor: e.sponsor,
      nbIntents: intentsList.length,
      score,
      etat,
      checks,
    };
  });
  items.sort((a, b) => b.score - a.score);
  const totaux = {
    sponsors: items.length,
    excellent: items.filter((i) => i.etat === 'excellent').length,
    faible: items.filter((i) => i.etat === 'faible').length,
    scoreMoyen: items.length === 0 ? 0
      : Math.round((items.reduce((s, x) => s + x.score, 0) / items.length) * 10) / 10,
  };
  return { items, totaux };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const SS_CSS = `<style>
.ssc-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:.4rem; margin:.4rem 0; }
.ssc-stat { padding:.4rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.ssc-stat .ssc-val { font-size:1.2rem; font-weight:700; }
.ssc-stat .ssc-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.ssc-stat.e-excellent { background:rgba(43,138,62,.07); border-color:rgba(43,138,62,.3); }
.ssc-stat.e-faible { background:rgba(201,42,42,.06); border-color:rgba(201,42,42,.3); }
.ssc-row { padding:.45rem .55rem; margin:.2rem 0; border-radius:.3rem; background:rgba(127,127,127,.04); display:flex; gap:.5rem; align-items:baseline; flex-wrap:wrap; border-left:3px solid var(--accent, #4c6ef5); }
.ssc-row.r-excellent { border-left-color:#2b8a3e; background:rgba(43,138,62,.05); }
.ssc-row.r-bon { border-left-color:#3a9c4f; }
.ssc-row.r-partiel { border-left-color:#f5a623; }
.ssc-row.r-faible { border-left-color:#c92a2a; background:rgba(201,42,42,.04); }
.ssc-checks { display:flex; gap:.2rem; flex-wrap:wrap; }
.ssc-check { padding:.05rem .35rem; border-radius:.15rem; font-size:.7rem; }
.ssc-check.ok { background:rgba(43,138,62,.15); color:#1c5a2a; }
.ssc-check.ko { background:rgba(201,42,42,.12); color:#7a1717; }
.ssc-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
</style>`;

const LABELS = {
  excellent: '✓ Excellent (5/5)',
  bon: '◐ Bon (4/5)',
  partiel: '⚠ Partiel (2-3)',
  faible: '⛔ Faible (< 2)',
};
const CHECK_LABELS = {
  throughput: 'throughput',
  commsRecente: 'comm récente',
  couvertureRisque: 'risques OK',
  pasZombie: 'pas zombie',
  reviewOk: 'review ≤ 14j',
};

export function blocSponsorScorecard(donnees) {
  const s = donnees?.sponsorScorecard;
  if (!s) return '';
  if (s.items.length === 0) {
    return `${SS_CSS}<section>
      <h2>Scorecard sponsors <span class="count">aucun sponsor déclaré</span></h2>
      <div class="ssc-empty">Score composite /5 par sponsor sur 5 dimensions (throughput, engagement, couverture risque, pas zombie, review ≤ 14j). Nécessite frontmatter <code>sponsor:</code>.</div>
    </section>`;
  }
  const t = s.totaux;
  const grid = ['excellent', 'bon', 'partiel', 'faible'].map((etat) => `<div class="ssc-stat e-${etat}">
      <div class="ssc-val">${t[etat] || 0}</div>
      <div class="ssc-label">${escape(LABELS[etat])}</div>
    </div>`).join('');
  const rows = s.items.slice(0, 12).map((it) => {
    const checks = Object.entries(it.checks).map(([k, v]) => `<span class="ssc-check ${v ? 'ok' : 'ko'}">${escape(CHECK_LABELS[k])}</span>`).join(' ');
    return `<div class="ssc-row r-${escape(it.etat)}">
      <strong>${escape(it.sponsor)}</strong>
      <span><strong>${it.score}/5</strong></span>
      <span class="muted">${it.nbIntents} Intent(s)</span>
      <span class="ssc-checks">${checks}</span>
    </div>`;
  }).join('');
  return `${SS_CSS}<section>
    <h2>Scorecard sponsors <span class="count">${t.sponsors} sponsors · score moyen ${t.scoreMoyen}/5</span></h2>
    <p class="muted" style="font-size:.85rem">Score composite /5 par sponsor sur 5 dimensions : throughput (≥ 50 % Intents livrés), engagement (dernier contact ≤ 14j #489), couverture risque (tous mitigés/acceptés #531), pas zombie (#137), review ≤ 14j. Tri score desc.</p>
    <div class="ssc-grid">${grid}</div>
    <div>${rows}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerSponsorScorecard as computeSponsorScorecard,
  blocSponsorScorecard as sponsorScorecardSection,
};
