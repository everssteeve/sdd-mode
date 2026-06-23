// AIAD SDD Mode — Dashboard : hill charts calculés depuis l'état SDD (SPEC-018-3).
//
// Représente graphiquement la position de chaque Intent actif sur la courbe
// hill chart (Discovery → Doing/Done). Le côté gauche (montée) = on découvre
// encore comment faire ; le côté droit (descente) = on exécute. Calcul basé
// sur la progression des SPECs liées à chaque Intent.
//
// SVG inline sans dépendance externe. Courbe Bézier cubique symétrique.
//
// Documentation : https://aiad.ovh

/**
 * @intent INTENT-018
 * @spec SPEC-018-3-hill-charts-sdd
 * @governance AIAD-RGAA
 */

import { lireSnapshots } from './pm-diff.js';
import { escape } from './render.js';

const STATUTS_DISCOVERY = new Set(['draft', 'review']);
const STATUTS_DOING = new Set(['ready', 'in-progress', 'validation']);
const STATUTS_DONE = new Set(['done']);
const STATUTS_ACTIFS = new Set(['active', 'in-progress']);

// Calcule positionX (0–100) pour un Intent depuis la liste de ses SPECs.
// Règle de branche :
//   nbTotal === 0                              → 0, jnsp=true
//   nbDiscovery === 0 et nbDone === nbTotal    → 100 (toutes done)
//   nbDiscovery === 0 et nbDoing + nbDone > 0  → 50–100 (phase Doing/Done)
//   nbDiscovery > 0                            → 0–49  (phase Discovery)
function positionDepuisSpecs(specs) {
  const nbTotal = specs.length;
  if (nbTotal === 0) return { positionX: 0, jnsp: true };

  const nbDiscovery = specs.filter((s) => STATUTS_DISCOVERY.has(s.statut)).length;
  const nbDone = specs.filter((s) => STATUTS_DONE.has(s.statut)).length;
  const nbDoing = specs.filter((s) => STATUTS_DOING.has(s.statut)).length;

  let positionX;
  if (nbDiscovery === 0 && nbDone === nbTotal) {
    positionX = 100;
  } else if (nbDiscovery === 0 && nbDoing + nbDone > 0) {
    positionX = 50 + Math.round((nbDone / nbTotal) * 50);
  } else {
    positionX = Math.round(((nbDoing + nbDone) / nbTotal) * 49);
  }

  return { positionX, jnsp: false };
}

/**
 * Calcule les données hill chart pour tous les Intents actifs.
 * @param {object} donnees — données dashboard (intents, specs, _racineProjet)
 * @param {object} [options]
 * @param {Array}  [options.snapshots] — override snapshots (tests unitaires)
 */
export function calculerHillCharts(donnees, options = {}) {
  const intentsActifs = (donnees?.intents || []).filter((i) => STATUTS_ACTIFS.has(i.statut));

  const snapshots = options.snapshots !== undefined
    ? options.snapshots
    : (donnees?._racineProjet ? lireSnapshots(donnees._racineProjet) : []);

  const datesDistinctes = new Set(snapshots.map((s) => s.date)).size;
  const historiqueDisponible = datesDistinctes >= 3 && intentsActifs.length >= 3;

  const intents = intentsActifs.map((intent) => {
    const specsLiees = (donnees?.specs || []).filter((s) => s.parentIntent === intent.id);
    const { positionX, jnsp } = positionDepuisSpecs(specsLiees);

    let trajectoire = [];
    if (historiqueDisponible) {
      trajectoire = snapshots.map((snap) => {
        const specsSnap = (snap.data?.specs || []).filter((s) => s.parentIntent === intent.id);
        const { positionX: px } = positionDepuisSpecs(specsSnap);
        return { date: snap.date, positionX: px };
      });
    }

    return { id: intent.id, titre: intent.titre || intent.id, positionX, jnsp, trajectoire };
  });

  const messageJnsp = historiqueDisponible
    ? null
    : 'Historique insuffisant — trajectoire disponible après 3 jours de données avec ≥ 3 Intents actifs';

  return { intents, historiqueDisponible, messageJnsp };
}

// ─── Rendu SVG ───────────────────────────────────────────────────────────────

const W = 800, H = 260;
const PAD_LEFT = 40, PAD_RIGHT = 20, PAD_TOP = 20, PAD_BOTTOM = 40;
const ZONE_W = W - PAD_LEFT - PAD_RIGHT;
const ZONE_H = H - PAD_TOP - PAD_BOTTOM;

// Coordonnées sur la courbe hill (cubic Bézier symétrique).
// P0=(padLeft, bottom) P1=(padLeft+zoneW*0.25, top)
// P2=(padLeft+zoneW*0.75, top) P3=(padLeft+zoneW, bottom)
//
// x(t) = padLeft + zoneW*(0.75t + 0.75t² - 0.5t³)
// y(t) = padTop + zoneH*((1-t)³ + t³)
function pointSurCourbe(t) {
  const cx = PAD_LEFT + ZONE_W * (0.75 * t + 0.75 * t * t - 0.5 * t * t * t);
  const cy = PAD_TOP + ZONE_H * ((1 - t) * (1 - t) * (1 - t) + t * t * t);
  return { cx: cx.toFixed(1), cy: cy.toFixed(1) };
}

