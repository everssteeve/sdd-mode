// AIAD SDD Mode — Dashboard : préparation démo bi-hebdo (#429).
//
// Le rituel `/aiad demo` est central pour le PM : il doit lister ce qui
// est démontrable depuis la dernière démo et en sortir un script. Avant
// #429, le widget existant (#137) listait les SPECs `done` non démontrées
// mais ne fournissait pas (a) la liste des Intents passés à `done` dans
// le même intervalle, ni (b) un script Markdown copy-paste prêt pour la
// session démo.
//
// Aucun effet de bord. Pure transformation `donnees → readiness`.
//
// Documentation : https://aiad.ovh

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Lit le mtime de la dernière démo enregistrée — réutilise la convention
// `.aiad/metrics/demo/YYYY-MM-DD-*.md` posée par `/aiad demo`. Renvoie
// `null` si jamais aucune démo n'a été tenue (le PM doit tout démontrer).
export function lastDemoMtime(racineProjet) {
  const dir = join(racineProjet, '.aiad', 'metrics', 'demo');
  if (!existsSync(dir)) return null;
  let max = 0;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.md')) continue;
    try {
      const ts = statSync(join(dir, f)).mtimeMs;
      if (ts > max) max = ts;
    } catch { /* fichier disparu */ }
  }
  return max || null;
}

// Pour chaque Intent passé à `done` ou `archived` après la dernière démo,
// listing avec son avancement SPECs. Sert au PM pour annoncer en démo
// "voici l'Intent INTENT-101 qui a été livré ce sprint".
export function intentsDemontrables(donnees, lastDemo) {
  const out = [];
  for (const i of donnees?.intents || []) {
    if (!['done', 'archived'].includes(i.statut)) continue;
    if (lastDemo != null && i.mtime != null && i.mtime < lastDemo) continue;
    out.push({
      id: i.id,
      titre: i.titre || '',
      statut: i.statut,
      file: i.file || null,
      mtime: i.mtime || null,
    });
  }
  return out.sort((a, b) => (a.mtime || 0) - (b.mtime || 0));
}

// SPECs `done` après la dernière démo (réutilise la logique #137 mais on
// la duplique localement pour éviter une dépendance circulaire pm.js→
// demo-readiness.js→pm.js).
export function specsDemontrables(donnees, lastDemo) {
  const out = [];
  for (const s of donnees?.specs || []) {
    if (s.statut !== 'done') continue;
    if (!s.mtime) continue;
    if (lastDemo != null && s.mtime < lastDemo) continue;
    out.push({
      id: s.id,
      titre: s.titre || '',
      file: s.file || null,
      mtime: s.mtime,
      parentIntent: s.parentIntent || null,
    });
  }
  return out.sort((a, b) => (a.mtime || 0) - (b.mtime || 0));
}

