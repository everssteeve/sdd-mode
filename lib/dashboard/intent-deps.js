// AIAD SDD Mode — Dashboard : dépendances Intent (#434).
//
// Permet au PM de répondre « qu'est-ce qui bloque mes priorités ? » via
// le frontmatter `depends_on: [INTENT-X]` ou `blocked_by: [INTENT-Y]`.
//
// Calcule pour chaque Intent :
//   - bloquePar    : liste des Intents qu'il attend (`depends_on` du frontmatter)
//   - bloque       : liste des Intents qui le citent en `depends_on`
//   - bloqueActif  : true si bloquePar contient au moins un Intent non livré
//
// Détecte les cycles A→B→A et émet un signal d'alerte.
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const STATUTS_LIVRES = new Set(['done', 'archived']);

function lireListe(intent, ...alias) {
  for (const a of alias) {
    const v = intent?.[a];
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
    if (typeof v === 'string' && v.trim() !== '') {
      return v.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
    }
  }
  return [];
}

// Normalise un id en forme courte `INTENT-NNN` pour le matching (cohérent
// avec le matching court de `calculerAvancement` dans pm.js).
function normalise(id) {
  if (!id) return '';
  return String(id).trim().split('-').slice(0, 2).join('-');
}

// Construit le graphe de dépendances. Renvoie 2 maps indexées par id court
// (INTENT-NNN) → tableau d'ids longs.
export function construireGrapheDeps(intents) {
  const courtVersLong = new Map();
  for (const i of intents || []) {
    courtVersLong.set(normalise(i.id), i.id);
  }
  const bloquePar = new Map(); // id long → [id longs des Intents attendus]
  const bloque = new Map();     // id long → [id longs des Intents qui m'attendent]
  for (const i of intents || []) {
    const deps = [...lireListe(i, 'depends_on', 'dependsOn', 'depends'), ...lireListe(i, 'blocked_by', 'blockedBy')];
    const cibles = [];
    for (const d of deps) {
      const longId = courtVersLong.get(normalise(d));
      if (longId && longId !== i.id) cibles.push(longId);
    }
    bloquePar.set(i.id, cibles);
    for (const c of cibles) {
      if (!bloque.has(c)) bloque.set(c, []);
      bloque.get(c).push(i.id);
    }
  }
  return { bloquePar, bloque };
}

// Détection naïve de cycles via DFS. Retourne `[[A, B, A], …]` — chaque
// cycle est une chaîne de IDs.
export function detecterCycles(intents, graphe) {
  const { bloquePar } = graphe;
  const visites = new Set();
  const cycles = [];
  function dfs(id, chemin) {
    if (chemin.includes(id)) {
      const debut = chemin.indexOf(id);
      cycles.push([...chemin.slice(debut), id]);
      return;
    }
    if (visites.has(id)) return;
    visites.add(id);
    for (const next of bloquePar.get(id) || []) {
      dfs(next, [...chemin, id]);
    }
  }
  for (const i of intents || []) dfs(i.id, []);
  return cycles;
}

