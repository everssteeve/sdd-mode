// AIAD SDD Mode — Dashboard : activité récente / "what changed lately" (#446).
//
// Liste les N derniers Intents / SPECs / facts modifiés (mtime desc).
// Complète #433 (diff hebdo) avec une vue continue qui répond à « depuis
// hier, qu'est-ce qui a bougé ? ».
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const JOUR_MS = 24 * 3600 * 1000;
const HEURE_MS = 3600 * 1000;

export function ageHumain(ageMs) {
  if (ageMs == null) return '—';
  if (ageMs < HEURE_MS) {
    const m = Math.round(ageMs / 60000);
    return m <= 1 ? "à l'instant" : `il y a ${m} min`;
  }
  if (ageMs < JOUR_MS) {
    const h = Math.round(ageMs / HEURE_MS);
    return h === 1 ? 'il y a 1 h' : `il y a ${h} h`;
  }
  const j = Math.round(ageMs / JOUR_MS);
  return j === 1 ? 'il y a 1 j' : `il y a ${j} j`;
}

export function calculerActiviteRecente(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const limite = options.limite || 10;
  const items = [];
  for (const i of donnees?.intents || []) {
    if (!i.mtime) continue;
    items.push({ type: 'Intent', id: i.id, titre: i.titre || '', file: i.file || null, statut: i.statut, mtime: i.mtime });
  }
  for (const s of donnees?.specs || []) {
    if (!s.mtime) continue;
    items.push({ type: 'SPEC', id: s.id, titre: s.titre || '', file: s.file || null, statut: s.statut, mtime: s.mtime, parentIntent: s.parentIntent || null });
  }
  for (const f of donnees?.facts || []) {
    if (!f.mtime) continue;
    items.push({ type: 'Fact', id: f.id, titre: f.titre || '', file: f.file || null, statut: f.statut, mtime: f.mtime, gravite: f.gravite });
  }
  items.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
  const top = items.slice(0, limite).map((it) => ({
    ...it,
    ageMs: now - it.mtime,
    ageHumain: ageHumain(now - it.mtime),
  }));
  return {
    items: top,
    totaux: { intents: items.filter((i) => i.type === 'Intent').length, specs: items.filter((i) => i.type === 'SPEC').length, facts: items.filter((i) => i.type === 'Fact').length },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

function badgeType(type) {
  const map = {
    Intent: { cls: 'badge-info', label: 'Intent' },
    SPEC: { cls: 'badge-muted', label: 'SPEC' },
    Fact: { cls: 'badge-warn', label: 'Fact' },
  };
  const v = map[type] || { cls: 'badge-muted', label: type };
  return `<span class="badge ${v.cls}" style="font-size:.7rem">${escape(v.label)}</span>`;
}

const ACTIVITE_CSS = `<style>
.activite-list { margin:.4rem 0; padding:0; list-style:none; }
.activite-item { display:grid; grid-template-columns: auto 1fr auto; gap:.5rem; align-items:baseline; padding:.3rem .4rem; border-bottom:1px solid var(--border, #eaeaea); font-size:.85rem; }
.activite-item:last-child { border-bottom:0; }
.activite-titre { color:var(--muted, #777); font-size:.8rem; }
.activite-age { color: var(--muted, #777); font-size:.75rem; font-variant-numeric: tabular-nums; white-space: nowrap; }
.activite-statut { font-size:.7rem; color: var(--muted, #777); }
</style>`;

export function blocActiviteRecente(donnees) {
  const a = donnees?.recentActivity;
  if (!a) return '';
  if (a.items.length === 0) {
    return `<section>
      <h2>Activité récente <span class="count">aucune</span></h2>
      <p class="muted">Aucun Intent / SPEC / fact n'a de <code>mtime</code> exploitable.</p>
    </section>`;
  }
  const lignes = a.items.map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    return `<li class="activite-item">
      <div>${badgeType(it.type)} ${idCell}</div>
      <div class="activite-titre">${escape(it.titre)}${it.statut ? ` <span class="activite-statut">(${escape(it.statut)})</span>` : ''}</div>
      <div class="activite-age" title="${new Date(it.mtime).toLocaleString('fr-FR')}">${escape(it.ageHumain)}</div>
    </li>`;
  }).join('');
  return `${ACTIVITE_CSS}<section>
    <h2>Activité récente <span class="count">${a.items.length} dernier(s) · ${a.totaux.intents} Intents · ${a.totaux.specs} SPECs · ${a.totaux.facts} facts</span></h2>
    <p class="muted" style="font-size:.85rem">Les ${a.items.length} dernières modifications (Intent / SPEC / fact) triées par mtime filesystem. Complète #433 (diff hebdo) avec une vue continue "ce qui a bougé récemment".</p>
    <ul class="activite-list">${lignes}</ul>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerActiviteRecente as computeRecentActivity,
  blocActiviteRecente as recentActivitySection,
  ageHumain as humanAge,
};
