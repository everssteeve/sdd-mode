// AIAD SDD Mode — Dashboard : persona × outcome coverage matrix (#519).
//
// Heatmap croisant les **personas du PRD** (#3) et les **outcomes du PRD**
// (#4) pour identifier les zones blanches : "quel persona n'a aucun
// outcome servi par un Intent ?".
//
// Sources :
//   - `donnees.prdCoverage.personas` (#423)
//   - `donnees.prdCoverage.outcomes` (#428)
//   - Croisement via Intents (chaque outcome.intents[].id × intent.personas)
//
// Politique :
//   - Cellule = nb d'Intents qui servent à la fois ce persona ET cet outcome
//   - Couleur progressive vert clair → vert foncé selon densité
//   - Zone blanche = trou de couverture
//
// Pure transformation.

function indexerIntentsParPersona(donnees) {
  const m = new Map();
  for (const i of (donnees?.intents || [])) {
    const personas = Array.isArray(i.personas) ? i.personas
      : (typeof i.personas === 'string' ? [i.personas] : []);
    for (const p of personas) {
      const cle = String(p).trim().toLowerCase();
      if (!cle) continue;
      if (!m.has(cle)) m.set(cle, new Set());
      m.get(cle).add(i.id);
    }
  }
  return m;
}

export function calculerPersonaOutcomeMatrix(donnees) {
  const personas = donnees?.prdCoverage?.personas?.personas || [];
  const outcomes = donnees?.prdCoverage?.outcomes || [];
  const intentsParPersona = indexerIntentsParPersona(donnees);
  // Matrice : { personaNom, cellules: [{ outcomeTitre, count, intents: [...] }] }
  const lignes = personas.map((p) => {
    const personaCle = (p.nom || '').toLowerCase();
    const intentsPersona = intentsParPersona.get(personaCle) || new Set();
    const cellules = outcomes.map((o) => {
      const intentsOutcome = new Set((o.intents || []).map((x) => x.id));
      const intersection = [...intentsPersona].filter((id) => intentsOutcome.has(id));
      return {
        outcomeTitre: o.titre || o.label || '?',
        count: intersection.length,
        intents: intersection.slice(0, 3),
      };
    });
    const total = cellules.reduce((s, c) => s + c.count, 0);
    return { personaNom: p.nom || '?', total, cellules };
  });
  const totaux = {
    personas: lignes.length,
    outcomes: outcomes.length,
    cellulesActives: lignes.reduce((s, l) => s + l.cellules.filter((c) => c.count > 0).length, 0),
    cellulesBlanches: lignes.reduce((s, l) => s + l.cellules.filter((c) => c.count === 0).length, 0),
    personasSansCouverture: lignes.filter((l) => l.total === 0).length,
  };
  return { lignes, outcomes, totaux };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const POM_CSS = `<style>
.pom-table { width:100%; border-collapse:collapse; font-size:.8rem; margin:.5rem 0; }
.pom-table th, .pom-table td { padding:.35rem .4rem; border:1px solid var(--border, #eee); text-align:center; }
.pom-table th.persona-h, .pom-table td.persona-c { text-align:left; }
.pom-cell { display:inline-block; width:32px; height:24px; line-height:24px; border-radius:.18rem; font-size:.78rem; }
.pom-cell.c-0 { background:rgba(127,127,127,.07); color:var(--muted, #aaa); }
.pom-cell.c-1 { background:rgba(43,138,62,.15); color:#1c5a2a; }
.pom-cell.c-2 { background:rgba(43,138,62,.3); color:#1c5a2a; }
.pom-cell.c-many { background:rgba(43,138,62,.5); color:#fff; font-weight:600; }
.pom-meta { padding:.4rem .55rem; background:rgba(127,127,127,.05); border-radius:.25rem; font-size:.85rem; margin:.3rem 0; }
.pom-meta.has-trou { background:rgba(232,89,12,.06); border-left:3px solid #e8590c; }
.pom-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
</style>`;

function cellClass(n) {
  if (n === 0) return 'c-0';
  if (n === 1) return 'c-1';
  if (n === 2) return 'c-2';
  return 'c-many';
}

export function blocPersonaOutcomeMatrix(donnees) {
  const m = donnees?.personaOutcomeMatrix;
  if (!m) return '';
  if (m.lignes.length === 0 || m.outcomes.length === 0) {
    return `${POM_CSS}<section>
      <h2>Matrice persona × outcome <span class="count">matrice vide</span></h2>
      <div class="pom-empty">La matrice nécessite des <strong>personas</strong> (PRD §3) ET des <strong>outcomes</strong> (PRD §4) déclarés, plus des Intents rattachés via <code>personas: [...]</code> et présents dans les outcomes (#428). Enrichir le PRD pour activer ce croisement.</div>
    </section>`;
  }
  const t = m.totaux;
  const headers = m.outcomes.map((o) => `<th title="${escape(o.titre || '?')}">${escape((o.titre || '?').slice(0, 16))}</th>`).join('');
  const rows = m.lignes.map((l) => {
    const cells = l.cellules.map((c) => `<td><span class="pom-cell ${cellClass(c.count)}" title="${escape(l.personaNom)} × ${escape(c.outcomeTitre)} : ${c.count} Intent(s)">${c.count}</span></td>`).join('');
    return `<tr>
      <td class="persona-c"><strong>${escape(l.personaNom)}</strong> <span class="muted-cell">(${l.total} Intent(s))</span></td>
      ${cells}
    </tr>`;
  }).join('');
  const meta = t.personasSansCouverture > 0
    ? `<div class="pom-meta has-trou">⚠ <strong>${t.personasSansCouverture} persona(s) sans couverture</strong> — aucun Intent rattaché qui sert un outcome. Vérifier que les Intents ont bien <code>personas: [...]</code>.</div>`
    : `<div class="pom-meta">✓ Tous les personas ont au moins 1 Intent servant un outcome — ${t.cellulesActives}/${t.cellulesActives + t.cellulesBlanches} cellules actives.</div>`;
  return `${POM_CSS}<section>
    <h2>Matrice persona × outcome <span class="count">${t.personas} persona(s) × ${t.outcomes} outcome(s) — ${t.cellulesActives} cellule(s) active(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Heatmap croisant personas du PRD §3 × outcomes du PRD §4. Cellule = nb d'Intents qui servent à la fois ce persona ET cet outcome. Zone blanche = trou de couverture à combler.</p>
    ${meta}
    <table class="pom-table">
      <thead><tr><th class="persona-h">Persona / Outcome</th>${headers}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerPersonaOutcomeMatrix as computePersonaOutcomeMatrix,
  blocPersonaOutcomeMatrix as personaOutcomeMatrixSection,
};
