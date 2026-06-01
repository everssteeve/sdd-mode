// AIAD SDD Mode — Dashboard : auto-suggested demo agenda (#512).
//
// Génère un brouillon d'agenda pour la **prochaine demo** : liste des
// SPECs `done` non encore démontrées (`#137 specsNonDemontrees`)
// groupées par Intent parent, avec priorité héritée de l'Intent, et
// suggestion de temps par item (3min/SPEC + 2min intro Intent).
//
// Sources :
//   - `donnees.pm.specsNonDemontrees` (#137)
//   - `donnees.intents` (pour titre + priorité parent)
//
// Politique :
//   - Tri par priorité de l'Intent (P0 > P1 > P2 > …) puis SPEC mtime asc
//   - Groupement par Intent parent (court INTENT-NNN)
//   - Temps cible = 30 min ; coupe la liste quand atteint
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const PRANK = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };

const DUREE_INTRO = 2; // min par Intent
const DUREE_SPEC = 3; // min par SPEC
const DUREE_CIBLE = 30; // min max demo

function poidsPrio(p) {
  if (!p) return 99;
  return PRANK[String(p).toUpperCase()] ?? 99;
}

export function calculerDemoAgenda(donnees, options = {}) {
  const dureeCible = options.dureeCible || DUREE_CIBLE;
  const specsNonDemontrees = donnees?.pm?.specsNonDemontrees || [];
  if (specsNonDemontrees.length === 0) {
    return { items: [], temps: 0, coupes: 0, dureeCible, message: 'aucune SPEC à démontrer' };
  }
  const intentsParCourt = new Map();
  for (const i of donnees?.intents || []) {
    const court = i.id.split('-').slice(0, 2).join('-');
    intentsParCourt.set(court, i);
  }
  // Group specs par Intent parent.
  const groupes = new Map();
  for (const s of specsNonDemontrees) {
    // s a id (long, ex. SPEC-101-1-formulaire-paiement) → parent court INTENT-101
    const m = s.id.match(/^SPEC-(\d+)/);
    const court = m ? `INTENT-${m[1]}` : 'INTENT-?';
    if (!groupes.has(court)) {
      const intent = intentsParCourt.get(court);
      groupes.set(court, {
        intentId: court,
        intentTitre: intent?.titre || '?',
        priority: intent?.priority || null,
        intentFile: intent?.file || null,
        specs: [],
      });
    }
    groupes.get(court).specs.push({
      id: s.id,
      titre: s.titre || '',
      mtime: s.mtime || 0,
      file: s.file || null,
    });
  }
  // Tri global : priorité Intent asc, puis SPEC mtime asc dans chaque Intent.
  const ordres = [...groupes.values()].sort((a, b) => poidsPrio(a.priority) - poidsPrio(b.priority));
  for (const g of ordres) {
    g.specs.sort((a, b) => a.mtime - b.mtime);
  }
  // Coupe selon durée cible.
  const items = [];
  let temps = 0;
  let coupes = 0;
  for (const g of ordres) {
    const tempsAvant = temps;
    if (g.specs.length === 0) continue;
    if (tempsAvant + DUREE_INTRO > dureeCible) {
      coupes += g.specs.length;
      continue;
    }
    const groupe = { ...g, dureeIntro: DUREE_INTRO, specsAdmis: [], specsCoupees: [] };
    temps += DUREE_INTRO;
    for (const s of g.specs) {
      if (temps + DUREE_SPEC > dureeCible) {
        groupe.specsCoupees.push(s);
        coupes++;
        continue;
      }
      temps += DUREE_SPEC;
      groupe.specsAdmis.push(s);
    }
    groupe.duree = DUREE_INTRO + groupe.specsAdmis.length * DUREE_SPEC;
    items.push(groupe);
  }
  return { items, temps, coupes, dureeCible, totauxSpecsDispo: specsNonDemontrees.length };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const DA_CSS = `<style>
.da-meta { padding:.4rem .55rem; background:rgba(76,110,245,.05); border-radius:.25rem; font-size:.85rem; margin:.3rem 0; }
.da-meta.is-coupee { background:rgba(232,89,12,.07); border-left:3px solid #e8590c; }
.da-group { padding:.55rem .7rem; margin:.4rem 0; background:rgba(127,127,127,.04); border-radius:.35rem; border-left:3px solid #4c6ef5; }
.da-head { font-weight:600; font-size:.9rem; display:flex; gap:.4rem; align-items:baseline; flex-wrap:wrap; }
.da-prio { padding:.05rem .35rem; background:rgba(127,127,127,.1); border-radius:.18rem; font-size:.7rem; }
.da-prio.p-P0 { background:rgba(201,42,42,.12); color:#7a1717; }
.da-prio.p-P1 { background:rgba(232,89,12,.12); color:#7a3a08; }
.da-list { list-style:none; padding:0; margin:.3rem 0 0; }
.da-list li { padding:.2rem 0; font-size:.82rem; display:flex; gap:.4rem; align-items:baseline; }
.da-list li.coupe { opacity:.5; text-decoration:line-through; }
.da-duree { font-size:.7rem; color:var(--muted, #777); margin-left:auto; }
.da-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
.da-print-btn { padding:.3rem .65rem; border:1px solid var(--border, #ccc); background:transparent; border-radius:.25rem; cursor:pointer; font-size:.78rem; }
@media print { .da-print-btn { display:none !important; } }
</style>`;

const DA_SCRIPT = `<script>
(function () {
  function init() {
    var btn = document.querySelector('[data-da-action=print]');
    if (!btn) return;
    btn.addEventListener('click', function () { window.print(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>`;

export function blocDemoAgenda(donnees) {
  const a = donnees?.demoAgenda;
  if (!a) return '';
  if (a.message) {
    return `${DA_CSS}<section>
      <h2>Agenda demo auto <span class="count">${escape(a.message)}</span></h2>
      <div class="da-empty">Aucune SPEC done sans demo tracée. Lance <code>/aiad demo</code> pour marquer la prochaine session ou continue de livrer pour alimenter l'agenda.</div>
    </section>`;
  }
  const groupes = a.items.map((g) => {
    const idCell = g.intentFile ? lienSource(g.intentFile, g.intentId) : `<code>${escape(g.intentId)}</code>`;
    const prio = g.priority ? `<span class="da-prio p-${escape(String(g.priority).toUpperCase())}">${escape(String(g.priority).toUpperCase())}</span>` : '';
    const items = [
      ...g.specsAdmis.map((s) => `<li><span>${s.file ? lienSource(s.file, s.id) : `<code>${escape(s.id)}</code>`}</span><span>${escape((s.titre || '').slice(0, 50))}</span><span class="da-duree">~3 min</span></li>`),
      ...g.specsCoupees.map((s) => `<li class="coupe"><span>${escape(s.id)}</span><span>${escape((s.titre || '').slice(0, 50))}</span><span class="da-duree">coupé (hors temps)</span></li>`),
    ].join('');
    return `<div class="da-group">
      <div class="da-head">
        <strong>${idCell}</strong>
        ${prio}
        <span>${escape((g.intentTitre || '').slice(0, 60))}</span>
        <span class="da-duree">~${g.duree} min</span>
      </div>
      <ul class="da-list">${items}</ul>
    </div>`;
  }).join('');
  const coupeBox = a.coupes > 0
    ? `<div class="da-meta is-coupee">⏱ <strong>${a.coupes} SPEC(s) coupée(s)</strong> hors fenêtre ${a.dureeCible} min. Allonger la demo ou reporter à la session suivante.</div>`
    : '';
  return `${DA_CSS}<section>
    <h2>Agenda demo auto <span class="count">~${a.temps} min sur cible ${a.dureeCible} min · ${a.items.length} Intent(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Brouillon d'agenda généré depuis les SPECs <code>done</code> non démontrées (#137). Tri priorité Intent (P0→P4), groupage par Intent parent, budget temps : ${DUREE_INTRO}min intro + ${DUREE_SPEC}min/SPEC.</p>
    <div style="margin:.3rem 0"><button type="button" class="da-print-btn" data-da-action="print">🖨 Imprimer l'agenda</button></div>
    ${coupeBox}
    ${groupes}
  </section>${DA_SCRIPT}`;
}

// Alias EN canoniques (#42)
export {
  calculerDemoAgenda as computeDemoAgenda,
  blocDemoAgenda as demoAgendaSection,
};