const HILL_CSS = `<style>
.hc-svg { width:100%; max-width:800px; height:auto; display:block; }
.hc-curve { fill:none; stroke:currentColor; stroke-opacity:.25; stroke-width:2; }
.hc-midline { stroke:currentColor; stroke-opacity:.15; stroke-dasharray:4 4; }
.hc-pt-circle { fill:#4c6ef5; stroke:#fff; stroke-width:1.5; }
.hc-point-jnsp { fill:none; stroke:#fab005; stroke-width:2; }
.hc-label { font-size:10px; fill:currentColor; }
.hc-axis { stroke:currentColor; stroke-opacity:.3; }
.hc-zone-label { font-size:9px; fill:currentColor; opacity:.45; }
.hc-traj { fill:none; stroke:#4c6ef5; stroke-opacity:.35; stroke-dasharray:3 3; stroke-width:1; }
@media (prefers-reduced-motion: reduce) { .hc-traj { display:none; } }
</style>`;

function rendrePoint(item) {
  const t = item.positionX / 100;
  const { cx, cy } = pointSurCourbe(t);
  const titreTronque = (item.titre || item.id).slice(0, 20);
  const ariaLabel = `${escape(item.id)} — ${escape(item.titre)} — position ${item.positionX}/100`;

  // Trajectoire historique (pointillé)
  let trajPath = '';
  if (item.trajectoire && item.trajectoire.length >= 2) {
    const pts = item.trajectoire.map((p) => {
      const tp = p.positionX / 100;
      const { cx: tx, cy: ty } = pointSurCourbe(tp);
      return `${tx},${ty}`;
    });
    trajPath = `<polyline class="hc-traj" points="${pts.join(' ')}" aria-hidden="true"/>`;
  }

  const forme = item.jnsp
    ? `<rect class="hc-point-jnsp" x="${(parseFloat(cx) - 5).toFixed(1)}" y="${(parseFloat(cy) - 5).toFixed(1)}" width="10" height="10" rx="1" aria-label="${ariaLabel}" role="img"/>`
    : `<circle class="hc-pt-circle" cx="${cx}" cy="${cy}" r="6" aria-label="${ariaLabel}" role="img"/>`;

  // Label au-dessus du point (décalé pour éviter le chevauchement avec la courbe)
  const lx = parseFloat(cx).toFixed(1);
  const ly = (parseFloat(cy) - 10).toFixed(1);

  return `${trajPath}${forme}<text class="hc-label" x="${lx}" y="${ly}" text-anchor="middle" aria-hidden="true">${escape(titreTronque)}</text>`;
}

export function blocHillCharts(donnees) {
  const hc = donnees?.hillCharts;
  if (!hc) return '';

  if (hc.intents.length === 0) {
    return `<section>
      <h2>Hill Charts <span class="count">Aucun Intent en cours</span></h2>
      <p class="muted">Aucun Intent en statut <code>active</code> ou <code>in-progress</code>.</p>
    </section>`;
  }

  const bottom = (PAD_TOP + ZONE_H).toFixed(1);
  const midX = (PAD_LEFT + ZONE_W / 2).toFixed(1);
  const rightX = (PAD_LEFT + ZONE_W).toFixed(1);

  // Courbe hill (cubic Bézier)
  const cp1x = (PAD_LEFT + ZONE_W * 0.25).toFixed(1);
  const cp2x = (PAD_LEFT + ZONE_W * 0.75).toFixed(1);
  const topY = PAD_TOP.toFixed(1);

  const courbe = `<path class="hc-curve" d="M ${PAD_LEFT},${bottom} C ${cp1x},${topY} ${cp2x},${topY} ${rightX},${bottom}"/>`;

  // Ligne verticale de séparation Discovery / Doing
  const midline = `<line class="hc-midline" x1="${midX}" y1="${PAD_TOP}" x2="${midX}" y2="${bottom}"/>`;

  // Labels de zones
  const zoneLabels = `
    <text class="hc-zone-label" x="${(PAD_LEFT + ZONE_W * 0.25).toFixed(1)}" y="${(PAD_TOP + ZONE_H + 28).toFixed(1)}" text-anchor="middle">Discovery</text>
    <text class="hc-zone-label" x="${(PAD_LEFT + ZONE_W * 0.75).toFixed(1)}" y="${(PAD_TOP + ZONE_H + 28).toFixed(1)}" text-anchor="middle">Doing / Done</text>`;

  // Axes
  const axes = `
    <line class="hc-axis" x1="${PAD_LEFT}" y1="${PAD_TOP}" x2="${PAD_LEFT}" y2="${bottom}"/>
    <line class="hc-axis" x1="${PAD_LEFT}" y1="${bottom}" x2="${rightX}" y2="${bottom}"/>`;

  const points = hc.intents.map(rendrePoint).join('');

  const count = hc.intents.length;
  const msgJnsp = hc.messageJnsp
    ? `<p class="muted" style="font-size:.82rem">${escape(hc.messageJnsp)}</p>`
    : '';

  return `${HILL_CSS}<section>
    <h2>Hill Charts <span class="count">${count} Intent(s) actif(s)</span></h2>
    ${msgJnsp}
    <svg class="hc-svg" viewBox="0 0 ${W} ${H}" role="img"
         aria-label="Hill chart — ${count} Intent(s) en cours de Discovery ou Doing/Done">
      <title>Hill Charts — progression des Intents actifs</title>
      <desc>Chaque point représente un Intent actif positionné sur la courbe hill chart : côté gauche = Discovery (on découvre comment faire), côté droit = Doing/Done (on exécute). Un carré indique une position inconnue (aucune SPEC définie).</desc>
      ${axes}
      ${courbe}
      ${midline}
      ${zoneLabels}
      ${points}
    </svg>
  </section>`;
}

// Alias EN canoniques
export {
  calculerHillCharts as computeHillCharts,
  blocHillCharts as hillChartsSection,
};
