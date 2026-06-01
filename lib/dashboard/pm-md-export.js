// AIAD SDD Mode — Dashboard : export Markdown complet de pm.html (#481).
//
// Génère un Markdown structuré reprenant les sections clés du cockpit
// PM en format long. Utile pour :
//   - Archiver l'état du projet dans Notion / wiki
//   - Partager un snapshot complet en email / PR description
//   - Auditer rétroactivement l'évolution
//
// Réutilise les calculs déjà faits (brief #432, newsletter #468, retro
// #473) + complète avec sections additionnelles (échéances, capacity,
// hypothèses, risques, leaderboard, forecast).
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

function dateFr(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('fr-FR');
}

function sectionEcheances(donnees) {
  const d = donnees?.deadlines?.totaux || {};
  if (!d.retard && !d.urgent && !d.proche) return null;
  const lignes = ['## Échéances Intent', ''];
  if (d.retard > 0) lignes.push(`- ⚠ **${d.retard} en retard** sur target`);
  if (d.urgent > 0) lignes.push(`- 🔴 ${d.urgent} urgent(s) (≤ 14 j)`);
  if (d.proche > 0) lignes.push(`- 🟠 ${d.proche} proche(s) (≤ 30 j)`);
  lignes.push('');
  return lignes;
}

function sectionPriorites(donnees) {
  const PRANK = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };
  const pipeline = (donnees?.intents || [])
    .filter((i) => !['done', 'archived'].includes(i.statut))
    .sort((a, b) => {
      const pa = a.priority ? (PRANK[String(a.priority).toUpperCase()] ?? 99) : 99;
      const pb = b.priority ? (PRANK[String(b.priority).toUpperCase()] ?? 99) : 99;
      return pa - pb;
    })
    .slice(0, 5);
  if (pipeline.length === 0) return null;
  const lignes = ['## Top 5 priorités du pipeline', ''];
  for (const i of pipeline) {
    const prio = i.priority ? ` [${String(i.priority).toUpperCase()}]` : '';
    lignes.push(`- ${i.id}${prio} — ${i.titre || ''}`);
  }
  lignes.push('');
  return lignes;
}

function sectionCapacity(donnees) {
  const c = donnees?.capacityPlanner;
  if (!c) return null;
  const lignes = ['## Capacité par trimestre', ''];
  lignes.push(`Capacité équipe : **${c.capacite} Intents/trimestre** (source : ${c.capaciteSource}).`);
  lignes.push('');
  lignes.push('| Trimestre | Charge | État |');
  lignes.push('|---|---|---|');
  for (const b of c.buckets) {
    lignes.push(`| ${b.label} | ${b.charge} / ${b.capacite} | ${b.etat} |`);
  }
  lignes.push('');
  return lignes;
}

function sectionHypotheses(donnees) {
  const h = donnees?.hypotheses?.hypotheses || [];
  if (h.length === 0) return null;
  const lignes = ['## Hypothèses produit', ''];
  for (const x of h.slice(0, 10)) {
    const statut = x.statut === 'validated' ? '✓' : x.statut === 'invalidated' ? '✗' : '?';
    lignes.push(`- ${statut} **${x.id}** — ${(x.hypothese || '').slice(0, 200)}`);
  }
  lignes.push('');
  return lignes;
}

function sectionRisques(donnees) {
  const r = donnees?.risks?.intents || [];
  const niveauxImportants = r.filter((x) => x.niveau === 'critical' || x.niveau === 'high');
  if (niveauxImportants.length === 0) return null;
  const lignes = ['## Risques élevés', ''];
  for (const x of niveauxImportants.slice(0, 10)) {
    const top = (x.risques || []).slice(0, 2).map((rs) => rs.texte).join(', ');
    lignes.push(`- **${x.id}** [${x.niveau}] — ${top || x.titre}`);
  }
  lignes.push('');
  return lignes;
}

function sectionLeaderboard(donnees) {
  const items = donnees?.outcomeLeaderboard?.items || [];
  if (items.length === 0) return null;
  const lignes = ['## Top contributeurs aux outcomes', ''];
  items.slice(0, 5).forEach((it, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    lignes.push(`${medal} **${it.id}** — score ${it.score} (${it.outcomesServis} outcomes × ${it.poidsPrio} prio${it.bonus ? ` + ${it.bonus} bonus` : ''})`);
  });
  lignes.push('');
  return lignes;
}

function sectionForecast(donnees) {
  const f = donnees?.velocityForecast;
  if (!f || f.message) return null;
  const lignes = ['## Velocity forecast', ''];
  lignes.push(`- Rythme moyen : **${f.rythmeMoyen} SPECs/sem**`);
  lignes.push(`- Pente : ${f.reg.slope >= 0 ? '+' : ''}${f.reg.slope} SPECs/sem (${f.reg.slope > 0.1 ? 'accélération' : f.reg.slope < -0.1 ? 'décélération' : 'stable'})`);
  lignes.push(`- Projection ${f.horizonSem} sem : ~${f.projectionHorizon} SPECs (±${(f.reg.stdErr * f.horizonSem).toFixed(1)})`);
  lignes.push(`- Backlog restant : ${f.restant} SPECs`);
  if (f.etaSemaines != null) lignes.push(`- ETA backlog actuel : ~${f.etaSemaines} semaines`);
  lignes.push('');
  return lignes;
}

