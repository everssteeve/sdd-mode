// AIAD SDD Mode — Dashboard : drill-down par persona (#430).
//
// Le PM doit pouvoir poser la question « Pour Acheteur SMB, qu'est-ce
// qu'on est en train de servir ? » et voir d'un coup tous les Intents qui
// adressent ce persona, par statut (draft / active / done) et avec leur
// avancement SPECs.
//
// Réutilise `donnees.prdCoverage.personas` (#423) qui contient déjà
// `personas[].intents[]`. Ce module rajoute (a) un statut agrégé par
// persona ("sous-servi" / "couvert" / "saturé"), (b) un drill-down détaillé
// par statut + (c) un signal "persona sans Intent actif".
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

// Calcule l'état détaillé d'un persona : pour chaque Intent qui le sert,
// quel est son statut et son avancement.
//
// Retourne :
//   {
//     nom, besoin, resultat,
//     intents: { draft: [], active: [], done: [], archived: [], unknown: [] },
//     totaux: { total, actifs, livres },
//     etat: 'orphelin' | 'sous-servi' | 'couvert' | 'sature',
//   }
//
// Sémantique `etat` :
//   - orphelin   : 0 Intent total
//   - sous-servi : ≥ 1 Intent mais 0 actif et 0 livré (que des drafts)
//   - couvert    : 1-2 Intents actifs / 1+ livré → équilibre raisonnable
//   - saturé     : ≥ 3 Intents actifs simultanés → risque WIP excessif
export function calculerEtatPersona(persona, donneesIntents, avancementMap) {
  const intentIds = new Set((persona?.intents || []).map((i) => i.id));
  const intents = { draft: [], active: [], done: [], archived: [], unknown: [] };
  for (const i of donneesIntents || []) {
    if (!intentIds.has(i.id)) continue;
    const av = avancementMap?.get?.(i.id);
    const entree = {
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      statut: i.statut,
      done: av?.done || 0,
      total: av?.total || 0,
      ratio: av?.ratio ?? null,
    };
    const bucket = intents[i.statut] !== undefined ? intents[i.statut] : intents.unknown;
    bucket.push(entree);
  }
  const total = persona?.intents?.length || 0;
  const actifs = intents.active.length + intents.draft.length;
  const livres = intents.done.length + intents.archived.length;
  let etat;
  if (total === 0) etat = 'orphelin';
  else if (intents.active.length === 0 && livres === 0) etat = 'sous-servi';
  else if (intents.active.length >= 3) etat = 'sature';
  else etat = 'couvert';
  return {
    nom: persona?.nom || '',
    besoin: persona?.besoin || '',
    resultat: persona?.resultat || '',
    intents,
    totaux: { total, actifs, livres },
    etat,
  };
}

export function calculerPersonaDrill(donnees) {
  const personas = donnees?.prdCoverage?.personas || [];
  const avancementMap = new Map((donnees?.pm?.avancement || []).map((a) => [a.id, a]));
  return personas.map((p) => calculerEtatPersona(p, donnees.intents, avancementMap));
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

function badgeEtat(etat) {
  const map = {
    orphelin: { cls: 'badge-bad', label: 'Orphelin' },
    'sous-servi': { cls: 'badge-warn', label: 'Sous-servi' },
    couvert: { cls: 'badge-ok', label: 'Couvert' },
    sature: { cls: 'badge-warn', label: 'Saturé (WIP ≥ 3)' },
  };
  const v = map[etat] || { cls: 'badge-muted', label: etat };
  return `<span class="badge ${v.cls}">${escape(v.label)}</span>`;
}

function ligneIntent(i) {
  const idCell = i.file ? lienSource(i.file, i.id) : `<code>${escape(i.id)}</code>`;
  const progress = i.total > 0
    ? `<span class="muted" style="font-size:.7rem">${i.done}/${i.total}</span>`
    : '';
  return `<li>${idCell} — ${escape(i.titre)} ${progress}</li>`;
}

const PERSONA_CSS = `<style>
.persona-card { padding:.6rem .75rem; margin:.5rem 0; border:1px solid var(--border, #ddd); border-radius:.5rem; background:var(--card-bg, #fff); }
.persona-card.etat-orphelin { border-left:4px solid #c92a2a; }
.persona-card.etat-sous-servi { border-left:4px solid #e8590c; }
.persona-card.etat-couvert { border-left:4px solid #2b8a3e; }
.persona-card.etat-sature { border-left:4px solid #e8590c; }
.persona-card-head { display:flex; align-items:baseline; gap:.5rem; flex-wrap:wrap; }
.persona-card-head strong { font-size: 1rem; }
.persona-card-besoin { color: var(--muted, #777); font-size:.85rem; margin:.25rem 0 .35rem; }
.persona-buckets { display:grid; gap:.5rem; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
.persona-bucket { background:rgba(127,127,127,.04); padding:.4rem .5rem; border-radius:.25rem; font-size:.78rem; }
.persona-bucket h4 { margin:0 0 .25rem; font-size:.72rem; text-transform: uppercase; letter-spacing:.04em; color: var(--muted, #777); }
.persona-bucket ul { margin:0; padding-left:1.1rem; }
.persona-bucket li { margin:.1rem 0; }
.persona-bucket-empty { color: var(--muted, #777); font-style: italic; font-size:.75rem; }
</style>`;

export function blocPersonaDrill(donnees) {
  const drill = donnees?.personaDrill;
  if (!drill || drill.length === 0) return '';
  const cartes = drill.map((d) => {
    const buckets = ['draft', 'active', 'done', 'archived'].map((k) => {
      const items = d.intents[k] || [];
      const label = { draft: 'Drafts', active: 'Actifs', done: 'Livrés', archived: 'Archivés' }[k];
      const contenu = items.length === 0
        ? '<span class="persona-bucket-empty">aucun</span>'
        : `<ul>${items.map(ligneIntent).join('')}</ul>`;
      return `<div class="persona-bucket"><h4>${escape(label)} (${items.length})</h4>${contenu}</div>`;
    }).join('');
    return `<div class="persona-card etat-${escape(d.etat)}">
      <div class="persona-card-head">
        <strong>${escape(d.nom)}</strong>
        ${badgeEtat(d.etat)}
        <span class="muted">${d.totaux.total} Intent(s) · ${d.totaux.actifs} actif/draft · ${d.totaux.livres} livré</span>
      </div>
      ${d.besoin ? `<div class="persona-card-besoin">${escape(d.besoin)}</div>` : ''}
      <div class="persona-buckets">${buckets}</div>
    </div>`;
  }).join('');
  const orphelins = drill.filter((d) => d.etat === 'orphelin').length;
  return `${PERSONA_CSS}<section>
    <h2>Drill-down par persona <span class="count">${drill.length} personas · ${orphelins} orphelin(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Pour chaque persona du PRD §3, l'inventaire de tous les Intents qui le servent groupés par statut. État : <span class="badge badge-bad">Orphelin</span> 0 Intent · <span class="badge badge-warn">Sous-servi</span> que des drafts · <span class="badge badge-ok">Couvert</span> équilibre raisonnable · <span class="badge badge-warn">Saturé</span> ≥ 3 actifs simultanés (WIP excessif).</p>
    ${cartes}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerEtatPersona as computePersonaState,
  calculerPersonaDrill as computePersonaDrill,
  blocPersonaDrill as personaDrillSection,
};
