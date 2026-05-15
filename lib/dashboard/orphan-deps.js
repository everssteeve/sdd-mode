// AIAD SDD Mode — Dashboard : orphan dependencies detector (#511).
//
// Détecte les références `depends_on:` ou `blocked_by:` du frontmatter
// vers des Intent IDs **qui n'existent pas dans le projet**. Surface 2
// types de problèmes :
//   - Orphan : INTENT-X dépend de INTENT-Z mais INTENT-Z absent
//   - Self-loop : INTENT-X dépend de lui-même
//
// Ces erreurs proviennent souvent de :
//   - Typo dans l'ID (INTENT-110 au lieu de INTENT-101)
//   - Intent jamais créé après mention
//   - Archivage sans nettoyage des dépendances
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

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

function normalise(id) {
  if (!id) return '';
  return String(id).trim().split('-').slice(0, 2).join('-');
}

export function calculerOrphanDeps(donnees) {
  const intents = donnees?.intents || [];
  // Index des IDs courts existants.
  const idsExistants = new Set(intents.map((i) => normalise(i.id)));
  const orphelins = [];
  const selfLoops = [];
  for (const i of intents) {
    const idCourt = normalise(i.id);
    const deps = lireListe(i, 'depends_on', 'dependsOn', 'blocked_by', 'blockedBy');
    for (const ref of deps) {
      const refCourt = normalise(ref);
      if (refCourt === idCourt) {
        selfLoops.push({ id: i.id, titre: i.titre || '', file: i.file || null, ref });
      } else if (!idsExistants.has(refCourt)) {
        orphelins.push({ id: i.id, titre: i.titre || '', file: i.file || null, ref });
      }
    }
  }
  return {
    orphelins,
    selfLoops,
    totaux: {
      total: orphelins.length + selfLoops.length,
      orphelins: orphelins.length,
      selfLoops: selfLoops.length,
      intentsConcernes: new Set([...orphelins.map((o) => o.id), ...selfLoops.map((s) => s.id)]).size,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const OD_CSS = `<style>
.od-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:.4rem; margin:.4rem 0; }
.od-stat { padding:.4rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.od-stat .od-val { font-size:1.2rem; font-weight:700; }
.od-stat .od-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.od-stat.has-issue { background:rgba(201,42,42,.07); border-color:rgba(201,42,42,.3); }
.od-row { padding:.35rem .5rem; margin:.2rem 0; font-size:.82rem; border-radius:.25rem; }
.od-row.t-orphelin { border-left:3px solid #c92a2a; background:rgba(201,42,42,.04); }
.od-row.t-self { border-left:3px solid #e8590c; background:rgba(232,89,12,.04); }
.od-meta { font-size:.74rem; color:var(--muted, #777); }
.od-clean { padding:.5rem .7rem; background:rgba(43,138,62,.06); border-left:3px solid #2b8a3e; border-radius:.25rem; font-size:.85rem; color:#1c5a2a; }
</style>`;

export function blocOrphanDeps(donnees) {
  const o = donnees?.orphanDeps;
  if (!o) return '';
  const t = o.totaux;
  if (t.total === 0) {
    return `${OD_CSS}<section>
      <h2>Dépendances orphelines <span class="count">graphe propre</span></h2>
      <div class="od-clean">✓ Toutes les dépendances <code>depends_on:</code> / <code>blocked_by:</code> pointent vers des Intents existants. Aucun self-loop détecté.</div>
    </section>`;
  }
  const grid = [
    `<div class="od-stat has-issue"><div class="od-val">${t.orphelins}</div><div class="od-label">Dépendances orphelines</div></div>`,
    `<div class="od-stat has-issue"><div class="od-val">${t.selfLoops}</div><div class="od-label">Self-loops</div></div>`,
    `<div class="od-stat"><div class="od-val">${t.intentsConcernes}</div><div class="od-label">Intent(s) concernés</div></div>`,
  ].join('');
  const rowsOrph = o.orphelins.slice(0, 10).map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    return `<div class="od-row t-orphelin">
      <strong>${idCell}</strong> <span class="od-meta">${escape((it.titre || '').slice(0, 50))}</span>
      <br><span class="od-meta">→ référence inexistante : <code>${escape(it.ref)}</code></span>
    </div>`;
  }).join('');
  const rowsSelf = o.selfLoops.slice(0, 6).map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    return `<div class="od-row t-self">
      <strong>${idCell}</strong> <span class="od-meta">${escape((it.titre || '').slice(0, 50))}</span>
      <br><span class="od-meta">→ se dépend de lui-même : <code>${escape(it.ref)}</code></span>
    </div>`;
  }).join('');
  return `${OD_CSS}<section>
    <h2>Dépendances orphelines <span class="count">${t.total} problème(s) sur ${t.intentsConcernes} Intent(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Détecte les références <code>depends_on:</code> / <code>blocked_by:</code> du frontmatter qui pointent vers un Intent <strong>inexistant</strong> (typo ou jamais créé) ou un <strong>self-loop</strong>. À nettoyer pour garder le graphe Intent cohérent.</p>
    <div class="od-grid">${grid}</div>
    ${rowsOrph}
    ${rowsSelf}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerOrphanDeps as computeOrphanDeps,
  blocOrphanDeps as orphanDepsSection,
};
