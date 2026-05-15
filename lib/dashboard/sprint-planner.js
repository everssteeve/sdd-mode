// AIAD SDD Mode — Dashboard : sprint planner / commit horizon (#488).
//
// Aide le PM à composer le **prochain commit horizon** (sprint, mois,
// trimestre) en croisant :
//   - SQS readiness (#484) : ready / partial > needs-work / no-spec
//   - Priority frontmatter (P0-P4) : poids dans la priorisation
//   - Capacity planner (#443) : place disponible dans le trimestre courant
//   - Statut actif requis (exclut done/archived)
//
// Produit 3 buckets :
//   - `commit`   : à embarquer en priorité dans le prochain commit horizon
//   - `stretch`  : si capacité restante ET SQS ≥ 4
//   - `defer`    : à différer (priority basse OU SQS needs-work OU no-spec)
//
// Logique : tri composite par (priorité P0=0, P1=1…) + bonus SQS ready.
// Slice par capacité disponible (#443 buckets[0].capacite - charge).
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const PRANK = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };

function poidsPrio(p) {
  const k = p ? String(p).toUpperCase() : 'P3';
  return PRANK[k] ?? 99;
}

function bonusSqs(etat) {
  switch (etat) {
    case 'ready': return 0;
    case 'partial': return 1;
    case 'to-score': return 2;
    case 'needs-work': return 3;
    case 'no-spec': return 4;
    default: return 5;
  }
}

export function scorerCandidat(intent, readiness) {
  const score = poidsPrio(intent.priority) * 10 + bonusSqs(readiness?.etat);
  return { score, poids: poidsPrio(intent.priority), bonus: bonusSqs(readiness?.etat) };
}

function capaciteDisponible(donnees) {
  const c = donnees?.capacityPlanner;
  if (!c || !Array.isArray(c.buckets) || c.buckets.length === 0) {
    return { capacite: 5, charge: 0, restant: 5, source: 'défaut (5)' };
  }
  const trimestre = c.buckets.find((b) => b.etat !== 'passe') || c.buckets[0];
  const restant = Math.max(0, (trimestre.capacite || 0) - (trimestre.charge || 0));
  return {
    capacite: trimestre.capacite || 0,
    charge: trimestre.charge || 0,
    restant,
    label: trimestre.label,
    source: c.capaciteSource || 'capacity-planner',
  };
}

