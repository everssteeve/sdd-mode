// AIAD SDD Mode — Dashboard : échéances Intent (#431).
//
// Le PM doit voir d'un coup d'œil les Intents dont l'échéance approche
// (`target_date` du frontmatter) — pour prioriser ses standups, escalader
// ce qui glisse, et challenger ce qui est encore en draft à J-30.
//
// Lit `target_date` du frontmatter (ISO `2026-09-30` ou alias `target`
// si quarter parsé) et calcule joursRestants vs. now. Buckets :
//   - retard       : joursRestants < 0 et statut ≠ done/archived
//   - urgent       : 0 ≤ joursRestants ≤ 14
//   - proche       : 15 ≤ joursRestants ≤ 30
//   - planifie     : joursRestants > 30
//   - sans-cible   : pas de target_date détecté
//   - livre        : déjà done/archived (peu importe la cible)
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

import { parseTarget } from './roadmap.js';

const JOUR_MS = 24 * 3600 * 1000;

// Calcule l'échéance d'un Intent en jours restants. Si seul `target`
// (quarter) est donné, on utilise la fin du quarter comme deadline.
// Renvoie `null` si aucune cible n'est exploitable.
export function calculerJoursRestants(intent, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  // target_date prime sur target/quarter (plus précis).
  const candidates = [intent?.target_date, intent?.targetDate];
  for (const c of candidates) {
    if (!c) continue;
    const ts = Date.parse(String(c));
    if (!isNaN(ts)) {
      return Math.ceil((ts - now) / JOUR_MS);
    }
  }
  // Fallback : parse target → fin du quarter civil
  const q = parseTarget(intent?.target);
  if (q) {
    const finMois = q.quarter * 3; // Q1 → 3, Q2 → 6, Q3 → 9, Q4 → 12
    const ts = Date.UTC(q.year, finMois, 0, 23, 59, 59); // dernier jour du dernier mois du quarter
    return Math.ceil((ts - now) / JOUR_MS);
  }
  return null;
}

export function bucketEcheance(intent, joursRestants) {
  if (['done', 'archived'].includes(intent?.statut)) return 'livre';
  if (joursRestants == null) return 'sans-cible';
  if (joursRestants < 0) return 'retard';
  if (joursRestants <= 14) return 'urgent';
  if (joursRestants <= 30) return 'proche';
  return 'planifie';
}

export function calculerEcheances(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const buckets = { retard: [], urgent: [], proche: [], planifie: [], 'sans-cible': [], livre: [] };
  for (const i of donnees?.intents || []) {
    const jours = calculerJoursRestants(i, { now });
    const bucket = bucketEcheance(i, jours);
    buckets[bucket].push({
      id: i.id,
      titre: i.titre || '',
      statut: i.statut,
      file: i.file || null,
      target: i.target || null,
      target_date: i.target_date || i.targetDate || null,
      joursRestants: jours,
    });
  }
  // Tri par urgence dans chaque bucket actionnable.
  for (const k of ['retard', 'urgent', 'proche']) {
    buckets[k].sort((a, b) => (a.joursRestants ?? 0) - (b.joursRestants ?? 0));
  }
  buckets.planifie.sort((a, b) => (a.joursRestants ?? 0) - (b.joursRestants ?? 0));
  return {
    buckets,
    totaux: {
      retard: buckets.retard.length,
      urgent: buckets.urgent.length,
      proche: buckets.proche.length,
      planifie: buckets.planifie.length,
      sansCible: buckets['sans-cible'].length,
      livre: buckets.livre.length,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

function labelJours(j) {
  if (j == null) return '—';
  if (j < 0) return `J+${Math.abs(j)} en retard`;
  if (j === 0) return 'aujourd\'hui';
  return `J-${j}`;
}

function badgeBucket(bucket) {
  const map = {
    retard: { cls: 'badge-bad', label: 'En retard' },
    urgent: { cls: 'badge-bad', label: 'Urgent ≤ 14j' },
    proche: { cls: 'badge-warn', label: 'Proche ≤ 30j' },
    planifie: { cls: 'badge-info', label: 'Planifié' },
    'sans-cible': { cls: 'badge-muted', label: 'Sans cible' },
    livre: { cls: 'badge-ok', label: 'Livré' },
  };
  const v = map[bucket] || { cls: 'badge-muted', label: bucket };
  return `<span class="badge ${v.cls}">${escape(v.label)}</span>`;
}

const DEADLINE_CSS = `<style>
.deadline-list { display:grid; gap:.4rem; margin:.5rem 0; }
.deadline-item { display:grid; grid-template-columns: minmax(0, 2fr) auto auto; gap:.5rem; align-items:center; padding:.4rem .6rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; }
.deadline-item.bucket-retard { background:rgba(201,42,42,.08); border-left:3px solid #c92a2a; }
.deadline-item.bucket-urgent { background:rgba(232,89,12,.08); border-left:3px solid #e8590c; }
.deadline-item.bucket-proche { background:rgba(232,89,12,.04); border-left:3px solid #fab005; }
.deadline-jours { font-weight:600; text-align:right; font-variant-numeric: tabular-nums; }
.deadline-empty { color: var(--muted, #777); font-style: italic; font-size:.85rem; }
</style>`;

function blocBucketDeadlines(label, items, bucket) {
  if (items.length === 0) return '';
  const rows = items.slice(0, 10).map((i) => {
    const idCell = i.file ? lienSource(i.file, i.id) : `<code>${escape(i.id)}</code>`;
    return `<div class="deadline-item bucket-${escape(bucket)}">
      <div>${idCell} — ${escape(i.titre)}</div>
      <span class="muted" style="font-size:.7rem">${escape(i.target_date || i.target || '—')}</span>
      <span class="deadline-jours">${escape(labelJours(i.joursRestants))}</span>
    </div>`;
  }).join('');
  return `<h3>${escape(label)} <span class="count">${items.length}</span></h3><div class="deadline-list">${rows}</div>`;
}

export function blocEcheances(donnees) {
  const d = donnees?.deadlines;
  if (!d) return '';
  const t = d.totaux;
  const actionnables = t.retard + t.urgent + t.proche;
  if (actionnables === 0 && t.planifie === 0 && t.sansCible === 0) return '';
  const bandeau = actionnables === 0
    ? `<p class="muted">Aucune échéance critique sous 30 jours. ${t.sansCible > 0 ? `${t.sansCible} Intent(s) sans cible — ajouter <code>target_date</code> ou <code>target</code> dans le frontmatter pour les inclure dans cette vue.` : ''}</p>`
    : `<p class="muted" style="font-size:.85rem">${t.retard} en retard, ${t.urgent} urgents (≤ 14j), ${t.proche} proches (≤ 30j). Les sections vides sont masquées.</p>`;
  return `${DEADLINE_CSS}<section>
    <h2>Échéances Intent <span class="count">${actionnables} actionnable(s) ${badgeBucket(actionnables > 0 ? 'urgent' : 'planifie')}</span></h2>
    ${bandeau}
    ${blocBucketDeadlines('En retard', d.buckets.retard, 'retard')}
    ${blocBucketDeadlines('Urgent — ≤ 14 jours', d.buckets.urgent, 'urgent')}
    ${blocBucketDeadlines('Proche — ≤ 30 jours', d.buckets.proche, 'proche')}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerJoursRestants as computeDaysRemaining,
  bucketEcheance as deadlineBucket,
  calculerEcheances as computeDeadlines,
  blocEcheances as deadlinesSection,
};
