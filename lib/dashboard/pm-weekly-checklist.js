// AIAD SDD Mode — Dashboard : PM weekly checklist (#491).
//
// Checklist hebdomadaire pré-remplie SDD Mode-aware avec persistance
// localStorage. Reset automatique chaque lundi (clé contient la
// semaine ISO courante).
//
// Tâches récurrentes du PM :
//   - Lundi    : standup AIAD
//   - Mardi    : nettoyer Intents zombies (deep link #a-valider-cette-semaine)
//   - Mercredi : raffiner les SPECs faibles (#sqs-readiness-scorecard)
//   - Jeudi    : préparer la demo (#preparer-la-prochaine-demo)
//   - Vendredi : envoyer la newsletter (#newsletter-pm-hebdo)
//   - Mensuel  : Atelier d'Intention (`/aiad intention`)
//   - Trimestriel : rétrospective (#retrospective-trimestrielle)
//
// Le module est purement client : aucune mutation côté serveur, la
// persistance se fait via `localStorage.aiad-pm-checklist-{semaine-iso}`.
// Reset visuel à `Reset semaine` (force nouvelle clé) + bouton
// "tout cocher".
//
// Aucun effet de bord. Pure transformation HTML+JS.
//
// Documentation : https://aiad.ovh

// Liste statique — un tableau plat permet un rendu prévisible.
const TACHES = [
  { id: 'lundi-standup', titre: 'Standup AIAD (état + blockers + intentions)', jour: 'Lundi', cadence: 'hebdo', anchor: '#stand-up-timer' },
  { id: 'mardi-zombies', titre: 'Nettoyer les Intents zombies', jour: 'Mardi', cadence: 'hebdo', anchor: '#a-valider-cette-semaine' },
  { id: 'mercredi-refinement', titre: 'Raffiner les SPECs faibles (SQS < 4)', jour: 'Mercredi', cadence: 'hebdo', anchor: '#sqs-readiness-scorecard' },
  { id: 'jeudi-demo', titre: 'Préparer la demo (revoir SPECs done)', jour: 'Jeudi', cadence: 'hebdo', anchor: '#preparer-la-prochaine-demo' },
  { id: 'vendredi-newsletter', titre: 'Envoyer la newsletter PM hebdo', jour: 'Vendredi', cadence: 'hebdo', anchor: '#newsletter-pm-hebdo' },
  { id: 'audit-narratif', titre: 'Copier le narratif stratégique pour exec sync', jour: 'Tout', cadence: 'hebdo', anchor: '#narratif-strategique' },
  { id: 'mensuel-intention', titre: 'Atelier d\'Intention (rituel mensuel humain pur)', jour: '1ᵉʳ du mois', cadence: 'mensuel', anchor: null },
  { id: 'mensuel-sync-strat', titre: 'Synchronisation alignement stratégique', jour: 'Mi-mois', cadence: 'mensuel', anchor: null },
  { id: 'trimestriel-retro', titre: 'Rétrospective trimestrielle (signaux d\'évolution)', jour: 'Fin trimestre', cadence: 'trimestriel', anchor: '#retrospective-trimestrielle' },
];