export function calculerDemoReadiness(racineProjet, donnees) {
  const lastDemo = lastDemoMtime(racineProjet);
  const intents = intentsDemontrables(donnees, lastDemo);
  const specs = specsDemontrables(donnees, lastDemo);
  return {
    lastDemo,
    intents,
    specs,
    total: intents.length + specs.length,
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

function dateFr(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('fr-FR');
}

// Génère un script Markdown copy-paste avec les Intents + SPECs démontrables.
// Inséré dans un `<pre>` avec `user-select:all` côté CSS pour copie 1 clic.
function scriptMarkdown(readiness, projetNom) {
  const date = new Date().toISOString().slice(0, 10);
  const lignes = [`# Démo ${escape(projetNom || 'projet')} — ${date}`, ''];
  if (readiness.lastDemo) {
    lignes.push(`Période : depuis ${new Date(readiness.lastDemo).toISOString().slice(0, 10)}.`);
    lignes.push('');
  } else {
    lignes.push('Période : depuis l\'origine du projet (aucune démo enregistrée).');
    lignes.push('');
  }
  if (readiness.intents.length > 0) {
    lignes.push('## Intents livrés');
    lignes.push('');
    for (const i of readiness.intents) {
      lignes.push(`- ${i.id} — ${i.titre || ''} (${i.statut})`);
    }
    lignes.push('');
  }
  if (readiness.specs.length > 0) {
    lignes.push('## SPECs done');
    lignes.push('');
    for (const s of readiness.specs) {
      const parent = s.parentIntent ? ` ← ${s.parentIntent}` : '';
      lignes.push(`- ${s.id} — ${s.titre || ''}${parent}`);
    }
    lignes.push('');
  }
  lignes.push('---');
  lignes.push('_Préparé via dashboard PM — /aiad demo pour clore le rituel._');
  return lignes.join('\n');
}

const DEMO_CSS = `<style>
.demo-checklist { display:grid; gap:.5rem; margin:.5rem 0 1rem; }
.demo-item { display:flex; align-items:center; gap:.5rem; padding:.4rem .6rem; background:rgba(127,127,127,.05); border-radius:.25rem; font-size:.85rem; }
.demo-item input[type="checkbox"] { width:1rem; height:1rem; flex-shrink:0; }
.demo-item label { flex:1; cursor:pointer; }
.demo-item.is-checked label { opacity:.55; text-decoration: line-through; }
.demo-script { background:rgba(127,127,127,.08); padding:.75rem; border-radius:.25rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:.78rem; user-select: all; white-space: pre-wrap; max-height: 240px; overflow:auto; border:1px solid var(--border, #ddd); }
</style>`;

export function blocDemoReadiness(donnees) {
  const r = donnees?.demoReadiness;
  if (!r) return '';
  if (r.total === 0) {
    return `<section>
      <h2>Préparer la prochaine démo <span class="count">rien de neuf depuis la dernière démo</span></h2>
      <p class="muted">Aucun Intent ni SPEC livré depuis le dernier <code>/aiad demo</code>${r.lastDemo ? ` (${dateFr(r.lastDemo)})` : ''}. La prochaine démo n'a pas encore de contenu à présenter.</p>
    </section>`;
  }
  const lignesIntents = r.intents.map((i, idx) => {
    const idCell = i.file ? lienSource(i.file, i.id) : `<code>${escape(i.id)}</code>`;
    return `<div class="demo-item" data-demo-key="intent:${escape(i.id)}">
      <input type="checkbox" id="demo-i-${idx}"/>
      <label for="demo-i-${idx}">${idCell} — ${escape(i.titre)} <span class="muted">(${dateFr(i.mtime)})</span></label>
    </div>`;
  }).join('');
  const lignesSpecs = r.specs.map((s, idx) => {
    const idCell = s.file ? lienSource(s.file, s.id) : `<code>${escape(s.id)}</code>`;
    const parent = s.parentIntent ? `<span class="muted"> ← ${escape(s.parentIntent)}</span>` : '';
    return `<div class="demo-item" data-demo-key="spec:${escape(s.id)}">
      <input type="checkbox" id="demo-s-${idx}"/>
      <label for="demo-s-${idx}">${idCell} — ${escape(s.titre)}${parent} <span class="muted">(${dateFr(s.mtime)})</span></label>
    </div>`;
  }).join('');
  const projetNom = donnees?.projet?.nom || 'projet';
  return `${DEMO_CSS}<section>
    <h2>Préparer la prochaine démo <span class="count">${r.intents.length} Intent(s) · ${r.specs.length} SPEC(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Tout ce qui est passé à <code>done</code>/<code>archived</code> depuis ${r.lastDemo ? `la dernière démo du <strong>${dateFr(r.lastDemo)}</strong>` : 'l\'origine du projet (aucune démo enregistrée)'}. Coche au fur et à mesure que tu prépares ta présentation — l'état est mémorisé localement dans le navigateur.</p>
    ${lignesIntents ? `<h3>Intents livrés</h3><div class="demo-checklist" data-demo-storage="intents">${lignesIntents}</div>` : ''}
    ${lignesSpecs ? `<h3>SPECs done</h3><div class="demo-checklist" data-demo-storage="specs">${lignesSpecs}</div>` : ''}
    <h3>Script Markdown <span class="count" style="font-size:.7rem">click pour tout sélectionner</span></h3>
    <pre class="demo-script">${escape(scriptMarkdown(r, projetNom))}</pre>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  lastDemoMtime as lastDemoTime,
  intentsDemontrables as demoableIntents,
  specsDemontrables as demoableSpecs,
  calculerDemoReadiness as computeDemoReadiness,
  blocDemoReadiness as demoReadinessSection,
};