export function calculerSprintPlanner(donnees) {
  const intents = (donnees?.intents || []).filter((i) => !['done', 'archived'].includes(i.statut));
  const readinessById = new Map((donnees?.sqsReadiness?.items || []).map((r) => [r.id, r]));
  const cap = capaciteDisponible(donnees);
  const candidats = intents.map((i) => {
    const r = readinessById.get(i.id) || { etat: 'no-spec' };
    const sc = scorerCandidat(i, r);
    return { ...i, readiness: r, ...sc };
  });
  candidats.sort((a, b) => a.score - b.score);
  // Bucketing.
  const commit = [];
  const stretch = [];
  const defer = [];
  let nCommit = 0;
  const seuilCommit = Math.max(1, Math.min(cap.restant, candidats.length));
  for (const c of candidats) {
    const eligibleCommit = (c.readiness.etat === 'ready' || c.readiness.etat === 'partial') && c.poids <= 1;
    const eligibleStretch = c.readiness.etat === 'ready' && c.poids <= 2;
    if (eligibleCommit && nCommit < seuilCommit) {
      commit.push(c);
      nCommit++;
    } else if (eligibleStretch && nCommit + stretch.length < seuilCommit + 2) {
      stretch.push(c);
    } else {
      defer.push(c);
    }
  }
  return {
    commit,
    stretch,
    defer,
    capacite: cap,
    seuilCommit,
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const SP_CSS = `<style>
.sp-buckets { display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:.7rem; margin:.6rem 0; }
.sp-bucket { padding:.55rem .7rem; border-radius:.4rem; border:1px solid var(--border, #ddd); background:var(--card-bg, #fff); }
.sp-bucket.b-commit { border-left:4px solid #2b8a3e; background:rgba(43,138,62,.04); }
.sp-bucket.b-stretch { border-left:4px solid #4c6ef5; background:rgba(76,110,245,.04); }
.sp-bucket.b-defer { border-left:4px solid rgba(127,127,127,.3); background:rgba(127,127,127,.04); opacity:.85; }
.sp-bucket h3 { font-size:.85rem; margin:.1rem 0 .4rem; display:flex; align-items:baseline; gap:.4rem; }
.sp-row { padding:.3rem .35rem; margin:.2rem 0; border-radius:.2rem; background:rgba(127,127,127,.04); font-size:.82rem; }
.sp-meta { font-size:.72rem; color:var(--muted, #777); }
.sp-meta .sp-tag { padding:.05rem .3rem; background:rgba(127,127,127,.1); border-radius:.15rem; }
.sp-meta .sp-tag.r-ready { background:rgba(43,138,62,.12); color:#1c5a2a; }
.sp-meta .sp-tag.r-partial { background:rgba(232,89,12,.12); color:#7a3a08; }
.sp-meta .sp-tag.r-needs-work { background:rgba(201,42,42,.12); color:#7a1717; }
.sp-meta .sp-tag.r-no-spec { background:rgba(127,127,127,.1); }
.sp-cap { padding:.4rem .55rem; background:rgba(127,127,127,.05); border-radius:.25rem; font-size:.85rem; margin:.4rem 0; }
.sp-empty { padding:.4rem .55rem; font-size:.85rem; color:var(--muted, #777); font-style:italic; }
</style>`;

function rowItem(c) {
  const idCell = c.file ? lienSource(c.file, c.id) : `<code>${escape(c.id)}</code>`;
  const prio = c.priority ? `<span class="sp-tag">${escape(String(c.priority).toUpperCase())}</span>` : '';
  const readinessTag = `<span class="sp-tag r-${escape(c.readiness.etat)}">${escape(c.readiness.etat)}</span>`;
  const sqsTxt = c.readiness.score && c.readiness.score.scored > 0 ? ` ${c.readiness.score.min}-${c.readiness.score.avg}/5` : '';
  return `<div class="sp-row">
    <strong>${idCell}</strong> ${escape((c.titre || '').slice(0, 60))}
    <div class="sp-meta">${prio} ${readinessTag}${sqsTxt} · <span class="sp-tag">${escape(c.statut || '?')}</span></div>
  </div>`;
}

function rendreBucket(items, etat, titre, hint) {
  if (items.length === 0) {
    return `<div class="sp-bucket b-${etat}">
      <h3>${escape(titre)} <span class="count">0</span></h3>
      <div class="sp-empty">${escape(hint)}</div>
    </div>`;
  }
  const rows = items.slice(0, 10).map(rowItem).join('');
  return `<div class="sp-bucket b-${etat}">
    <h3>${escape(titre)} <span class="count">${items.length}</span></h3>
    ${rows}
  </div>`;
}

export function blocSprintPlanner(donnees) {
  const s = donnees?.sprintPlanner;
  if (!s) return '';
  const cap = s.capacite;
  return `${SP_CSS}<section>
    <h2>Sprint planner — commit horizon <span class="count">capacité ${cap.label || '?'} : ${cap.restant}/${cap.capacite} place(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Auto-priorisation pour le prochain commit horizon : croise SQS readiness (#484) + priorité frontmatter + capacité par trimestre (#443). 3 buckets : <strong>Commit</strong> (P0-P1 ready/partial dans la capacité) · <strong>Stretch</strong> (P0-P2 ready, si capacité restante) · <strong>Defer</strong> (priorité basse, SQS faible ou pas encore décomposé).</p>
    <div class="sp-cap">Capacité disponible <strong>${cap.restant} Intent(s)</strong> sur ${cap.capacite} (charge ${cap.charge}) — source : <code>${escape(cap.source)}</code>.</div>
    <div class="sp-buckets">
      ${rendreBucket(s.commit, 'commit', '✓ Commit horizon', "Aucun Intent ready P0/P1 dans le pipeline — renforcer les SPECs faibles via /sdd gate avant de commit.")}
      ${rendreBucket(s.stretch, 'stretch', '➕ Stretch (si capacité)', 'Aucun candidat stretch — capacité supplémentaire libre.')}
      ${rendreBucket(s.defer, 'defer', '⊘ Defer (à différer)', 'Aucun Intent à différer.')}
    </div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  scorerCandidat as scoreCandidate,
  calculerSprintPlanner as computeSprintPlanner,
  blocSprintPlanner as sprintPlannerSection,
};
