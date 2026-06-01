// AIAD SDD Mode — Dashboard : recent wins wall (#509).
//
// Affiche un mur des **SPECs livrées dans les 30 derniers jours** + les
// **Intents archivés** comme "wins" — petites victoires qui maintiennent
// la dynamique d'équipe (momentum). Trop souvent un dashboard PM ne
// montre que ce qui reste à faire : ce module rééquilibre.
//
// Politique :
//   - SPECs `done` ou `archived` avec mtime dans les 30j
//   - Intents `done` ou `archived` avec mtime dans les 30j
//   - Tri par mtime desc (plus récent en tête)
//   - Limite 12 items pour rester visuellement digeste
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const DAY = 24 * 3600 * 1000;
const FENETRE = 30 * DAY;
const STATUTS_WIN = new Set(['done', 'archived']);

function fmtRelative(ts, now) {
  const jours = Math.floor((now - ts) / DAY);
  if (jours <= 0) return "aujourd'hui";
  if (jours === 1) return 'hier';
  if (jours < 7) return `il y a ${jours}j`;
  if (jours < 30) return `il y a ${Math.floor(jours / 7)}sem`;
  return new Date(ts).toLocaleDateString('fr-FR');
}

export function calculerWinsWall(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const limite = now - FENETRE;
  const items = [];
  for (const s of donnees?.specs || []) {
    if (!STATUTS_WIN.has(s.statut)) continue;
    if (!s.mtime || s.mtime < limite) continue;
    items.push({
      type: 'spec',
      id: s.id,
      titre: s.titre || '',
      file: s.file || null,
      statut: s.statut,
      parentIntent: s.parentIntent || null,
      mtime: s.mtime,
    });
  }
  for (const i of donnees?.intents || []) {
    if (!STATUTS_WIN.has(i.statut)) continue;
    if (!i.mtime || i.mtime < limite) continue;
    items.push({
      type: 'intent',
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      statut: i.statut,
      sponsor: i.sponsor || null,
      mtime: i.mtime,
    });
  }
  items.sort((a, b) => b.mtime - a.mtime);
  return {
    items: items.slice(0, 12),
    totaux: {
      total: items.length,
      specs: items.filter((x) => x.type === 'spec').length,
      intents: items.filter((x) => x.type === 'intent').length,
      now,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const WW_CSS = `<style>
.ww-wall { display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:.5rem; margin:.5rem 0; }
.ww-card { padding:.55rem .65rem; border-radius:.4rem; background:rgba(43,138,62,.05); border-left:3px solid #2b8a3e; }
.ww-card.t-intent { border-left-color:#4c6ef5; background:rgba(76,110,245,.05); }
.ww-icon { font-size:1.05rem; }
.ww-head { display:flex; gap:.4rem; align-items:baseline; font-size:.82rem; font-weight:500; }
.ww-titre { font-weight:600; font-size:.85rem; margin:.15rem 0; }
.ww-meta { font-size:.72rem; color:var(--muted, #777); margin-top:.2rem; display:flex; gap:.3rem; flex-wrap:wrap; }
.ww-tag { padding:.05rem .3rem; background:rgba(127,127,127,.1); border-radius:.15rem; }
.ww-empty { padding:.55rem .7rem; background:rgba(127,127,127,.05); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
.ww-banner { padding:.45rem .55rem; background:rgba(43,138,62,.07); border-left:3px solid #2b8a3e; border-radius:.25rem; font-size:.88rem; color:#1c5a2a; margin:.4rem 0; }
</style>`;

const ICONS = { spec: '🚀', intent: '🎯' };

export function blocWinsWall(donnees) {
  const w = donnees?.winsWall;
  if (!w) return '';
  const t = w.totaux;
  if (w.items.length === 0) {
    return `${WW_CSS}<section>
      <h2>Wins récents <span class="count">aucun livrable dans les 30 derniers jours</span></h2>
      <div class="ww-empty">Quand des SPECs passent en <code>done</code> ou des Intents en <code>archived</code> dans la fenêtre 30j, ils s'affichent ici sous forme de mur. Maintient la dynamique d'équipe — un dashboard qui ne montre que ce qui reste à faire démotive.</div>
    </section>`;
  }
  const cartes = w.items.map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    const meta = it.type === 'spec' && it.parentIntent
      ? `<span class="ww-tag">parent ${escape(it.parentIntent)}</span>`
      : it.type === 'intent' && it.sponsor
        ? `<span class="ww-tag">sponsor ${escape(String(it.sponsor))}</span>`
        : '';
    return `<div class="ww-card t-${escape(it.type)}">
      <div class="ww-head"><span class="ww-icon">${ICONS[it.type]}</span>${idCell}</div>
      <div class="ww-titre">${escape((it.titre || '').slice(0, 70))}</div>
      <div class="ww-meta">
        <span class="ww-tag">${escape(it.statut)}</span>
        ${meta}
        <span class="ww-tag">${escape(fmtRelative(it.mtime, t.now))}</span>
      </div>
    </div>`;
  }).join('');
  return `${WW_CSS}<section>
    <h2>Wins récents <span class="count">${w.items.length} livrable(s) sur ${t.total} dans la fenêtre 30j</span></h2>
    <p class="muted" style="font-size:.85rem">SPECs livrées (done/archived) et Intents archivés dans les <strong>30 derniers jours</strong>. Maintient la dynamique d'équipe — célébrer les wins est aussi important que surveiller les blockers.</p>
    <div class="ww-banner">🎉 <strong>${t.specs} SPEC(s) livrée(s) + ${t.intents} Intent(s) archivé(s)</strong> ces 30 derniers jours.</div>
    <div class="ww-wall">${cartes}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerWinsWall as computeWinsWall,
  blocWinsWall as winsWallSection,
};
