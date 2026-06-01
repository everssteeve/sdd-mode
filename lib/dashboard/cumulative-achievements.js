// AIAD SDD Mode — Dashboard : cumulative achievements counter (#532).
//
// Compte le **cumul depuis le début du projet** : nb Intents archivés,
// nb SPECs livrées, nb Intents in-delivery, etc. — un compteur global
// "depuis le jour 1" pour mesurer l'ampleur du parcours.
//
// Calcule aussi l'âge du projet (mtime le plus ancien parmi Intents +
// SPECs) et la vitesse moyenne (livrables / mois).
//
// Pure transformation.

const DAY = 24 * 3600 * 1000;
const MOIS = 30 * DAY;
const STATUTS_LIVRES = new Set(['done', 'archived']);

export function calculerCumulativeAchievements(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const intents = donnees?.intents || [];
  const specs = donnees?.specs || [];
  // Plus ancien mtime
  let plusAncien = now;
  for (const i of intents) if (i.mtime && i.mtime < plusAncien) plusAncien = i.mtime;
  for (const s of specs) if (s.mtime && s.mtime < plusAncien) plusAncien = s.mtime;
  const ageMs = now - plusAncien;
  const ageMois = Math.max(1, Math.round(ageMs / MOIS));
  const ageJours = Math.max(1, Math.round(ageMs / DAY));
  // Counters
  const totaux = {
    intentsTotal: intents.length,
    intentsActifs: intents.filter((i) => i.statut === 'active' || i.statut === 'in-progress').length,
    intentsLivres: intents.filter((i) => STATUTS_LIVRES.has(i.statut)).length,
    intentsDraft: intents.filter((i) => i.statut === 'draft').length,
    specsTotal: specs.length,
    specsLivrees: specs.filter((s) => STATUTS_LIVRES.has(s.statut)).length,
    specsEnCours: specs.filter((s) => ['in-progress', 'review', 'validation', 'ready'].includes(s.statut)).length,
    ageMois,
    ageJours,
    debut: plusAncien === now ? null : plusAncien,
  };
  totaux.tauxLivrSpec = totaux.specsTotal === 0 ? 0 : Math.round((totaux.specsLivrees / totaux.specsTotal) * 100);
  totaux.vitesseSpecsParMois = totaux.specsLivrees === 0 ? 0 : Math.round((totaux.specsLivrees / Math.max(1, ageMois)) * 10) / 10;
  return totaux;
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const CA_CSS = `<style>
.ca-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:.45rem; margin:.4rem 0; }
.ca-stat { padding:.55rem .6rem; border-radius:.3rem; text-align:center; background:rgba(127,127,127,.04); border:1px solid var(--border, #ddd); }
.ca-stat .ca-val { font-size:1.7rem; font-weight:700; color:var(--accent, #4c6ef5); }
.ca-stat .ca-label { font-size:.72rem; text-transform:uppercase; color:var(--muted, #777); margin-top:.15rem; }
.ca-stat.highlight { background:rgba(43,138,62,.08); border-color:rgba(43,138,62,.3); }
.ca-stat.highlight .ca-val { color:#1c5a2a; }
.ca-banner { padding:.55rem .7rem; background:rgba(76,110,245,.06); border-left:3px solid #4c6ef5; border-radius:.25rem; font-size:.88rem; margin:.4rem 0; }
</style>`;

function fmtDate(ts) {
  return ts ? new Date(ts).toLocaleDateString('fr-FR') : '—';
}

export function blocCumulativeAchievements(donnees) {
  const t = donnees?.cumulativeAchievements;
  if (!t) return '';
  if (t.intentsTotal === 0 && t.specsTotal === 0) {
    return `${CA_CSS}<section>
      <h2>Cumul des achievements <span class="count">aucun artefact</span></h2>
      <p class="muted" style="font-size:.85rem">Compteur cumulé depuis le début du projet : Intents capturés, SPECs livrées, vitesse moyenne. Mesure l'ampleur du parcours.</p>
    </section>`;
  }
  return `${CA_CSS}<section>
    <h2>Cumul des achievements <span class="count">${t.ageMois} mois · ${t.intentsTotal} Intents · ${t.specsTotal} SPECs</span></h2>
    <p class="muted" style="font-size:.85rem">Compteur cumulé depuis le début du projet (${escape(fmtDate(t.debut))} — il y a ${t.ageJours}j). Mesure l'ampleur du parcours et la vitesse moyenne.</p>
    <div class="ca-banner">🎉 <strong>${t.specsLivrees} SPECs livrées</strong> + <strong>${t.intentsLivres} Intents livrés</strong> depuis ${t.ageMois} mois — soit ${t.vitesseSpecsParMois} SPECs/mois en moyenne (${t.tauxLivrSpec}% taux de livraison).</div>
    <div class="ca-grid">
      <div class="ca-stat highlight"><div class="ca-val">${t.specsLivrees}</div><div class="ca-label">SPECs livrées</div></div>
      <div class="ca-stat highlight"><div class="ca-val">${t.intentsLivres}</div><div class="ca-label">Intents livrés</div></div>
      <div class="ca-stat"><div class="ca-val">${t.intentsActifs}</div><div class="ca-label">Intents actifs</div></div>
      <div class="ca-stat"><div class="ca-val">${t.specsEnCours}</div><div class="ca-label">SPECs en cours</div></div>
      <div class="ca-stat"><div class="ca-val">${t.intentsDraft}</div><div class="ca-label">Intents draft</div></div>
      <div class="ca-stat"><div class="ca-val">${t.vitesseSpecsParMois}</div><div class="ca-label">SPECs/mois moyen</div></div>
      <div class="ca-stat"><div class="ca-val">${t.tauxLivrSpec}%</div><div class="ca-label">Taux livraison</div></div>
      <div class="ca-stat"><div class="ca-val">${t.ageMois}</div><div class="ca-label">Mois projet</div></div>
    </div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerCumulativeAchievements as computeCumulativeAchievements,
  blocCumulativeAchievements as cumulativeAchievementsSection,
};
