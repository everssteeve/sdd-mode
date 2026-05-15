// AIAD SDD Mode — Dashboard : weekly newsletter PM (#468).
//
// Génère une newsletter PM hebdo Markdown que le PM peut copier-coller
// dans email / Notion / Slack pour partager l'état du produit avec les
// stakeholders non-tech. Source : snapshots PM (#433) + decisionLog
// (#443) + intents/specs + alertes du daily focus (#465).
//
// Format type (compact, ~40 lignes max) :
//   # Newsletter PM — {projet} — semaine du YYYY-MM-DD
//   ## Livré cette semaine
//   - INTENT-X — titre (passé done)
//   - SPEC-Y — titre (passé done)
//   ## Décisions
//   - Décision Z parce que Y
//   ## Risques ouverts
//   - INTENT-A bloqué par INTENT-B
//   ## Prochaine semaine — top 3 priorités
//   - INTENT-C [P0]
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

function dateFr(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('fr-FR');
}

// Détermine le 7 derniers jours et collecte les transitions à done depuis
// les snapshots (#433). Réutilise la logique de #433 mais focalise sur
// l'intervalle hebdomadaire.
function transitionsSemainePrecedente(donnees) {
  const r = donnees?.pmDiff;
  if (!r || !r.diff || !r.reference) return null;
  return {
    intentsLivres: r.diff.intents.passesDone || [],
    intentsArchives: r.diff.intents.passesArchive || [],
    specsLivrees: r.diff.specs.passesDone || [],
    intentsCreated: r.diff.intents.nouveaux || [],
    transitionsIntents: r.diff.intents.transitions || [],
    dateReference: r.reference.date,
  };
}

function lignesLivre(transitions) {
  if (!transitions) return ['_Pas de snapshot de référence disponible pour ce calcul._'];
  const lignes = [];
  for (const i of transitions.intentsLivres) lignes.push(`- ${i.id} livré (Intent passé à done)`);
  for (const i of transitions.intentsArchives) lignes.push(`- ${i.id} archivé`);
  for (const s of transitions.specsLivrees) lignes.push(`- ${s.id} (SPEC passée à done)`);
  return lignes.length > 0 ? lignes : ['_Aucun livré sur la fenêtre._'];
}

function lignesDecisions(donnees, transitions) {
  const lignes = [];
  const decisions = donnees?.decisionLog?.prd?.decisions || [];
  for (const d of decisions.slice(0, 3)) {
    lignes.push(`- **${d.decision}** : ${d.raison}`);
  }
  // Facts critiques apparus dans la fenêtre.
  const factsCritiquesOuverts = (donnees?.decisionLog?.facts || [])
    .filter((f) => f.gravite === 'critical' && !['closed', 'resolu', 'résolu'].includes(f.statut));
  for (const f of factsCritiquesOuverts.slice(0, 3)) {
    lignes.push(`- ⚠ Fact critique : ${f.titre || f.id}`);
  }
  return lignes;
}

function lignesRisques(donnees) {
  const lignes = [];
  // Intents bloqués actifs
  const deps = donnees?.intentDeps?.intents || [];
  const bloques = deps.filter((d) => d.bloqueActif).slice(0, 3);
  for (const b of bloques) {
    const blocants = (b.bloquePar || []).filter((x) => !x.livre).map((x) => x.id).join(', ');
    lignes.push(`- ${b.id} bloqué par ${blocants || '—'}`);
  }
  // Paris risqués
  const paris = (donnees?.confidenceTracker?.items || [])
    .filter((i) => (i.bande === 'tres-faible' || i.bande === 'faible')
      && (i.statut === 'active' || i.statut === 'in-progress'))
    .slice(0, 3);
  for (const p of paris) {
    lignes.push(`- ${p.id} pari risqué (${p.pct} %)`);
  }
  return lignes;
}

function lignesPriorites(donnees) {
  const PRANK = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };
  const pipeline = (donnees?.intents || [])
    .filter((i) => !['done', 'archived'].includes(i.statut))
    .sort((a, b) => {
      const pa = a.priority ? (PRANK[String(a.priority).toUpperCase()] ?? 99) : 99;
      const pb = b.priority ? (PRANK[String(b.priority).toUpperCase()] ?? 99) : 99;
      return pa - pb;
    });
  return pipeline.slice(0, 3).map((i) => {
    const prio = i.priority ? ` [${String(i.priority).toUpperCase()}]` : '';
    const target = i.target_date ? ` (target ${i.target_date})` : (i.target ? ` (${i.target})` : '');
    return `- ${i.id}${prio} — ${i.titre || ''}${target}`;
  });
}

export function genererNewsletter(donnees) {
  const projet = donnees?.projet?.nom || 'projet';
  const date = new Date().toISOString().slice(0, 10);
  const transitions = transitionsSemainePrecedente(donnees);
  const dateRef = transitions ? transitions.dateReference : '—';
  const lignes = [];
  lignes.push(`# Newsletter PM — ${projet} — semaine du ${date}`);
  lignes.push('');
  if (transitions) {
    lignes.push(`_Comparaison avec snapshot du ${dateRef}._`);
    lignes.push('');
  }
  lignes.push('## Livré cette semaine');
  lignes.push(...lignesLivre(transitions));
  lignes.push('');
  const decisions = lignesDecisions(donnees, transitions);
  if (decisions.length > 0) {
    lignes.push('## Décisions & faits');
    lignes.push(...decisions);
    lignes.push('');
  }
  const risques = lignesRisques(donnees);
  if (risques.length > 0) {
    lignes.push('## Risques ouverts');
    lignes.push(...risques);
    lignes.push('');
  }
  const priorites = lignesPriorites(donnees);
  if (priorites.length > 0) {
    lignes.push('## Prochaine semaine — top 3 priorités');
    lignes.push(...priorites);
    lignes.push('');
  }
  lignes.push('---');
  lignes.push('_Généré depuis le dashboard PM aiad-sdd._');
  return lignes.join('\n');
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const NEWS_CSS = `<style>
.news-pre { background:rgba(127,127,127,.08); padding:.75rem; border-radius:.25rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:.78rem; user-select: all; white-space: pre-wrap; max-height: 400px; overflow:auto; border:1px solid var(--border, #ddd); }
.news-hint { color: var(--muted, #777); font-size:.85rem; margin:.25rem 0 .5rem; }
</style>`;

export function blocNewsletter(donnees) {
  const md = genererNewsletter(donnees);
  return `${NEWS_CSS}<section>
    <h2>Newsletter PM hebdo <span class="count">Markdown · click pour tout sélectionner</span></h2>
    <p class="news-hint">Newsletter prête à coller dans Notion / email / canal Slack stakeholders. Compose les livraisons depuis snapshots PM (#433) + décisions PRD §7 + risques bloqués (#434) + paris risqués (#459) + top 3 priorités du pipeline.</p>
    <pre class="news-pre">${escape(md)}</pre>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  genererNewsletter as generateNewsletter,
  blocNewsletter as newsletterSection,
};
