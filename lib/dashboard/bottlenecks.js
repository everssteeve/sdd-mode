// AIAD SDD Mode — Dashboard : détection de goulots (#436).
//
// Le PM doit voir « qu'est-ce qui ralentit mon pipeline ? » : trop de
// SPECs en review depuis longtemps, trop d'Intents en draft empilés,
// WIP excessif sur un statut donné.
//
// Heuristique : un statut est un goulot si (a) compteur ≥ seuil ET (b) au
// moins une entrée a un mtime > seuilJours. Seuils par défaut adaptés
// aux équipes Product Engineering (cf. PRD AIAD).
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const JOUR_MS = 24 * 3600 * 1000;

export const SEUILS_DEFAUT = Object.freeze({
  // Statut SPEC : { count: N items, age: jours }
  intent: {
    draft: { count: 5, age: 14 },
    active: { count: 8, age: 30 },
  },
  spec: {
    draft: { count: 5, age: 7 },
    ready: { count: 5, age: 14 },
    review: { count: 3, age: 7 },
    'in-progress': { count: 4, age: 14 },
    validation: { count: 3, age: 7 },
  },
});

function jours(ms) { return Math.round(ms / JOUR_MS); }

// Détecte les goulots dans un dictionnaire items par statut.
function detecterGoulots(items, seuilsType, now) {
  const parStatut = new Map();
  for (const it of items) {
    const s = it.statut || 'unknown';
    if (!parStatut.has(s)) parStatut.set(s, []);
    parStatut.get(s).push(it);
  }
  const out = [];
  for (const [statut, liste] of parStatut) {
    const seuil = seuilsType[statut];
    if (!seuil) continue;
    if (liste.length < seuil.count) continue;
    const itemsAges = liste.filter((it) => it.mtime && (now - it.mtime) > seuil.age * JOUR_MS);
    if (itemsAges.length === 0) continue; // count ok mais récents → pas goulot
    out.push({
      statut,
      total: liste.length,
      seuilCount: seuil.count,
      seuilAge: seuil.age,
      itemsAges: itemsAges
        .sort((a, b) => (a.mtime || 0) - (b.mtime || 0))
        .map((it) => ({
          id: it.id,
          titre: it.titre || '',
          file: it.file || null,
          ageJours: jours(now - (it.mtime || now)),
        })),
    });
  }
  return out.sort((a, b) => b.total - a.total);
}

export function calculerBottlenecks(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const seuils = options.seuils || SEUILS_DEFAUT;
  const intents = detecterGoulots(donnees?.intents || [], seuils.intent || {}, now);
  const specs = detecterGoulots(donnees?.specs || [], seuils.spec || {}, now);
  const total = intents.length + specs.length;
  return { intents, specs, total, seuils };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const BOTTLENECK_CSS = `<style>
.bottleneck-card { padding:.55rem .75rem; margin:.4rem 0; border-left:4px solid #e8590c; background:rgba(232,89,12,.05); border-radius:.25rem; font-size:.85rem; }
.bottleneck-card-head { display:flex; align-items:baseline; gap:.5rem; flex-wrap:wrap; }
.bottleneck-card-head strong { font-size:.92rem; }
.bottleneck-items { margin:.3rem 0 0; padding-left: 1.1rem; font-size:.78rem; }
.bottleneck-items li { margin:.1rem 0; }
</style>`;

function carteGoulot(type, g) {
  const items = g.itemsAges.slice(0, 6).map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    return `<li>${idCell} ${escape(it.titre)} <span class="muted">(${it.ageJours}j)</span></li>`;
  }).join('');
  return `<div class="bottleneck-card">
    <div class="bottleneck-card-head">
      <strong>${escape(type)} en ${escape(g.statut)}</strong>
      <span class="badge badge-warn">${g.total} items · ${g.itemsAges.length} > ${g.seuilAge}j</span>
      <span class="muted">seuil ${g.seuilCount} / ${g.seuilAge}j</span>
    </div>
    <ul class="bottleneck-items">${items}</ul>
  </div>`;
}

export function blocBottlenecks(donnees) {
  const b = donnees?.bottlenecks;
  if (!b) return '';
  if (b.total === 0) {
    return `<section>
      <h2>Goulots d'étranglement <span class="count">aucun</span></h2>
      <p class="muted">Aucun statut Intent/SPEC ne dépasse simultanément ses seuils <em>compteur</em> et <em>âge</em>. Le pipeline avance.</p>
    </section>`;
  }
  const intents = b.intents.map((g) => carteGoulot('Intents', g)).join('');
  const specs = b.specs.map((g) => carteGoulot('SPECs', g)).join('');
  return `${BOTTLENECK_CSS}<section>
    <h2>Goulots d'étranglement <span class="count">${b.total} détecté(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Un statut est signalé "goulot" si le nombre d'items dépasse le seuil ET au moins un item est plus ancien que le seuil d'âge. Seuils par défaut : <code>intent.draft &gt;= 5 / 14j</code> · <code>spec.review &gt;= 3 / 7j</code> · etc.</p>
    ${intents}
    ${specs}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerBottlenecks as computeBottlenecks,
  blocBottlenecks as bottlenecksSection,
  SEUILS_DEFAUT as DEFAULT_THRESHOLDS,
};
