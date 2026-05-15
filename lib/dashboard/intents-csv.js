// AIAD SDD Mode — Dashboard : export CSV des Intents (#444).
//
// Permet au PM de copier le catalogue complet des Intents dans Excel /
// Google Sheets / Notion table pour partager avec stakeholders non-tech.
// Génère le CSV côté serveur (inline dans le HTML) + bouton "Download
// CSV" client-side via Blob.
//
// Format RFC 4180 : virgule séparatrice, guillemets autour des champs
// contenant `,` ou `"` ou newline, double-quote pour échapper `"`.
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const COLONNES = [
  'id', 'titre', 'statut', 'priority', 'owner', 'sponsor', 'target',
  'target_date', 'avancement', 'risk_level', 'personas', 'user_stories',
  'outcomes', 'depends_on', 'date',
];

function escapeCsv(v) {
  if (v == null) return '';
  const s = String(v);
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function joinList(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return v.join('; ');
  return String(v);
}

// Construit le CSV complet. Une ligne d'en-tête + une ligne par Intent.
export function genererCsvIntents(donnees) {
  const intents = donnees?.intents || [];
  const avancementMap = new Map((donnees?.pm?.avancement || []).map((a) => [a.id, a]));
  const ownership = donnees?.ownership?.owners || [];
  // Map id → list owners (un Intent peut avoir plusieurs owners).
  const ownersById = new Map();
  for (const o of ownership) {
    for (const i of o.intents) {
      if (!ownersById.has(i.id)) ownersById.set(i.id, []);
      if (o.nom !== '_unassigned') ownersById.get(i.id).push(o.nom);
    }
  }
  const lignes = [COLONNES.map(escapeCsv).join(',')];
  for (const i of intents) {
    const av = avancementMap.get(i.id);
    const avancement = av && av.total > 0 ? `${av.done}/${av.total}` : '';
    const owners = ownersById.get(i.id) || [];
    const ligne = [
      i.id,
      i.titre || '',
      i.statut || '',
      i.priority || '',
      owners.join('; '),
      joinList(i.sponsor || i.sponsors || i.stakeholder),
      i.target || '',
      i.target_date || '',
      avancement,
      i.risk_level || '',
      joinList(i.personas || i.persona),
      joinList(i.user_stories || i.userStories),
      joinList(i.outcomes || i.outcome),
      joinList(i.depends_on || i.blocked_by),
      i.date || '',
    ].map(escapeCsv);
    lignes.push(ligne.join(','));
  }
  return lignes.join('\n') + '\n';
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const CSV_CSS = `<style>
.csv-export { margin:.5rem 0; }
.csv-pre { max-height: 220px; overflow:auto; padding:.5rem .65rem; background:rgba(127,127,127,.06); border-radius:.3rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:.72rem; line-height:1.35; user-select:all; }
.csv-btn { display:inline-block; padding:.35rem .7rem; background:var(--accent, #4c6ef5); color:#fff; border-radius:.25rem; border:0; cursor:pointer; font-size:.85rem; font-weight:500; text-decoration:none; margin-right:.4rem; }
.csv-btn:hover { filter: brightness(1.1); }
.csv-hint { color: var(--muted, #777); font-size:.75rem; margin:.3rem 0; }
</style>`;

// Script qui transforme le bouton "Télécharger" en download Blob côté
// client — pas besoin de serveur, le CSV est inline dans le HTML.
const CSV_SCRIPT = `<script>
(function () {
  function init() {
    document.querySelectorAll('button.csv-btn[data-csv-source]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var pre = document.getElementById(btn.getAttribute('data-csv-source'));
        if (!pre) return;
        var blob = new Blob([pre.textContent], { type: 'text/csv;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = btn.getAttribute('data-csv-filename') || 'intents.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>`;

export function blocCsvIntents(donnees) {
  const intents = donnees?.intents || [];
  if (intents.length === 0) return '';
  const csv = genererCsvIntents(donnees);
  const projet = (donnees?.projet?.nom || 'aiad').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const date = new Date().toISOString().slice(0, 10);
  const filename = `intents-${projet}-${date}.csv`;
  return `${CSV_CSS}<section>
    <h2>Export CSV des Intents <span class="count">${intents.length} ligne(s) — ${COLONNES.length} colonnes</span></h2>
    <p class="csv-hint">Pour partager le catalogue Intents avec un stakeholder non-tech : ouvrir dans Excel / Google Sheets / Notion. Colonnes : ${COLONNES.join(', ')}.</p>
    <div class="csv-export">
      <button type="button" class="csv-btn" data-csv-source="csv-intents-pre" data-csv-filename="${escape(filename)}">⬇ Télécharger ${escape(filename)}</button>
      <span class="csv-hint">ou clic sur le bloc ci-dessous puis <kbd>Cmd+C</kbd> / <kbd>Ctrl+C</kbd>.</span>
    </div>
    <pre id="csv-intents-pre" class="csv-pre">${escape(csv)}</pre>
  </section>${CSV_SCRIPT}`;
}

// Alias EN canoniques (#42)
export {
  genererCsvIntents as generateIntentsCsv,
  blocCsvIntents as intentsCsvSection,
  COLONNES as CSV_COLUMNS,
};
