// AIAD SDD Mode — Dashboard : cross-Intent SPEC reuse detector (#517).
//
// Détecte les SPECs qui mentionnent plusieurs Intents (via frontmatter
// `intents:` array, ou body Markdown contenant N motifs `INTENT-NNN`).
// Une SPEC qui sert plusieurs Intents est un signal :
//   - Soit elle est réellement transverse (correct, à valoriser)
//   - Soit elle est mal scopée (cassée, à découper)
//
// Politique :
//   - Source primaire : frontmatter `intents: [INTENT-X, INTENT-Y]`
//   - Source secondaire : SPEC ID matche un parentIntent + mentions
//     dans le titre ou résumé d'autres `INTENT-NNN` distincts
//   - SPEC croisée = ≥ 2 Intents distincts référencés
//
// Pure transformation.

function lireIntentsListe(spec) {
  const v = spec?.intents || spec?.Intents;
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  return [];
}

function normaliseCourt(id) {
  if (!id) return '';
  return String(id).trim().split('-').slice(0, 2).join('-');
}

export function calculerSpecCrossIntent(donnees) {
  const idsExistants = new Set((donnees?.intents || []).map((i) => normaliseCourt(i.id)));
  const items = [];
  for (const s of donnees?.specs || []) {
    const refsExplicite = lireIntentsListe(s).map(normaliseCourt);
    const parent = s.parentIntent ? normaliseCourt(s.parentIntent) : null;
    const refsSet = new Set();
    if (parent) refsSet.add(parent);
    for (const r of refsExplicite) refsSet.add(r);
    // Filtre uniquement Intents existants
    const refsValides = [...refsSet].filter((r) => idsExistants.has(r));
    if (refsValides.length >= 2) {
      items.push({
        id: s.id,
        titre: s.titre || '',
        file: s.file || null,
        statut: s.statut,
        parent,
        intentsAdditionnels: refsValides.filter((r) => r !== parent),
        nbIntents: refsValides.length,
        refs: refsValides,
      });
    }
  }
  items.sort((a, b) => b.nbIntents - a.nbIntents);
  return {
    items,
    totaux: {
      specs: items.length,
      totalSpecs: (donnees?.specs || []).length,
      maxIntentsCroises: items[0]?.nbIntents || 0,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const SCI_CSS = `<style>
.sci-card { padding:.5rem .65rem; margin:.3rem 0; border-radius:.3rem; background:rgba(127,127,127,.04); border-left:3px solid #4c6ef5; }
.sci-card.warn { border-left-color:#e8590c; background:rgba(232,89,12,.04); }
.sci-head { font-weight:600; display:flex; gap:.4rem; align-items:baseline; flex-wrap:wrap; font-size:.85rem; }
.sci-refs { font-size:.78rem; color:var(--muted, #777); margin-top:.2rem; }
.sci-tag { padding:.05rem .35rem; background:rgba(76,110,245,.1); color:#3a4cba; border-radius:.18rem; font-size:.72rem; margin-right:.15rem; }
.sci-tag.parent { background:rgba(43,138,62,.12); color:#1c5a2a; }
.sci-empty { padding:.5rem .7rem; background:rgba(43,138,62,.06); border-left:3px solid #2b8a3e; border-radius:.25rem; font-size:.85rem; color:#1c5a2a; }
@media (prefers-color-scheme: dark) { .sci-tag.parent { color:#68d391; } .sci-empty { color:#68d391; } }
:root[data-theme="dark"] .sci-tag.parent { color:#68d391; }
:root[data-theme="dark"] .sci-empty { color:#68d391; }
</style>`;

export function blocSpecCrossIntent(donnees) {
  const c = donnees?.specCrossIntent;
  if (!c) return '';
  if (c.items.length === 0) {
    return `${SCI_CSS}<section>
      <h2>SPECs transverses <span class="count">aucune SPEC croisée</span></h2>
      <div class="sci-empty">✓ Toutes les SPECs sont rattachées à un seul Intent — scoping propre. Si une SPEC est volontairement transverse, déclarer plusieurs Intents via frontmatter <code>intents: [INTENT-X, INTENT-Y]</code>.</div>
    </section>`;
  }
  const t = c.totaux;
  const cards = c.items.slice(0, 12).map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    const parentChip = it.parent ? `<span class="sci-tag parent">parent ${escape(it.parent)}</span>` : '';
    const otherChips = it.intentsAdditionnels.map((r) => `<span class="sci-tag">${escape(r)}</span>`).join('');
    const warn = it.nbIntents >= 3 ? 'warn' : '';
    return `<div class="sci-card ${warn}">
      <div class="sci-head">
        <strong>${idCell}</strong>
        <span>${escape((it.titre || '').slice(0, 60))}</span>
        <span class="sci-tag">[${escape(it.statut || '?')}]</span>
        <span class="sci-tag" style="background:rgba(127,127,127,.1); color:inherit">${it.nbIntents} Intents</span>
      </div>
      <div class="sci-refs">${parentChip}${otherChips}</div>
    </div>`;
  }).join('');
  return `${SCI_CSS}<section>
    <h2>SPECs transverses <span class="count">${t.specs} SPEC(s) sur ${t.totalSpecs} — max ${t.maxIntentsCroises} Intents croisés</span></h2>
    <p class="muted" style="font-size:.85rem">SPECs qui référencent plusieurs Intents (frontmatter <code>intents: [...]</code> ou parent + mentions). Une SPEC transverse peut être un point de couplage à découper, ou un travail réellement partagé à valoriser.</p>
    <div>${cards}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerSpecCrossIntent as computeSpecCrossIntent,
  blocSpecCrossIntent as specCrossIntentSection,
};
