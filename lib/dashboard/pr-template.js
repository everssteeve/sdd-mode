// AIAD SDD Mode — Dashboard : PR description template generator (#539).
//
// Génère un template Markdown de **description de PR** pré-rempli
// avec :
//   - Référence à l'Intent + SPEC parent (annotations v1.10)
//   - Sections : Summary, Changes, Test plan, Drift Lock
//   - Gouvernance Tier 1 si pertinent
//
// Génère un template par Intent actif "en cours de livraison" (avec
// SPEC done ou in-progress).
//
// Pure transformation.

const STATUTS_LIVRABLES = new Set(['done', 'in-progress', 'review', 'validation']);

function lireGouvernance(intent) {
  const v = intent?.governance || intent?.Governance;
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  return [];
}

function genererPourIntent(intent, specsLies) {
  const gouvs = lireGouvernance(intent);
  const courtIntent = intent.id.split('-').slice(0, 2).join('-');
  const specsActives = specsLies.filter((s) => STATUTS_LIVRABLES.has(s.statut));
  const lignes = [];
  lignes.push(`## Summary`);
  lignes.push(`Implémente **${intent.titre || intent.id}** (${courtIntent}).`);
  lignes.push('');
  if (intent.sections?.objectif) {
    lignes.push(`**Objectif** : ${intent.sections.objectif.slice(0, 200).replace(/\n+/g, ' ').trim()}`);
    lignes.push('');
  }
  lignes.push('## Changes');
  if (specsActives.length > 0) {
    for (const s of specsActives) lignes.push(`- ${s.id}${s.titre ? ' — ' + s.titre : ''} [${s.statut}]`);
  } else {
    lignes.push('- _(à compléter)_');
  }
  lignes.push('');
  lignes.push('## Test plan');
  lignes.push('- [ ] Tests unitaires passent (`npm test`)');
  lignes.push('- [ ] `npx aiad-sdd trace` ne signale aucun gap nouveau');
  lignes.push('- [ ] Validation manuelle du flow utilisateur');
  if (gouvs.length > 0) {
    lignes.push('');
    lignes.push('## Conformité Tier 1');
    for (const g of gouvs) lignes.push(`- [ ] ${g} : critères vérifiés`);
  }
  lignes.push('');
  lignes.push('## Drift Lock');
  lignes.push(`Annotations attendues dans le code applicatif :`);
  lignes.push('```');
  lignes.push(`@intent ${courtIntent}`);
  if (specsActives[0]) lignes.push(`@spec ${specsActives[0].id}`);
  lignes.push(`@verified-by tests/<chemin>.test.js`);
  if (gouvs.length > 0) lignes.push(`@governance ${gouvs.join(',')}`);
  lignes.push('```');
  return lignes.join('\n');
}