// Semaine ISO format `YYYY-Www` (week-of-year).
export function semaineIso(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // ISO week-of-year: thursday in current week determines week.
  const jour = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - jour);
  const debutAn = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const sem = Math.ceil(((d - debutAn) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(sem).padStart(2, '0')}`;
}

export function calculerWeeklyChecklist(options = {}) {
  const date = options.date || new Date();
  return {
    semaine: semaineIso(date),
    taches: TACHES,
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const WC_CSS = `<style>
.wc-week { font-size:.78rem; color:var(--muted, #777); margin-bottom:.4rem; }
.wc-actions { display:flex; gap:.5rem; margin:.4rem 0; }
.wc-btn { padding:.3rem .65rem; background:transparent; border:1px solid var(--border, #ccc); border-radius:.25rem; cursor:pointer; font-size:.78rem; color:inherit; }
.wc-btn:hover { background:rgba(127,127,127,.06); }
.wc-list { list-style:none; padding:0; margin:.5rem 0; }
.wc-item { padding:.4rem .55rem; margin:.2rem 0; border-radius:.25rem; background:rgba(127,127,127,.04); display:flex; gap:.5rem; align-items:baseline; font-size:.85rem; }
.wc-item:has(input:checked) { opacity:.55; text-decoration:line-through; background:rgba(43,138,62,.05); }
.wc-item input[type=checkbox] { transform:scale(1.1); cursor:pointer; }
.wc-jour { display:inline-block; min-width:80px; font-size:.72rem; color:var(--muted, #777); text-transform:uppercase; letter-spacing:.04em; }
.wc-cadence { font-size:.7rem; padding:.1rem .35rem; background:rgba(76,110,245,.1); color:#3a4cba; border-radius:.2rem; }
.wc-cadence.c-mensuel { background:rgba(232,89,12,.1); color:#7a3a08; }
.wc-cadence.c-trimestriel { background:rgba(201,42,42,.1); color:#7a1717; }
.wc-anchor { font-size:.78rem; margin-left:.2rem; }
.wc-progress { font-size:.85rem; padding:.3rem .55rem; background:rgba(43,138,62,.06); border-radius:.25rem; margin:.3rem 0; }
@media print { .wc-actions, .wc-btn { display:none !important; } }
</style>`;

const WC_SCRIPT = `<script>
(function () {
  var KEY_PREFIX = 'aiad-pm-checklist-';
  function init() {
    var root = document.getElementById('pm-weekly-checklist');
    if (!root) return;
    var semaine = root.getAttribute('data-semaine');
    var key = KEY_PREFIX + semaine;
    var state = {};
    try {
      var raw = localStorage.getItem(key);
      if (raw) state = JSON.parse(raw);
    } catch (e) { /* ignore */ }
    function persist() {
      try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) { /* ignore */ }
    }
    function refresh() {
      var done = 0, total = 0;
      root.querySelectorAll('input[type=checkbox][data-tache]').forEach(function (cb) {
        var id = cb.getAttribute('data-tache');
        cb.checked = !!state[id];
        total++;
        if (cb.checked) done++;
      });
      var p = root.querySelector('.wc-progress');
      if (p) p.textContent = '✓ ' + done + '/' + total + ' fait(s) cette semaine (' + semaine + ')';
    }
    root.querySelectorAll('input[type=checkbox][data-tache]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        state[cb.getAttribute('data-tache')] = cb.checked;
        persist();
        refresh();
      });
    });
    var btnReset = root.querySelector('[data-wc-action=reset]');
    if (btnReset) btnReset.addEventListener('click', function () {
      state = {};
      try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
      refresh();
    });
    var btnAll = root.querySelector('[data-wc-action=all]');
    if (btnAll) btnAll.addEventListener('click', function () {
      root.querySelectorAll('input[type=checkbox][data-tache]').forEach(function (cb) {
        state[cb.getAttribute('data-tache')] = true;
      });
      persist(); refresh();
    });
    refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>`;

export function blocWeeklyChecklist(donnees) {
  const w = donnees?.weeklyChecklist;
  if (!w) return '';
  const items = w.taches.map((t) => {
    const anchor = t.anchor ? `<a class="wc-anchor" href="${escape(t.anchor)}">→</a>` : '';
    return `<li class="wc-item">
      <input type="checkbox" data-tache="${escape(t.id)}" id="wc-${escape(t.id)}">
      <span class="wc-jour">${escape(t.jour)}</span>
      <span class="wc-cadence c-${escape(t.cadence)}">${escape(t.cadence)}</span>
      <label for="wc-${escape(t.id)}" style="flex:1; cursor:pointer">${escape(t.titre)}</label>
      ${anchor}
    </li>`;
  }).join('');
  return `${WC_CSS}<section id="pm-weekly-checklist" data-semaine="${escape(w.semaine)}">
    <h2>Checklist hebdomadaire PM <span class="count">${escape(w.semaine)} — ${w.taches.length} tâche(s) récurrente(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Tâches PM SDD Mode-aware : standup / nettoyer zombies / raffiner SPECs faibles / préparer demo / envoyer newsletter + rituels mensuels (atelier d'intention) et trimestriels (rétro). État persisté dans <code>localStorage.aiad-pm-checklist-${escape(w.semaine)}</code>, reset auto chaque lundi (semaine ISO nouvelle).</p>
    <div class="wc-progress">✓ 0/${w.taches.length} fait(s) cette semaine (${escape(w.semaine)})</div>
    <div class="wc-actions">
      <button type="button" class="wc-btn" data-wc-action="all">✓ Tout cocher</button>
      <button type="button" class="wc-btn" data-wc-action="reset">↺ Reset semaine</button>
    </div>
    <ul class="wc-list">${items}</ul>
  </section>${WC_SCRIPT}`;
}

// Alias EN canoniques (#42)
export {
  semaineIso as isoWeek,
  calculerWeeklyChecklist as computeWeeklyChecklist,
  blocWeeklyChecklist as weeklyChecklistSection,
  TACHES as WEEKLY_TASKS,
};
