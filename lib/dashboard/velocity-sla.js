// AIAD SDD Mode — Dashboard : done velocity vs target SLA (#527).
//
// Compare la vélocité **réelle** au **target_velocity** déclaré dans le
// PRD ou via option, pour mesurer si l'équipe tient son engagement.
//
// Sources :
//   - donnees.velocityForecast (#479) → rythmeMoyen actuel
//   - donnees.architecture / option {targetVelocity} pour la cible
//   - Default : target 1.5 SPECs/sem
//
// Sortie : ratio actuel/target, écart, classification, recommandation.
//
// Pure transformation.

const DEFAULT_TARGET = 1.5;

function classerRatio(ratio) {
  if (ratio >= 1.0) return 'tenu';
  if (ratio >= 0.7) return 'proche';
  if (ratio >= 0.4) return 'sous-rythme';
  return 'critique';
}

function lireTargetVelocity(donnees, options = {}) {
  if (options.targetVelocity != null) return Number(options.targetVelocity);
  // Cherche dans frontmatter PRD si disponible
  const direct = donnees?.velocityTarget || donnees?.velocity_target || donnees?.architecture?.velocityTarget;
  const n = Number(direct);
  if (!isNaN(n) && n > 0) return n;
  return DEFAULT_TARGET;
}

export function calculerVelocitySla(donnees, options = {}) {
  const target = lireTargetVelocity(donnees, options);
  const f = donnees?.velocityForecast;
  const actuel = f && typeof f.rythmeMoyen === 'number' ? f.rythmeMoyen : null;
  if (actuel == null) {
    return { message: 'Vélocité actuelle indisponible', target, actuel: null };
  }
  const ratio = target > 0 ? actuel / target : 0;
  const ecart = Math.round((actuel - target) * 10) / 10;
  return {
    target,
    actuel,
    ratio: Math.round(ratio * 100) / 100,
    ecart,
    etat: classerRatio(ratio),
    pct: Math.round(ratio * 100),
    message: null,
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const VS_CSS = `<style>
.vs-card { padding:.6rem .75rem; border-radius:.35rem; border-left:4px solid var(--accent, #4c6ef5); background:rgba(76,110,245,.05); margin:.3rem 0; }
.vs-card.e-tenu { border-left-color:#2b8a3e; background:rgba(43,138,62,.05); }
.vs-card.e-proche { border-left-color:#f5a623; background:rgba(245,166,35,.05); }
.vs-card.e-sous-rythme { border-left-color:#e8590c; background:rgba(232,89,12,.05); }
.vs-card.e-critique { border-left-color:#c92a2a; background:rgba(201,42,42,.06); }
.vs-head { display:flex; gap:.5rem; align-items:baseline; font-size:.95rem; flex-wrap:wrap; }
.vs-tag { padding:.05rem .4rem; border-radius:.18rem; font-size:.75rem; }
.vs-tag.e-tenu { background:rgba(43,138,62,.15); color:#1c5a2a; }
.vs-tag.e-proche { background:rgba(245,166,35,.18); color:#7a560f; }
.vs-tag.e-sous-rythme { background:rgba(232,89,12,.15); color:#7a3a08; }
.vs-tag.e-critique { background:rgba(201,42,42,.15); color:#7a1717; }
.vs-meta { font-size:.78rem; color:var(--muted, #777); margin-top:.3rem; }
.vs-bar { height:14px; background:rgba(127,127,127,.15); border-radius:7px; overflow:hidden; margin:.4rem 0; }
.vs-fill { height:100%; transition:width .15s; }
.vs-fill.e-tenu { background:#2b8a3e; }
.vs-fill.e-proche { background:#f5a623; }
.vs-fill.e-sous-rythme { background:#e8590c; }
.vs-fill.e-critique { background:#c92a2a; }
</style>`;

const LABELS = {
  tenu: '✓ SLA tenu (≥ 100 %)',
  proche: '◐ Proche (70-100 %)',
  'sous-rythme': '⚠ Sous-rythme (40-70 %)',
  critique: '⛔ Critique (< 40 %)',
};

export function blocVelocitySla(donnees) {
  const s = donnees?.velocitySla;
  if (!s) return '';
  if (s.message) {
    return `${VS_CSS}<section>
      <h2>Vélocité vs SLA <span class="count">${escape(s.message)}</span></h2>
      <p class="muted" style="font-size:.85rem">Compare vélocité actuelle au target (PRD frontmatter <code>velocity_target</code> ou défaut ${escape(String(s.target))} SPECs/sem). Donnée actuelle vient de #479 velocity-forecast — nécessite ≥ 3 semaines d'historique.</p>
    </section>`;
  }
  const pct = Math.min(150, s.pct);
  return `${VS_CSS}<section>
    <h2>Vélocité vs SLA <span class="count">${s.actuel}/${s.target} SPECs/sem · ${s.pct}%</span></h2>
    <p class="muted" style="font-size:.85rem">Compare vélocité moyenne (#479 forecast) au target déclaré. Seuils : tenu ≥ 100 %, proche 70-100 %, sous-rythme 40-70 %, critique &lt; 40 %.</p>
    <div class="vs-card e-${escape(s.etat)}">
      <div class="vs-head">
        <strong>${s.actuel}</strong> / ${s.target} SPECs/sem
        <span class="vs-tag e-${escape(s.etat)}">${escape(LABELS[s.etat] || s.etat)}</span>
        <span class="muted">écart ${s.ecart >= 0 ? '+' : ''}${s.ecart} SPECs/sem</span>
      </div>
      <div class="vs-bar"><div class="vs-fill e-${escape(s.etat)}" style="width:${pct}%"></div></div>
      <div class="vs-meta">${s.pct}% du SLA atteint sur la moyenne 6 sem. Pour ajuster le target, ajouter <code>velocity_target: N</code> au PRD frontmatter.</div>
    </div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerVelocitySla as computeVelocitySla,
  blocVelocitySla as velocitySlaSection,
  DEFAULT_TARGET as DEFAULT_VELOCITY_TARGET,
};