export function calculerDeps(donnees) {
  const intents = donnees?.intents || [];
  const graphe = construireGrapheDeps(intents);
  const statutsById = new Map(intents.map((i) => [i.id, i.statut]));
  const titresById = new Map(intents.map((i) => [i.id, i.titre || '']));
  const filesById = new Map(intents.map((i) => [i.id, i.file || null]));

  const enrichi = intents.map((i) => {
    const blocquants = graphe.bloquePar.get(i.id) || [];
    const blocques = graphe.bloque.get(i.id) || [];
    const blocquantsActifs = blocquants.filter((b) => !STATUTS_LIVRES.has(statutsById.get(b)));
    return {
      id: i.id,
      titre: i.titre || '',
      statut: i.statut,
      file: i.file || null,
      bloquePar: blocquants.map((b) => ({ id: b, titre: titresById.get(b) || '', statut: statutsById.get(b), file: filesById.get(b), livre: STATUTS_LIVRES.has(statutsById.get(b)) })),
      bloque: blocques.map((b) => ({ id: b, titre: titresById.get(b) || '', statut: statutsById.get(b), file: filesById.get(b) })),
      bloqueActif: blocquantsActifs.length > 0,
    };
  });
  const cycles = detecterCycles(intents, graphe);
  // Intents avec dépendances (sortantes ou entrantes) — pour pouvoir
  // filtrer le rendu sans afficher 30 Intents sans liens.
  const avecDeps = enrichi.filter((i) => i.bloquePar.length > 0 || i.bloque.length > 0);
  return {
    intents: enrichi,
    avecDeps,
    cycles,
    totaux: {
      avecDeps: avecDeps.length,
      bloquesActifs: enrichi.filter((i) => i.bloqueActif).length,
      cycles: cycles.length,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const DEPS_CSS = `<style>
.deps-card { padding:.5rem .7rem; margin:.4rem 0; border:1px solid var(--border, #ddd); border-radius:.35rem; background:var(--card-bg, #fff); font-size:.85rem; }
.deps-card.is-bloque { border-left:3px solid #e8590c; background:rgba(232,89,12,.04); }
.deps-card.is-cycle { border-left:3px solid #c92a2a; background:rgba(201,42,42,.05); }
.deps-row { margin:.2rem 0; }
.deps-row strong { font-size:.78rem; text-transform:uppercase; letter-spacing:.04em; color:var(--muted, #777); margin-right:.4rem; }
.deps-cycle-banner { padding:.6rem .8rem; background:rgba(201,42,42,.08); border-left:4px solid #c92a2a; border-radius:.25rem; font-size:.85rem; margin:.5rem 0; }
</style>`;

function ligneRef(ref, options = {}) {
  const idCell = ref.file ? lienSource(ref.file, ref.id) : `<code>${escape(ref.id)}</code>`;
  const statut = ref.statut ? `<span class="badge ${ref.livre ? 'badge-ok' : 'badge-warn'}" style="font-size:.7rem">${escape(ref.statut)}</span>` : '';
  const titre = options.titre && ref.titre ? ` — ${escape(ref.titre)}` : '';
  return `${idCell} ${statut}${titre}`;
}

export function blocIntentDeps(donnees) {
  const d = donnees?.intentDeps;
  if (!d) return '';
  if (d.totaux.avecDeps === 0 && d.totaux.cycles === 0) {
    return '';
  }
  const banniereCycle = d.cycles.length > 0
    ? `<div class="deps-cycle-banner"><strong>⚠ ${d.cycles.length} cycle(s) détecté(s)</strong> — chaîne(s) :<br>${d.cycles.slice(0, 3).map((c) => c.map((id) => `<code>${escape(id)}</code>`).join(' → ')).join('<br>')}</div>`
    : '';
  const cartes = d.avecDeps.slice(0, 12).map((i) => {
    const cls = i.bloqueActif ? 'is-bloque' : '';
    const idCell = i.file ? lienSource(i.file, i.id) : `<code>${escape(i.id)}</code>`;
    const bloquePar = i.bloquePar.length > 0
      ? `<div class="deps-row"><strong>Bloqué par</strong>${i.bloquePar.map((b) => ligneRef(b, { titre: true })).join(' · ')}</div>`
      : '';
    const bloque = i.bloque.length > 0
      ? `<div class="deps-row"><strong>Bloque</strong>${i.bloque.map((b) => ligneRef(b)).join(' · ')}</div>`
      : '';
    return `<div class="deps-card ${cls}">
      <div><strong style="font-size:.95rem">${idCell}</strong> — ${escape(i.titre)} <span class="muted">(${escape(i.statut || '?')})</span></div>
      ${bloquePar}
      ${bloque}
    </div>`;
  }).join('');
  return `${DEPS_CSS}<section>
    <h2>Dépendances Intent <span class="count">${d.totaux.avecDeps} avec liens · ${d.totaux.bloquesActifs} bloqué(s) actif(s)${d.totaux.cycles > 0 ? ` · ${d.totaux.cycles} cycle(s)` : ''}</span></h2>
    <p class="muted" style="font-size:.85rem">Liens lus depuis les frontmatters <code>depends_on:</code> / <code>blocked_by:</code>. Un Intent est <strong>bloqué actif</strong> si au moins une de ses dépendances n'est pas encore <code>done</code>/<code>archived</code>.</p>
    ${banniereCycle}
    ${cartes}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  construireGrapheDeps as buildDependencyGraph,
  detecterCycles as detectCycles,
  calculerDeps as computeIntentDependencies,
  blocIntentDeps as intentDependenciesSection,
};