function sectionOkr(donnees) {
  const o = donnees?.okrMapping;
  if (!o || !o.objectifs || o.objectifs.length === 0) return null;
  const lignes = ['## Alignement OKR', ''];
  for (const obj of o.objectifs) {
    lignes.push(`### ${obj.id} — ${obj.description}`);
    for (const kr of obj.keyResults) {
      const intents = kr.intents.length === 0 ? '_(aucun Intent rattaché)_' : kr.intents.map((i) => i.id).join(', ');
      lignes.push(`- **${kr.id}** : ${kr.description}`);
      lignes.push(`  Intents : ${intents}`);
    }
    lignes.push('');
  }
  return lignes;
}

function sectionStats(donnees) {
  const lignes = ['## État général', ''];
  const sante = donnees?.santeGlobale;
  const mat = donnees?.maturite;
  const counts = {
    intents: donnees?.intents?.length || 0,
    intentsActifs: (donnees?.intents || []).filter((i) => i.statut === 'active').length,
    specs: donnees?.specs?.length || 0,
    specsDone: (donnees?.specs || []).filter((s) => s.statut === 'done' || s.statut === 'archived').length,
  };
  if (sante?.score != null) lignes.push(`- Santé projet : **${sante.score}/${sante.total}** — ${sante.niveau || '?'}`);
  if (mat) lignes.push(`- Maturité SDD : **${mat.score}/${mat.total}** — ${mat.label || '?'}`);
  lignes.push(`- Catalogue : ${counts.intents} Intent(s) dont ${counts.intentsActifs} actif(s) · ${counts.specs} SPEC(s) dont ${counts.specsDone} livrée(s)`);
  lignes.push('');
  return lignes;
}

export function genererMarkdownCockpit(donnees) {
  const projet = donnees?.projet?.nom || 'projet';
  const date = new Date().toISOString().slice(0, 10);
  const sections = [
    [`# Cockpit PM — ${projet} — ${date}`, ''],
    [`_Snapshot complet généré le ${date} depuis le dashboard PM aiad-sdd._`, ''],
    sectionStats(donnees),
    sectionEcheances(donnees),
    sectionPriorites(donnees),
    sectionCapacity(donnees),
    sectionLeaderboard(donnees),
    sectionForecast(donnees),
    sectionOkr(donnees),
    sectionHypotheses(donnees),
    sectionRisques(donnees),
    ['---', '_Pour la version interactive complète, ouvrir `dashboard/pm.html`._'],
  ];
  return sections
    .filter(Boolean)
    .flatMap((s) => Array.isArray(s) ? s : [s])
    .join('\n');
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const EXPORT_CSS = `<style>
.pm-export-pre { background:rgba(127,127,127,.08); padding:.75rem; border-radius:.25rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:.75rem; user-select: all; white-space: pre-wrap; max-height: 480px; overflow:auto; border:1px solid var(--border, #ddd); }
.pm-export-btn {
  padding:.4rem .75rem; background:var(--accent, #4c6ef5); color:#fff;
  border-radius:.25rem; border:0; cursor:pointer; font-size:.85rem;
  font-weight:500;
}
.pm-export-btn:hover { filter:brightness(1.1); }
.pm-export-actions { margin: .5rem 0; }
</style>`;

// Script qui déclenche le téléchargement du Markdown.
const EXPORT_SCRIPT = `<script>
(function () {
  function init() {
    var btn = document.getElementById('pm-export-md-download');
    var pre = document.getElementById('pm-export-md-content');
    if (!btn || !pre) return;
    btn.addEventListener('click', function () {
      var blob = new Blob([pre.textContent], { type: 'text/markdown;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'pm-cockpit-' + new Date().toISOString().slice(0, 10) + '.md';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>`;

export function blocPmMdExport(donnees) {
  const md = genererMarkdownCockpit(donnees);
  const date = new Date().toISOString().slice(0, 10);
  return `${EXPORT_CSS}<section>
    <h2>Export Markdown complet <span class="count">snapshot pm.html → fichier .md</span></h2>
    <p class="muted" style="font-size:.85rem">Snapshot Markdown structuré du cockpit PM (état général + échéances + priorités + capacity + leaderboard + forecast + OKR + hypothèses + risques) pour archivage Notion / wiki / PR description.</p>
    <div class="pm-export-actions">
      <button type="button" class="pm-export-btn" id="pm-export-md-download">⬇ Télécharger pm-cockpit-${escape(date)}.md</button>
    </div>
    <pre id="pm-export-md-content" class="pm-export-pre">${escape(md)}</pre>
  </section>${EXPORT_SCRIPT}`;
}

// Alias EN canoniques (#42)
export {
  genererMarkdownCockpit as generateCockpitMarkdown,
  genererMarkdownCockpit as pmCockpitToMarkdown,
  genererMarkdownCockpit as pmCockpitMarkdown,
  blocPmMdExport as pmMdExportSection,
};
