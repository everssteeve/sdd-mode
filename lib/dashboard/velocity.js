// AIAD SDD Mode — Dashboard : vélocité PM (#424).
//
// Réponds à la question canonique du standup et du COMEX :
// « Combien d'Intents et de SPECs avons-nous livrés dans les N dernières
//   semaines/mois ? L'équipe accélère, ralentit, ou stagne ? ».
//
// Source de vérité : mtime + statut `done` des Intents et SPECs (pas de
// snapshot historique nécessaire — la trace est déjà dans le filesystem).
//
// Aucun effet de bord. Pure transformation `donnees → velocity`.
//
// Documentation : https://aiad.ovh

const JOUR_MS = 24 * 3600 * 1000;
const SEMAINE_MS = 7 * JOUR_MS;

// Découpe les `done` en buckets temporels. Les Intents par mois (6 derniers),
// les SPECs par semaine (12 dernières). Le mtime fait foi : une régénération
// `aiad-sdd dashboard` ne décale pas les buckets puisqu'on lit `i.mtime` /
// `s.mtime` directement depuis le filesystem au moment de la collecte.

export function bucketsMois(items, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const nbMois = options.mois || 6;
  // Mois UTC pour éviter les décalages liés au fuseau (cohérent avec
  // bucketsHebdomadaires des modules history). Index = `YYYY-MM`.
  const buckets = [];
  const auj = new Date(now);
  for (let i = nbMois - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(auj.getUTCFullYear(), auj.getUTCMonth() - i, 1));
    buckets.push({
      key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleString('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      count: 0,
      ts: d.getTime(),
    });
  }
  for (const it of items || []) {
    if (it.statut !== 'done' || !it.mtime) continue;
    const d = new Date(it.mtime);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const b = buckets.find((x) => x.key === key);
    if (b) b.count++;
  }
  return buckets;
}

export function bucketsSemaines(items, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const nbSemaines = options.semaines || 12;
  // Lundi UTC du début de chaque semaine.
  const buckets = [];
  const aujUtc = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate());
  const dow = new Date(aujUtc).getUTCDay() || 7; // dimanche=0 → 7
  const lundi = aujUtc - (dow - 1) * JOUR_MS;
  for (let i = nbSemaines - 1; i >= 0; i--) {
    const ts = lundi - i * SEMAINE_MS;
    const d = new Date(ts);
    buckets.push({
      key: `${d.getUTCFullYear()}-W${semaineIsoNum(d)}`,
      label: `S${semaineIsoNum(d)}`,
      count: 0,
      ts,
    });
  }
  for (const it of items || []) {
    if (it.statut !== 'done' || !it.mtime) continue;
    // Tronque la mtime au lundi UTC de la semaine concernée.
    const d = new Date(it.mtime);
    const dUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const dDow = new Date(dUtc).getUTCDay() || 7;
    const lundiOfIt = dUtc - (dDow - 1) * JOUR_MS;
    const b = buckets.find((x) => x.ts === lundiOfIt);
    if (b) b.count++;
  }
  return buckets;
}

function semaineIsoNum(date) {
  // Algorithme ISO 8601 — semaine commence lundi, S01 = celle contenant le 4 janvier.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / JOUR_MS) + 1) / 7);
}

// ─── Façade ─────────────────────────────────────────────────────────────────

export function calculerVelocity(donnees, options = {}) {
  const intentsParMois = bucketsMois(donnees?.intents || [], options);
  const specsParSemaine = bucketsSemaines(donnees?.specs || [], options);
  const totalIntents = intentsParMois.reduce((s, b) => s + b.count, 0);
  const totalSpecs = specsParSemaine.reduce((s, b) => s + b.count, 0);
  // Tendance : compare la moitié récente à la moitié plus ancienne.
  const tendance = (buckets) => {
    if (buckets.length < 2) return { sens: 'unknown', delta: 0 };
    const mid = Math.floor(buckets.length / 2);
    const recente = buckets.slice(mid).reduce((s, b) => s + b.count, 0);
    const ancienne = buckets.slice(0, mid).reduce((s, b) => s + b.count, 0);
    const delta = recente - ancienne;
    if (delta > 0) return { sens: 'up', delta };
    if (delta < 0) return { sens: 'down', delta };
    return { sens: 'flat', delta: 0 };
  };
  return {
    intentsParMois,
    specsParSemaine,
    totaux: {
      intentsDone: totalIntents,
      specsDone: totalSpecs,
      moisCouverts: intentsParMois.length,
      semainesCouvertes: specsParSemaine.length,
    },
    tendanceIntents: tendance(intentsParMois),
    tendanceSpecs: tendance(specsParSemaine),
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

function barChartSvg(buckets, opts = {}) {
  if (!buckets.length) return '';
  const w = opts.width || 320;
  const h = opts.height || 80;
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const barW = (w - 16) / buckets.length;
  const bars = buckets.map((b, i) => {
    const x = 8 + i * barW;
    const bh = (b.count / max) * (h - 24);
    const y = h - 16 - bh;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(barW - 2).toFixed(1)}" height="${Math.max(2, bh).toFixed(1)}" fill="#4c6ef5" rx="2"><title>${escape(b.label)} : ${b.count}</title></rect>`;
  }).join('');
  // Labels : 1er, milieu, dernier
  const idxLabels = [0, Math.floor(buckets.length / 2), buckets.length - 1];
  const labels = idxLabels.map((i) => {
    const x = 8 + i * barW + barW / 2;
    return `<text x="${x.toFixed(1)}" y="${h - 2}" font-size="9" text-anchor="middle" fill="currentColor" opacity=".55">${escape(buckets[i].label)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Vélocité ${buckets.length} buckets">
    ${bars}${labels}
  </svg>`;
}

function badgeTendance(t) {
  if (!t || t.sens === 'unknown') return '<span class="badge badge-muted">—</span>';
  if (t.sens === 'up') return `<span class="badge badge-ok">↗ +${t.delta}</span>`;
  if (t.sens === 'down') return `<span class="badge badge-bad">↘ ${t.delta}</span>`;
  return '<span class="badge badge-muted">→ stable</span>';
}

export function blocVelocity(donnees) {
  const v = donnees?.velocity;
  if (!v) return '';
  const t = v.totaux;
  if (t.intentsDone === 0 && t.specsDone === 0) {
    return `<section>
      <h2>Vélocité <span class="count">aucun done dans la fenêtre</span></h2>
      <p class="muted" style="font-size:.85rem">Aucun Intent ou SPEC marqué <code>done</code> dans les ${t.moisCouverts} derniers mois / ${t.semainesCouvertes} dernières semaines.</p>
    </section>`;
  }
  return `<section>
    <h2>Vélocité <span class="count">${t.intentsDone} Intents · ${t.specsDone} SPECs livrés</span></h2>
    <p class="muted" style="font-size:.85rem">Cadence de livraison sur les ${t.moisCouverts} derniers mois (Intents) et ${t.semainesCouvertes} dernières semaines (SPECs). Tendance = comparaison moitié récente vs moitié ancienne de la fenêtre.</p>
    <div class="split">
      <div>
        <h3>Intents done par mois ${badgeTendance(v.tendanceIntents)}</h3>
        ${barChartSvg(v.intentsParMois)}
      </div>
      <div>
        <h3>SPECs done par semaine ${badgeTendance(v.tendanceSpecs)}</h3>
        ${barChartSvg(v.specsParSemaine)}
      </div>
    </div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  bucketsMois as monthlyBuckets,
  bucketsSemaines as weeklyBuckets,
  calculerVelocity as computeVelocity,
  blocVelocity as velocitySection,
};
