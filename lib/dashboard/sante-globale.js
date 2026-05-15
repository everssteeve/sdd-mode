// AIAD SDD Mode — Dashboard : score global santé projet (#218).
//
// Composite normalisé /100 combinant 5 dimensions complémentaires à la
// maturité existante (#133), conçu pour exec sponsors qui veulent un signal
// unique "Est-ce que le projet va bien ?" avant de naviguer dans le détail.
//
// Cible : grande KPI card en tête de l'index.html, breakdown des 5
// composantes en sous-KPIs alignées avec les pages persona existantes.

// Pondération volontairement uniforme (20 pts × 5) pour éviter les
// pondérations arbitraires qui invitent au débat. Les sponsors veulent un
// signal stable, pas une formule complexe.
const COMPOSANTES = [
  { id: 'maturite', label: 'Maturité fondamentaux', max: 20 },
  { id: 'governance', label: 'Couverture Tier 1', max: 20 },
  { id: 'dpo', label: 'Coverage RGPD', max: 20 },
  { id: 'edgeCases', label: 'Edge cases couverts', max: 20 },
  { id: 'violations', label: 'Conformité Tier 1', max: 20 },
];

function ratioMaturite(donnees) {
  const m = donnees?.maturite;
  if (!m || m.total === 0) return null;
  return m.score / m.total;
}

function ratioGovernance(donnees) {
  const gov = donnees?.gouvernance || [];
  if (gov.length === 0) return null;
  const presents = gov.filter((g) => g.present).length;
  return presents / gov.length;
}

function ratioDpo(donnees) {
  // Coverage = SPECs RGPD couvertes / actives. Si null (pas de SPECs RGPD)
  // → score neutre 1.0 (rien à couvrir).
  const c = donnees?.dpo?.coverage;
  if (!c) return null;
  if (c.ratio == null) return 1; // pas de RGPD → considéré ok par défaut
  return c.ratio;
}

function ratioEdgeCases(donnees) {
  const ec = donnees?.edgeCases;
  if (!ec || ec.totalSpecs === 0) return null;
  if (ec.ratio == null) return null;
  return ec.ratio;
}

function ratioViolations(donnees) {
  // Inverse : moins de violations = meilleur ratio. Si 0 violations → 1.
  // Si plus de violations que de SPECs actives → 0.
  const v = donnees?.violations;
  if (!v) return null;
  const specsActives = (donnees?.specs || []).filter((s) => {
    const st = (s.statut || s.status || '').toLowerCase();
    return ['ready', 'in-progress', 'validation', 'review', 'done'].includes(st);
  }).length;
  if (specsActives === 0) return 1; // pas de scope actif → neutre
  const ratio = 1 - Math.min(1, v.total / specsActives);
  return ratio;
}

export function calculerSanteGlobale(donnees) {
  const ratios = {
    maturite: ratioMaturite(donnees),
    governance: ratioGovernance(donnees),
    dpo: ratioDpo(donnees),
    edgeCases: ratioEdgeCases(donnees),
    violations: ratioViolations(donnees),
  };
  let scoreTotal = 0;
  let maxTotal = 0;
  const breakdown = COMPOSANTES.map((c) => {
    const r = ratios[c.id];
    if (r == null) {
      // Composante non mesurable → exclue de la moyenne (n'augmente ni le
      // dénominateur ni le numérateur). Évite les faux "0" punitifs.
      return { ...c, ratio: null, points: 0, disponible: false };
    }
    const points = Math.round(r * c.max);
    scoreTotal += points;
    maxTotal += c.max;
    return { ...c, ratio: r, points, disponible: true };
  });
  // Si aucune composante mesurable → score "indéterminé"
  if (maxTotal === 0) {
    return { score: null, total: 100, breakdown, niveau: 'inconnu', composantesDisponibles: 0 };
  }
  // Normalise sur 100 même si certaines composantes sont indisponibles
  const scoreNorm = Math.round((scoreTotal / maxTotal) * 100);
  return {
    score: scoreNorm,
    total: 100,
    scoreBrut: scoreTotal,
    maxBrut: maxTotal,
    breakdown,
    niveau: niveauPour(scoreNorm),
    composantesDisponibles: breakdown.filter((b) => b.disponible).length,
  };
}

function niveauPour(score) {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'sain';
  if (score >= 50) return 'attention';
  return 'critique';
}

// ─── Rendu HTML ─────────────────────────────────────────────────────────────

import { escape } from './render.js';
import { renduTimeline as renduTimelineSante } from './sante-globale-history.js';

function badgeNiveau(niveau, score) {
  const map = {
    excellent: { cls: 'badge-ok', label: '🟢 Excellent' },
    sain: { cls: 'badge-ok', label: '🟢 Sain' },
    attention: { cls: 'badge-warn', label: '🟠 Attention' },
    critique: { cls: 'badge-bad', label: '🔴 Critique' },
    inconnu: { cls: '', label: '⚪ Inconnu' },
  };
  const m = map[niveau] || map.inconnu;
  return `<span class="badge ${m.cls}" style="font-size:.8rem">${escape(m.label)} ${score != null ? '· ' + score + '/100' : ''}</span>`;
}

export function blocSanteGlobale(donnees) {
  const s = donnees?.santeGlobale;
  if (!s || s.composantesDisponibles === 0) return '';
  const breakdownRows = s.breakdown.map((b) => {
    if (!b.disponible) {
      return `<tr><td>${escape(b.label)}</td><td class="muted">—</td><td class="muted" style="text-align:right">non mesurable</td></tr>`;
    }
    const pct = Math.round((b.ratio || 0) * 100);
    const couleur = pct >= 85 ? '#2b8a3e' : pct >= 50 ? '#e8590c' : '#c92a2a';
    return `<tr>
      <td>${escape(b.label)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:.5rem">
          <div style="flex:1;height:6px;background:var(--bg-alt);border-radius:3px;overflow:hidden;min-width:80px">
            <div style="width:${pct}%;height:100%;background:${couleur}"></div>
          </div>
          <span class="muted" style="font-size:.75rem;min-width:2.5rem;text-align:right">${pct}%</span>
        </div>
      </td>
      <td style="text-align:right;font-weight:600">${b.points}/${b.max}</td>
    </tr>`;
  }).join('');
  return `<section>
    <h2>Santé projet ${badgeNiveau(s.niveau, s.score)}</h2>
    <p class="muted" style="font-size:.85rem">Composite normalisé /100 sur ${s.composantesDisponibles}/${s.breakdown.length} composantes mesurables. Une vue exec en 1 nombre, breakdown détaillé ci-dessous.</p>
    <table>
      <thead><tr><th>Composante</th><th>Ratio</th><th style="text-align:right">Points</th></tr></thead>
      <tbody>${breakdownRows}</tbody>
      <tfoot>
        <tr style="font-weight:700;border-top:2px solid var(--border)">
          <td>Total</td><td></td><td style="text-align:right">${s.scoreBrut ?? '—'}/${s.maxBrut ?? '—'} → ${s.score ?? '—'}/100</td>
        </tr>
      </tfoot>
    </table>
    ${renduTimelineSante(s.evolution)}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerSanteGlobale as computeHealthScore,
  blocSanteGlobale as healthScoreSection,
};
