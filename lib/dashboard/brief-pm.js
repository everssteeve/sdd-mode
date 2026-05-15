// AIAD SDD Mode — Dashboard : brief PM Markdown export (#432).
//
// Le PM doit pouvoir générer en 1 clic un résumé Markdown synthétique
// à coller dans Slack / email / Notion — état d'avancement + alertes +
// priorités + échéances. Ce module compose les sorties des modules
// existants (#218 santé, #426 priorités, #429 demo, #431 échéances,
// #137 alertes) en un texte unique sélectionnable.
//
// Aucun effet de bord. Pure transformation `donnees → markdown`.
//
// Documentation : https://aiad.ovh

function dateFr(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('fr-FR');
}

function lignesAlertes(donnees) {
  const pm = donnees?.pm || {};
  const lignes = [];
  if ((pm.zombies || []).length > 0) {
    lignes.push(`- ${pm.zombies.length} Intent(s) zombie(s) à archiver ou relancer`);
  }
  if ((pm.draftsAnciens || []).length > 0) {
    lignes.push(`- ${pm.draftsAnciens.length} draft(s) anciens (> 14j) à mûrir ou archiver`);
  }
  if ((pm.specsNonDemontrees || []).length > 0) {
    lignes.push(`- ${pm.specsNonDemontrees.length} SPEC(s) done non démontrées — préparer la démo`);
  }
  const d = donnees?.deadlines?.totaux || {};
  if (d.retard > 0) lignes.push(`- ${d.retard} Intent(s) en retard sur target`);
  if (d.urgent > 0) lignes.push(`- ${d.urgent} Intent(s) urgent(s) (échéance ≤ 14j)`);
  return lignes;
}

function lignesPriorites(donnees, n = 3) {
  const intents = donnees?.intents || [];
  const pipeline = intents.filter((i) => !['done', 'archived'].includes(i.statut));
  // Réutilise le même comparateur que #426 — duplication locale légère pour
  // éviter une dépendance circulaire `brief-pm.js → intent-priority.js`
  // (intent-priority.js importe render.js qui peut importer pm.js).
  const PRANK = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };
  const ord = pipeline.sort((a, b) => {
    const pa = a.priority ? PRANK[String(a.priority).toUpperCase()] ?? 99 : 99;
    const pb = b.priority ? PRANK[String(b.priority).toUpperCase()] ?? 99 : 99;
    return pa - pb;
  });
  return ord.slice(0, n).map((i) => {
    const prio = i.priority ? ` [${String(i.priority).toUpperCase()}]` : '';
    const target = i.target_date ? ` (target ${i.target_date})` : (i.target ? ` (${i.target})` : '');
    return `- ${i.id}${prio} — ${i.titre || ''}${target}`;
  });
}

function lignesEcheances(donnees) {
  const buckets = donnees?.deadlines?.buckets || {};
  const lignes = [];
  for (const k of ['retard', 'urgent']) {
    for (const it of (buckets[k] || []).slice(0, 5)) {
      const j = it.joursRestants;
      const tag = j == null ? '' : (j < 0 ? `J+${Math.abs(j)} en retard` : `J-${j}`);
      lignes.push(`- ${it.id} — ${it.titre || ''} (${tag})`);
    }
  }
  return lignes;
}

// Génère le Markdown complet du brief PM. Garde l'output compact : ~30
// lignes max pour rester collable en 1 message Slack/email.
export function genererBriefPm(donnees) {
  const projet = donnees?.projet?.nom || 'projet';
  const date = new Date().toISOString().slice(0, 10);
  const sante = donnees?.santeGlobale;
  const maturite = donnees?.maturite;
  const counts = {
    intents: donnees?.intents?.length || 0,
    specs: donnees?.specs?.length || 0,
    actifs: (donnees?.intents || []).filter((i) => i.statut === 'active').length,
  };
  const lignes = [];
  lignes.push(`# Brief PM — ${projet} — ${date}`);
  lignes.push('');
  lignes.push('## État général');
  if (sante?.score != null) lignes.push(`- Santé projet : **${sante.score}/${sante.total}** — ${sante.niveau || '?'}`);
  if (maturite) lignes.push(`- Maturité SDD : **${maturite.score}/${maturite.total}** — ${maturite.label || '?'}`);
  lignes.push(`- Catalogue : ${counts.intents} Intent(s) dont ${counts.actifs} actif(s) · ${counts.specs} SPEC(s)`);
  lignes.push('');
  const alertes = lignesAlertes(donnees);
  if (alertes.length > 0) {
    lignes.push('## Alertes PM');
    lignes.push(...alertes);
    lignes.push('');
  }
  const top = lignesPriorites(donnees, 3);
  if (top.length > 0) {
    lignes.push('## Top 3 priorités à travailler');
    lignes.push(...top);
    lignes.push('');
  }
  const ech = lignesEcheances(donnees);
  if (ech.length > 0) {
    lignes.push('## Échéances actionnables');
    lignes.push(...ech);
    lignes.push('');
  }
  // Démo
  const demo = donnees?.demoReadiness;
  if (demo && demo.total > 0) {
    lignes.push(`## Démo à préparer · ${demo.intents.length} Intent(s) · ${demo.specs.length} SPEC(s) depuis ${demo.lastDemo ? dateFr(demo.lastDemo) : 'le début'}`);
    for (const i of demo.intents.slice(0, 5)) lignes.push(`- ${i.id} — ${i.titre || ''}`);
    for (const s of demo.specs.slice(0, 5)) lignes.push(`- ${s.id} — ${s.titre || ''}`);
    lignes.push('');
  }
  lignes.push('---');
  lignes.push('_Généré depuis le dashboard PM aiad-sdd — `aiad-sdd dashboard` pour régénérer._');
  return lignes.join('\n');
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const BRIEF_CSS = `<style>
.brief-pm-pre { background:rgba(127,127,127,.08); padding:.75rem; border-radius:.25rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:.78rem; user-select: all; white-space: pre-wrap; max-height: 360px; overflow:auto; border:1px solid var(--border, #ddd); }
.brief-pm-hint { color: var(--muted, #777); font-size:.85rem; margin:.25rem 0 .5rem; }
</style>`;

export function blocBriefPm(donnees) {
  const md = genererBriefPm(donnees);
  return `${BRIEF_CSS}<section>
    <h2>Brief PM exportable <span class="count">Markdown · click pour tout sélectionner</span></h2>
    <p class="brief-pm-hint">Résumé synthétique état + alertes + priorités + échéances + démo, ~30 lignes max. Click sur le bloc puis <kbd>Cmd+C</kbd> / <kbd>Ctrl+C</kbd> pour copier vers Slack / email / Notion.</p>
    <pre class="brief-pm-pre">${escape(md)}</pre>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  genererBriefPm as generatePmBrief,
  blocBriefPm as pmBriefSection,
};
