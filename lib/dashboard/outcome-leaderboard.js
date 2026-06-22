// AIAD SDD Mode — Dashboard : outcome contribution leaderboard (#478).
//
// Pour chaque Intent, calcule un **score outcome** qui mesure sa
// contribution à la promesse PRD :
//   score = nb_outcomes_servis × poids_priorité
//
// Poids priorité : P0=5, P1=3, P2=2, P3=1, P4=0.5, sinon 1.
// Bonus : +1 si Intent a au moins une SPEC `done` (= contribution
// effective, pas qu'intention) ; +0.5 si Intent statut=active.
//
// Aide à arbitrer : "ces 5 Intents servent le plus la promesse — à
// protéger en priorité dans les arbitrages de capacité".
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const PRIORITY_POIDS = { P0: 5, P1: 3, P2: 2, P3: 1, P4: 0.5 };

const STATUTS_LIVRES = new Set(['done', 'archived']);

export function calculerScoreOutcome(intent, outcomes, specsParIntent) {
  if (!intent) return { score: 0, outcomesServis: 0, base: 0, bonus: 0 };
  const outcomesServis = (outcomes || []).filter((o) =>
    (o.intents || []).some((it) => it.id === intent.id)
  ).length;
  const prio = intent.priority ? String(intent.priority).toUpperCase() : null;
  const poidsPrio = prio && PRIORITY_POIDS[prio] != null ? PRIORITY_POIDS[prio] : 1;
  const base = outcomesServis * poidsPrio;
  let bonus = 0;
  // +1 si au moins une SPEC livrée
  const specs = (specsParIntent && specsParIntent.get(intent.id)) || [];
  if (specs.some((s) => STATUTS_LIVRES.has(s.statut))) bonus += 1;
  // +0.5 si statut active (engagement déclaré)
  if (intent.statut === 'active' || intent.statut === 'in-progress') bonus += 0.5;
  return {
    score: Math.round((base + bonus) * 10) / 10,
    outcomesServis,
    poidsPrio,
    base,
    bonus,
  };
}

export function calculerOutcomeLeaderboard(donnees) {
  const intents = donnees?.intents || [];
  const outcomes = donnees?.prdCoverage?.outcomes || [];
  // Reconstruit specsParIntent court (cohérent avec pm.js#indexerContextePm).
  const specsParIntent = new Map();
  const courtVersLong = new Map();
  for (const i of intents) {
    const court = i.id.split('-').slice(0, 2).join('-');
    if (!courtVersLong.has(court)) courtVersLong.set(court, i.id);
    specsParIntent.set(i.id, []);
  }
  for (const s of donnees?.specs || []) {
    if (!s.parentIntent) continue;
    const court = s.parentIntent.split('-').slice(0, 2).join('-');
    const longId = courtVersLong.get(court);
    if (longId) specsParIntent.get(longId).push(s);
  }
  const items = intents.map((i) => {
    const s = calculerScoreOutcome(i, outcomes, specsParIntent);
    return {
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      statut: i.statut || null,
      priority: i.priority || null,
      ...s,
    };
  }).filter((it) => it.score > 0); // exclut les 0-contribution
  items.sort((a, b) => b.score - a.score);
  return { items, totaux: { total: items.length } };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const LB_CSS = `<style>
.lb-table { width:100%; font-size:.85rem; }
.lb-rank { text-align:center; width:30px; font-variant-numeric: tabular-nums; }
.lb-rank.medal-1 { font-size: 1.1rem; color:#d4a017; }
.lb-rank.medal-2 { font-size: 1.05rem; color:#999; }
.lb-rank.medal-3 { font-size: 1rem; color:#a0653e; }
@media (prefers-color-scheme: dark) { .lb-rank.medal-3 { color:#c8845e; } }
:root[data-theme="dark"] .lb-rank.medal-3 { color:#c8845e; }
.lb-score { font-weight:700; font-size: 1rem; font-variant-numeric: tabular-nums; }
.lb-detail { font-size:.7rem; color: var(--muted, #777); }
.lb-bar { display:inline-block; width:60px; height:6px; background:rgba(127,127,127,.12); border-radius:3px; overflow:hidden; vertical-align: middle; margin-left:.4rem; }
.lb-bar-fill { height:100%; background: linear-gradient(90deg, #2b8a3e, #4c6ef5); }
</style>`;

function medal(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return rank;
}

export function blocOutcomeLeaderboard(donnees) {
  const l = donnees?.outcomeLeaderboard;
  if (!l) return '';
  if (l.items.length === 0) {
    return `<section>
      <h2>Outcome leaderboard <span class="count">aucun Intent ne sert d'outcome</span></h2>
      <p class="muted" style="font-size:.85rem">Aucun Intent ne contribue à un Outcome PRD §4 selon le mapping #428. Ajouter <code>outcomes: [Nom Critère]</code> dans le frontmatter d'au moins un Intent pour activer ce classement.</p>
    </section>`;
  }
  const maxScore = l.items[0].score;
  const rows = l.items.slice(0, 10).map((it, i) => {
    const rank = i + 1;
    const medalCls = rank <= 3 ? `medal-${rank}` : '';
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    const width = maxScore > 0 ? Math.round((it.score / maxScore) * 100) : 0;
    const prio = it.priority ? `<span class="badge badge-info" style="font-size:.65rem">${escape(String(it.priority).toUpperCase())}</span>` : '';
    return `<tr>
      <td class="lb-rank ${medalCls}">${medal(rank)}</td>
      <td>${idCell} ${prio}</td>
      <td>${escape(it.titre)}</td>
      <td><span class="lb-score">${it.score}</span><span class="lb-bar"><span class="lb-bar-fill" style="width:${width}%"></span></span></td>
      <td class="lb-detail">${it.outcomesServis} outcome(s) × ${it.poidsPrio} prio${it.bonus > 0 ? ` + ${it.bonus} bonus` : ''}</td>
    </tr>`;
  }).join('');
  return `${LB_CSS}<section>
    <h2>Outcome leaderboard <span class="count">${l.items.length} Intent(s) contributeur(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Classement par <strong>contribution à la promesse PRD</strong>. Score = nb outcomes servis × poids priorité (P0=5, P1=3, P2=2, P3=1, P4=0.5). Bonus : +1 si ≥ 1 SPEC livrée, +0.5 si Intent statut <code>active</code>. À protéger en priorité dans les arbitrages de capacité.</p>
    <table class="lb-table">
      <thead><tr><th class="lb-rank">#</th><th>ID</th><th>Titre</th><th>Score</th><th>Détail</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerScoreOutcome as computeOutcomeScore,
  calculerOutcomeLeaderboard as computeOutcomeLeaderboard,
  blocOutcomeLeaderboard as outcomeLeaderboardSection,
};
