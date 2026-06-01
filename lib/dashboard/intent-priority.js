// AIAD SDD Mode — Dashboard : priorisation Intent (#426).
//
// Le PM doit pouvoir séquencer ses Intents sur des critères stratégiques
// (P0/P1/P2, wave, RICE, WSJF). Lit le frontmatter et expose un ordre
// canonique consommé par pm.html et intents.html.
//
// Schémas supportés (premier non-null gagne) :
//   - priority: P0|P1|P2|P3 — schéma simple, le plus courant
//   - wave: 1|2|3|4 — schéma "vague de déploiement"
//   - rice: 42.5 — score RICE (Reach × Impact × Confidence / Effort)
//   - wsjf: 7.5 — score WSJF (cost of delay / job size)
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const PRIORITY_RANK = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };

// Lit le schéma de priorité de l'Intent. Renvoie un objet typé qui
// permet ensuite d'ordonner et de rendre. `rawScheme` indique quel
// champ a primé (utile en debug + tooltip rendu).
export function lirePriorite(intent) {
  if (!intent) return { priority: null, rice: null, wsjf: null, wave: null, rawScheme: null };
  const priority = (intent.priority || intent.Priority || intent.prio || null);
  const priorityNorm = priority ? String(priority).toUpperCase().trim() : null;
  // Normalisation case-insensitive : "p0" → "P0".
  const priorityValide = priorityNorm && PRIORITY_RANK[priorityNorm] !== undefined ? priorityNorm : null;
  const rice = numeric(intent.rice ?? intent.RICE);
  const wsjf = numeric(intent.wsjf ?? intent.WSJF);
  const wave = numeric(intent.wave ?? intent.Wave);
  let rawScheme = null;
  if (priorityValide) rawScheme = 'priority';
  else if (rice != null) rawScheme = 'rice';
  else if (wsjf != null) rawScheme = 'wsjf';
  else if (wave != null) rawScheme = 'wave';
  return { priority: priorityValide, rice, wsjf, wave, rawScheme };
}

function numeric(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Comparateur canonique. Plus prioritaire = vient en premier.
//   1. priority P0 < P1 < P2 (None traité comme +∞)
//   2. RICE desc (plus élevé d'abord)
//   3. WSJF desc
//   4. wave asc (vague 1 avant 2)
//   5. mtime desc (plus récent d'abord)
export function comparerPriorite(a, b) {
  const pa = lirePriorite(a);
  const pb = lirePriorite(b);
  const rankA = pa.priority ? PRIORITY_RANK[pa.priority] : 99;
  const rankB = pb.priority ? PRIORITY_RANK[pb.priority] : 99;
  if (rankA !== rankB) return rankA - rankB;
  // RICE/WSJF élevés = mieux ; null = pire (fallback).
  const riceA = pa.rice != null ? pa.rice : -Infinity;
  const riceB = pb.rice != null ? pb.rice : -Infinity;
  if (riceA !== riceB) return riceB - riceA;
  const wsjfA = pa.wsjf != null ? pa.wsjf : -Infinity;
  const wsjfB = pb.wsjf != null ? pb.wsjf : -Infinity;
  if (wsjfA !== wsjfB) return wsjfB - wsjfA;
  // Wave : 1 < 2 < ... ; null en queue.
  const waveA = pa.wave != null ? pa.wave : Infinity;
  const waveB = pb.wave != null ? pb.wave : Infinity;
  if (waveA !== waveB) return waveA - waveB;
  return (b.mtime || 0) - (a.mtime || 0);
}

export function ordonner(intents) {
  return [...(intents || [])].sort(comparerPriorite);
}

export function topPriorites(intents, n = 5) {
  // Filtre : on ignore les Intents `done` ou `archived` (déjà livrés) du
  // top — un PM s'intéresse au pipeline à exécuter.
  const pipeline = (intents || []).filter((i) => !['done', 'archived'].includes(i.statut));
  return ordonner(pipeline).slice(0, n);
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

export function badgePriorite(intent) {
  const p = lirePriorite(intent);
  if (p.priority === 'P0') return '<span class="badge badge-bad" title="P0 — urgent">P0</span>';
  if (p.priority === 'P1') return '<span class="badge badge-warn" title="P1 — important">P1</span>';
  if (p.priority === 'P2') return '<span class="badge badge-info" title="P2 — planifié">P2</span>';
  if (p.priority === 'P3' || p.priority === 'P4') return `<span class="badge badge-muted">${escape(p.priority)}</span>`;
  if (p.rice != null) return `<span class="badge badge-info" title="Score RICE">RICE ${p.rice}</span>`;
  if (p.wsjf != null) return `<span class="badge badge-info" title="Score WSJF">WSJF ${p.wsjf}</span>`;
  if (p.wave != null) return `<span class="badge badge-muted" title="Vague de déploiement">V${p.wave}</span>`;
  return '<span class="muted">—</span>';
}

// Clé numérique pour `data-sort` sur la colonne Priorité.
export function clePriorite(intent) {
  const p = lirePriorite(intent);
  if (p.priority) return PRIORITY_RANK[p.priority];
  if (p.rice != null) return 50 - p.rice / 100; // RICE 100 → 49 ; plus haut RICE → plus petit clé.
  if (p.wsjf != null) return 60 - p.wsjf;
  if (p.wave != null) return 70 + p.wave;
  return 99;
}

export function blocTopPriorites(donnees) {
  const top = topPriorites(donnees?.intents || [], 5);
  if (top.length === 0) return '';
  const rows = top.map((i) => `<tr>
    <td>${badgePriorite(i)}</td>
    <td>${i.file ? lienSource(i.file, i.id) : `<code>${escape(i.id)}</code>`}</td>
    <td><strong>${escape(i.titre || '')}</strong></td>
    <td class="muted">${escape(i.statut || '—')}</td>
  </tr>`).join('');
  return `<section>
    <h2>Top priorités à travailler <span class="count">${top.length}</span></h2>
    <p class="muted" style="font-size:.85rem">Pipeline ordonné par <code>priority</code> (P0&lt;P1&lt;…), puis RICE desc, WSJF desc, wave asc, mtime desc. Statuts <code>done</code> et <code>archived</code> exclus.</p>
    <table>
      <thead><tr><th>Prio</th><th>ID</th><th>Titre</th><th>Statut</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  lirePriorite as readPriority,
  comparerPriorite as comparePriority,
  ordonner as sortByPriority,
  topPriorites as topPriorities,
  badgePriorite as priorityBadge,
  clePriorite as priorityKey,
  blocTopPriorites as topPrioritiesSection,
};
