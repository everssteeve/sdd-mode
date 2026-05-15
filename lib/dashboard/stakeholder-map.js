// AIAD SDD Mode — Dashboard : stakeholder × Intent map (#551).
//
// Vue compacte par **stakeholder** (sponsor + owner) listant les
// Intents qui le concernent. Permet de "checker en 30 secondes ce
// qu'un stakeholder donné porte" sans naviguer 4 sections.
//
// Pure transformation.

function lireValeurs(intent, ...alias) {
  for (const a of alias) {
    const v = intent?.[a];
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
    if (typeof v === 'string' && v.trim() !== '') {
      return v.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
    }
  }
  return [];
}

export function calculerStakeholderMap(donnees) {
  const intents = donnees?.intents || [];
  const map = new Map();
  function ajouter(nom, role, intent) {
    const cle = nom.trim();
    if (!cle) return;
    if (!map.has(cle)) map.set(cle, { nom: cle, asSponsor: [], asOwner: [], asPersona: [] });
    const e = map.get(cle);
    const entree = { id: intent.id, titre: intent.titre || '', statut: intent.statut, priority: intent.priority || null };
    if (role === 'sponsor') e.asSponsor.push(entree);
    else if (role === 'owner') e.asOwner.push(entree);
    else if (role === 'persona') e.asPersona.push(entree);
  }
  for (const i of intents) {
    for (const s of lireValeurs(i, 'sponsor', 'sponsors', 'stakeholder')) ajouter(s, 'sponsor', i);
    for (const o of lireValeurs(i, 'owner', 'Owner', 'owners')) ajouter(o, 'owner', i);
  }
  const items = [...map.values()].map((e) => ({
    ...e,
    nbTotal: e.asSponsor.length + e.asOwner.length,
  }));
  items.sort((a, b) => b.nbTotal - a.nbTotal);
  return {
    items,
    totaux: {
      stakeholders: items.length,
      doubleRole: items.filter((i) => i.asSponsor.length > 0 && i.asOwner.length > 0).length,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const SM_CSS = `<style>
.sm-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:.5rem; margin:.4rem 0; }
.sm-card { padding:.55rem .7rem; border-radius:.35rem; background:rgba(127,127,127,.04); border-left:3px solid var(--accent, #4c6ef5); }
.sm-card.double { border-left-color:#c92a2a; background:rgba(201,42,42,.04); }
.sm-head { font-weight:600; font-size:.92rem; margin-bottom:.2rem; display:flex; gap:.4rem; align-items:baseline; flex-wrap:wrap; }
.sm-section { margin:.2rem 0; font-size:.78rem; }
.sm-section strong { font-size:.7rem; text-transform:uppercase; letter-spacing:.04em; color:var(--muted, #777); margin-right:.2rem; }
.sm-list { list-style:none; padding:0; margin:.1rem 0 .2rem; font-size:.78rem; }
.sm-list li { padding:.05rem 0; }
.sm-tag { padding:.05rem .35rem; background:rgba(127,127,127,.1); border-radius:.18rem; font-size:.7rem; }
.sm-tag.role-sponsor { background:rgba(76,110,245,.12); color:#3a4cba; }
.sm-tag.role-owner { background:rgba(232,89,12,.12); color:#7a3a08; }
.sm-tag.double { background:rgba(201,42,42,.15); color:#7a1717; }
.sm-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
</style>`;

export function blocStakeholderMap(donnees) {
  const m = donnees?.stakeholderMap;
  if (!m) return '';
  if (m.items.length === 0) {
    return `${SM_CSS}<section>
      <h2>Carte stakeholder × Intent <span class="count">aucun stakeholder déclaré</span></h2>
      <div class="sm-empty">Ajoute <code>sponsor:</code> et/ou <code>owner:</code> au frontmatter des Intents pour activer la carte.</div>
    </section>`;
  }
  const t = m.totaux;
  const cards = m.items.slice(0, 12).map((it) => {
    const double = it.asSponsor.length > 0 && it.asOwner.length > 0;
    function liste(label, items, role) {
      if (items.length === 0) return '';
      const li = items.slice(0, 4).map((i) => `<li><code>${escape(i.id)}</code> ${escape((i.titre || '').slice(0, 35))}${i.priority ? ` [${String(i.priority).toUpperCase()}]` : ''}</li>`).join('');
      return `<div class="sm-section"><strong>${escape(label)} <span class="sm-tag role-${escape(role)}">${items.length}</span></strong><ul class="sm-list">${li}</ul></div>`;
    }
    return `<div class="sm-card ${double ? 'double' : ''}">
      <div class="sm-head">
        ${escape(it.nom)}
        <span class="sm-tag">${it.nbTotal} Intent(s)</span>
        ${double ? '<span class="sm-tag double">sponsor + owner</span>' : ''}
      </div>
      ${liste('Sponsor de', it.asSponsor, 'sponsor')}
      ${liste('Owner de', it.asOwner, 'owner')}
    </div>`;
  }).join('');
  return `${SM_CSS}<section>
    <h2>Carte stakeholder × Intent <span class="count">${t.stakeholders} stakeholder(s) · ${t.doubleRole} en double rôle</span></h2>
    <p class="muted" style="font-size:.85rem">Vue compacte par stakeholder (sponsor + owner) avec Intents associés. Cards rouges si quelqu'un cumule sponsor + owner — risque conflit d'intérêts ou surcharge.</p>
    <div class="sm-grid">${cards}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerStakeholderMap as computeStakeholderMap,
  blocStakeholderMap as stakeholderMapSection,
};
