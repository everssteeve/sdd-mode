// AIAD SDD Mode — Dashboard : velocity comparison sprint vs précédent (#469).
//
// Compare la semaine courante (lundi UTC → dimanche UTC) à la semaine
// précédente sur les Intents/SPECs livrés (mtime → done). Donne au PM
// un signal de tendance : on accélère / décélère / stable.
//
// Réutilise la logique de #424 vélocité mais focalise sur 2 semaines
// + calcul delta absolu / relatif.
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const JOUR_MS = 24 * 3600 * 1000;
const SEMAINE_MS = 7 * JOUR_MS;

const STATUTS_LIVRES = new Set(['done', 'archived']);

function debutSemaineLundi(ts) {
  const d = new Date(ts);
  const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const dow = new Date(utc).getUTCDay() || 7;
  return utc - (dow - 1) * JOUR_MS;
}

function compterDansFenetre(items, debut, fin) {
  let n = 0;
  for (const it of items || []) {
    if (!STATUTS_LIVRES.has(it.statut)) continue;
    if (!it.mtime) continue;
    if (it.mtime >= debut && it.mtime < fin) n++;
  }
  return n;
}

export function calculerVelocityComparison(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const lundiCourant = debutSemaineLundi(now);
  const lundiPrecedent = lundiCourant - SEMAINE_MS;
  const lundiAncetre = lundiPrecedent - SEMAINE_MS;
  const intentsCourant = compterDansFenetre(donnees?.intents, lundiCourant, lundiCourant + SEMAINE_MS);
  const intentsPrecedent = compterDansFenetre(donnees?.intents, lundiPrecedent, lundiCourant);
  const intentsAncetre = compterDansFenetre(donnees?.intents, lundiAncetre, lundiPrecedent);
  const specsCourant = compterDansFenetre(donnees?.specs, lundiCourant, lundiCourant + SEMAINE_MS);
  const specsPrecedent = compterDansFenetre(donnees?.specs, lundiPrecedent, lundiCourant);
  const specsAncetre = compterDansFenetre(donnees?.specs, lundiAncetre, lundiPrecedent);

  function delta(courant, precedent) {
    const abs = courant - precedent;
    const rel = precedent > 0 ? Math.round((abs / precedent) * 100) : (courant > 0 ? null : 0);
    let sens = 'flat';
    if (abs > 0) sens = 'up';
    else if (abs < 0) sens = 'down';
    return { courant, precedent, abs, rel, sens };
  }

  return {
    semaineCouranteDebut: new Date(lundiCourant).toISOString().slice(0, 10),
    semainePrecedenteDebut: new Date(lundiPrecedent).toISOString().slice(0, 10),
    intents: delta(intentsCourant, intentsPrecedent),
    specs: delta(specsCourant, specsPrecedent),
    // Historique 3 semaines pour sparkline.
    historique: {
      intents: [intentsAncetre, intentsPrecedent, intentsCourant],
      specs: [specsAncetre, specsPrecedent, specsCourant],
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const VC_CSS = `<style>
.vc-grid { display:grid; gap:.7rem; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin:.5rem 0; }
.vc-card { padding:.65rem .75rem; border:1px solid var(--border, #ddd); border-radius:.4rem; background:var(--card-bg, #fff); }
.vc-card-titre { font-size:.78rem; text-transform:uppercase; letter-spacing:.04em; color:var(--muted, #777); margin-bottom:.3rem; }
.vc-card-valeur { font-size:1.6rem; font-weight:700; line-height:1.1; }
.vc-card-meta { font-size:.78rem; color:var(--muted, #777); margin-top:.2rem; }
.vc-delta.sens-up { color:#2b8a3e; font-weight:600; }
.vc-delta.sens-down { color:#c92a2a; font-weight:600; }
.vc-delta.sens-flat { color:var(--muted, #777); }
@media (prefers-color-scheme: dark) { .vc-delta.sens-up { color:#68d391; } .vc-delta.sens-down { color:#fc8181; } }
:root[data-theme="dark"] .vc-delta.sens-up { color:#68d391; }
:root[data-theme="dark"] .vc-delta.sens-down { color:#fc8181; }
.vc-sparkline { width:80px; height:24px; display:inline-block; vertical-align:middle; margin-left:.4rem; }
</style>`;

function sparkline(values, max) {
  const w = 80, h = 24;
  const padTop = 2, padBottom = 2;
  if (!values || values.length === 0) return '';
  const maxV = max != null ? max : Math.max(...values, 1);
  if (maxV === 0) return `<svg class="vc-sparkline" viewBox="0 0 ${w} ${h}"><line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" stroke="currentColor" stroke-opacity=".3"/></svg>`;
  const stepX = w / Math.max(1, values.length - 1);
  const points = values.map((v, i) => `${(i * stepX).toFixed(1)},${(h - padBottom - (v / maxV) * (h - padTop - padBottom)).toFixed(1)}`).join(' ');
  return `<svg class="vc-sparkline" viewBox="0 0 ${w} ${h}" role="img" aria-hidden="true">
    <polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${values.map((v, i) => `<circle cx="${(i * stepX).toFixed(1)}" cy="${(h - padBottom - (v / maxV) * (h - padTop - padBottom)).toFixed(1)}" r="1.5" fill="currentColor"/>`).join('')}
  </svg>`;
}

function deltaTxt(d) {
  if (d.sens === 'flat') return '→ stable';
  const signe = d.abs > 0 ? '+' : '';
  const rel = d.rel != null ? ` (${signe}${d.rel} %)` : '';
  const arrow = d.sens === 'up' ? '↗' : '↘';
  return `${arrow} ${signe}${d.abs}${rel}`;
}

export function blocVelocityComparison(donnees) {
  const v = donnees?.velocityComparison;
  if (!v) return '';
  return `${VC_CSS}<section>
    <h2>Vélocité — semaine vs précédente <span class="count">${escape(v.semaineCouranteDebut)} vs ${escape(v.semainePrecedenteDebut)}</span></h2>
    <p class="muted" style="font-size:.85rem">Comparaison Intents + SPECs livrés (passés à <code>done</code>/<code>archived</code>) entre la semaine courante (lundi → dimanche UTC) et la précédente. Sparkline = 3 dernières semaines.</p>
    <div class="vc-grid">
      <div class="vc-card">
        <div class="vc-card-titre">Intents livrés</div>
        <div class="vc-card-valeur">${v.intents.courant}${sparkline(v.historique.intents)}</div>
        <div class="vc-card-meta"><span class="vc-delta sens-${escape(v.intents.sens)}">${escape(deltaTxt(v.intents))}</span> vs ${v.intents.precedent} la semaine précédente</div>
      </div>
      <div class="vc-card">
        <div class="vc-card-titre">SPECs livrées</div>
        <div class="vc-card-valeur">${v.specs.courant}${sparkline(v.historique.specs)}</div>
        <div class="vc-card-meta"><span class="vc-delta sens-${escape(v.specs.sens)}">${escape(deltaTxt(v.specs))}</span> vs ${v.specs.precedent} la semaine précédente</div>
      </div>
    </div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerVelocityComparison as computeVelocityComparison,
  blocVelocityComparison as velocityComparisonSection,
};