export function calculerPrTemplate(donnees) {
  const specsParCourt = new Map();
  for (const s of donnees?.specs || []) {
    if (!s.parentIntent) continue;
    const court = String(s.parentIntent).split('-').slice(0, 2).join('-');
    if (!specsParCourt.has(court)) specsParCourt.set(court, []);
    specsParCourt.get(court).push(s);
  }
  const templates = [];
  for (const i of donnees?.intents || []) {
    if (i.statut !== 'active' && i.statut !== 'in-progress') continue;
    const court = i.id.split('-').slice(0, 2).join('-');
    const specs = specsParCourt.get(court) || [];
    if (specs.length === 0) continue;
    templates.push({
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      texte: genererPourIntent(i, specs),
      gouvernances: lireGouvernance(i),
      nbSpecs: specs.length,
    });
  }
  templates.sort((a, b) => b.nbSpecs - a.nbSpecs);
  return {
    templates: templates.slice(0, 10),
    totaux: {
      total: templates.length,
      avecGouv: templates.filter((t) => t.gouvernances.length > 0).length,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const PT_CSS = `<style>
.pt-card { padding:.55rem .7rem; margin:.3rem 0; border-radius:.35rem; background:rgba(127,127,127,.04); border-left:3px solid #4c6ef5; }
.pt-card.has-gouv { border-left-color:#c92a2a; background:rgba(201,42,42,.04); }
.pt-head { display:flex; gap:.4rem; align-items:baseline; flex-wrap:wrap; }
.pt-pre { padding:.5rem .65rem; background:rgba(127,127,127,.05); border-radius:.25rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:.78rem; white-space:pre-wrap; user-select:all; max-height:240px; overflow:auto; margin:.3rem 0; }
.pt-actions { display:flex; gap:.4rem; margin:.2rem 0; }
.pt-btn { padding:.2rem .55rem; background:transparent; border:1px solid var(--border, #ccc); border-radius:.2rem; cursor:pointer; font-size:.74rem; color:inherit; }
.pt-btn:hover { background:rgba(127,127,127,.06); }
.pt-tag { padding:.05rem .35rem; background:rgba(127,127,127,.1); border-radius:.18rem; font-size:.7rem; }
.pt-tag.gouv { background:rgba(201,42,42,.12); color:#7a1717; }
.pt-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
</style>`;

const PT_SCRIPT = `<script>
(function () {
  function init() {
    document.querySelectorAll('[data-pt-action=copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = document.getElementById(btn.getAttribute('data-target'));
        if (!target) return;
        navigator.clipboard.writeText(target.textContent).then(function () {
          var orig = btn.textContent;
          btn.textContent = '✓ Copié';
          setTimeout(function () { btn.textContent = orig; }, 1500);
        });
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>`;

export function blocPrTemplate(donnees) {
  const p = donnees?.prTemplate;
  if (!p) return '';
  if (p.templates.length === 0) {
    return `${PT_CSS}<section>
      <h2>Templates PR par Intent <span class="count">aucun Intent actif avec SPEC</span></h2>
      <div class="pt-empty">Génère un template Markdown de description PR pour chaque Intent actif/in-progress qui a au moins 1 SPEC liée. Annotations v1.10 (<code>@intent</code>/<code>@spec</code>/<code>@verified-by</code>/<code>@governance</code>) pré-remplies.</div>
    </section>`;
  }
  const cards = p.templates.map((t, idx) => {
    const cleId = `aiad-pt-${idx}`;
    const idCell = t.file ? lienSource(t.file, t.id) : `<code>${escape(t.id)}</code>`;
    const gouvs = t.gouvernances.map((g) => `<span class="pt-tag gouv">${escape(g)}</span>`).join('');
    return `<div class="pt-card ${t.gouvernances.length > 0 ? 'has-gouv' : ''}">
      <div class="pt-head">
        ${idCell}
        <strong>${escape((t.titre || '').slice(0, 60))}</strong>
        <span class="pt-tag">${t.nbSpecs} SPEC(s)</span>
        ${gouvs}
      </div>
      <div class="pt-actions">
        <button type="button" class="pt-btn" data-pt-action="copy" data-target="${cleId}">📋 Copier le template</button>
      </div>
      <div class="pt-pre" id="${cleId}">${escape(t.texte)}</div>
    </div>`;
  }).join('');
  return `${PT_CSS}<section>
    <h2>Templates PR par Intent <span class="count">${p.totaux.total} Intent(s) — ${p.totaux.avecGouv} avec gouvernance Tier 1</span></h2>
    <p class="muted" style="font-size:.85rem">Génère un template Markdown de description PR pré-rempli par Intent actif/in-progress avec ≥ 1 SPEC liée. Annotations v1.10 (<code>@intent</code>/<code>@spec</code>/<code>@verified-by</code>/<code>@governance</code>) + checkboxes test plan + Drift Lock + conformité Tier 1 si pertinent. Bouton 📋 copie via <code>navigator.clipboard</code>.</p>
    <div>${cards}</div>
  </section>${PT_SCRIPT}`;
}

// Alias EN canoniques (#42)
export {
  calculerPrTemplate as computePrTemplate,
  blocPrTemplate as prTemplateSection,
};
