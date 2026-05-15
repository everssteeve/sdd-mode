// AIAD SDD Mode — Dashboard : Intent compare side-by-side (#501).
//
// Permet de sélectionner 2-4 Intents et de les afficher côte-à-côte
// sur une grille de critères clés pour aider la décision PM :
//   "lequel des deux dois-je prioriser ?".
//
// Sélection :
//   - Par défaut : les 3 Intents non-archived avec la priorité la plus forte
//   - Override via URL hash : #compare=INTENT-101,INTENT-103
//   - Tag client : `[data-compare-id]` sur chaque colonne, JS observe `hashchange`
//
// Critères affichés :
//   - Priorité / statut / sponsor / owner
//   - Hypothèse + état hypothèse
//   - SQS readiness (depuis #484)
//   - Avancement SPECs (depuis #231 calculerAvancement)
//   - target_date
//   - Risque niveau (depuis #439)
//   - Dépendances bloquantes (depuis #434 deps)
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

function meilleureSelection(intents) {
  const PRANK = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };
  const candidats = (intents || []).filter((i) => !['done', 'archived'].includes(i.statut));
  candidats.sort((a, b) => {
    const pa = a.priority ? (PRANK[String(a.priority).toUpperCase()] ?? 99) : 99;
    const pb = b.priority ? (PRANK[String(b.priority).toUpperCase()] ?? 99) : 99;
    return pa - pb;
  });
  return candidats.slice(0, 3).map((i) => i.id);
}

function lireSqsEtat(donnees, intentId) {
  const items = donnees?.sqsReadiness?.items || [];
  return items.find((it) => it.id === intentId);
}

function lireAvancement(donnees, intentId) {
  const av = donnees?.pm?.avancement || [];
  return av.find((a) => a.id === intentId);
}

function lireRisque(donnees, intentId) {
  const r = donnees?.risks?.intents || [];
  return r.find((x) => x.id === intentId);
}

function lireDeps(donnees, intentId) {
  const d = donnees?.deps?.intents || [];
  return d.find((x) => x.id === intentId);
}

export function calculerIntentCompare(donnees) {
  const intents = donnees?.intents || [];
  const ids = meilleureSelection(intents);
  const idIndex = new Map(intents.map((i) => [i.id, i]));
  const colonnes = ids.map((id) => {
    const i = idIndex.get(id);
    if (!i) return null;
    return {
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      priority: i.priority || null,
      statut: i.statut || '?',
      sponsor: i.sponsor || null,
      owner: i.owner || null,
      targetDate: i.target_date || i.targetDate || null,
      hypothesis: i.hypothesis || i.Hypothesis || null,
      hypothesisStatus: i.hypothesis_status || i.hypothesisStatus || null,
      sqs: lireSqsEtat(donnees, id) || null,
      avancement: lireAvancement(donnees, id) || null,
      risque: lireRisque(donnees, id) || null,
      deps: lireDeps(donnees, id) || null,
    };
  }).filter(Boolean);
  return { colonnes, defautIds: ids, totalIntentsDispo: intents.length };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const IC_CSS = `<style>
.ic-grid { display:grid; grid-template-columns: 160px repeat(auto-fit, minmax(180px, 1fr)); gap:0; border:1px solid var(--border, #ddd); border-radius:.35rem; overflow:hidden; font-size:.85rem; }
.ic-grid > * { padding:.4rem .55rem; border-bottom:1px solid var(--border, #f1f1f1); }
.ic-key { background:rgba(127,127,127,.05); font-weight:500; color:var(--muted, #555); font-size:.78rem; text-transform:uppercase; letter-spacing:.04em; }
.ic-col-head { font-weight:600; background:rgba(76,110,245,.05); border-left:1px solid var(--border, #eee); }
.ic-cell { background:var(--card-bg, #fff); border-left:1px solid var(--border, #f3f3f3); }
.ic-tag { display:inline-block; padding:.05rem .35rem; background:rgba(127,127,127,.1); border-radius:.18rem; font-size:.75rem; margin-right:.2rem; }
.ic-tag.p-P0 { background:rgba(201,42,42,.12); color:#7a1717; }
.ic-tag.p-P1 { background:rgba(232,89,12,.12); color:#7a3a08; }
.ic-tag.r-ready { background:rgba(43,138,62,.12); color:#1c5a2a; }
.ic-tag.r-partial, .ic-tag.r-needs-work { background:rgba(232,89,12,.12); color:#7a3a08; }
.ic-tag.r-no-spec { background:rgba(127,127,127,.1); }
.ic-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
.ic-actions { display:flex; gap:.5rem; margin:.3rem 0; align-items:center; flex-wrap:wrap; font-size:.85rem; }
.ic-input { padding:.25rem .5rem; border:1px solid var(--border, #ccc); border-radius:.2rem; font-size:.8rem; font-family:inherit; min-width:240px; }
</style>`;

const IC_SCRIPT = `<script>
(function () {
  function init() {
    var sec = document.getElementById('intent-compare-section');
    if (!sec) return;
    var input = sec.querySelector('#ic-input');
    var defautIds = (sec.getAttribute('data-default-ids') || '').split(',').filter(Boolean);
    function appliquer(ids) {
      // mise à jour visuelle minimale : signale les colonnes via title
      sec.querySelectorAll('[data-compare-id]').forEach(function (col) {
        var id = col.getAttribute('data-compare-id');
        col.style.display = ids.includes(id) ? '' : 'none';
      });
      // si un id n'est pas pré-rendu, on émet un message d'info
      var actifs = ids.filter(function (id) {
        return sec.querySelector('[data-compare-id="' + id + '"]');
      });
      var msg = sec.querySelector('.ic-msg');
      if (msg) {
        if (actifs.length < ids.length) {
          msg.textContent = '⚠ ' + (ids.length - actifs.length) + ' ID(s) non trouvé(s) en pré-rendu — relance dashboard avec hash #compare=' + ids.join(',');
          msg.style.display = '';
        } else {
          msg.style.display = 'none';
        }
      }
    }
    function fromHash() {
      var m = (location.hash || '').match(/compare=([^&]+)/);
      var ids = m ? decodeURIComponent(m[1]).split(',').map(function (s) { return s.trim(); }).filter(Boolean) : defautIds;
      if (input) input.value = ids.join(', ');
      appliquer(ids);
    }
    window.addEventListener('hashchange', fromHash);
    if (input) {
      input.addEventListener('change', function () {
        var ids = (input.value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        location.hash = 'compare=' + ids.join(',');
      });
    }
    fromHash();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>`;

function fmtTag(label, cls) {
  return `<span class="ic-tag ${cls || ''}">${escape(label)}</span>`;
}

function rendreCellule(c, cle) {
  switch (cle) {
    case 'id': return c.file ? lienSource(c.file, c.id) : `<code>${escape(c.id)}</code>`;
    case 'titre': return escape((c.titre || '').slice(0, 80));
    case 'priority': return c.priority ? fmtTag(String(c.priority).toUpperCase(), 'p-' + String(c.priority).toUpperCase()) : '—';
    case 'statut': return fmtTag(c.statut);
    case 'sponsor': return c.sponsor ? escape(String(Array.isArray(c.sponsor) ? c.sponsor.join(' / ') : c.sponsor)) : '—';
    case 'owner': return c.owner ? escape(String(Array.isArray(c.owner) ? c.owner.join(' / ') : c.owner)) : '—';
    case 'targetDate': return c.targetDate ? escape(String(c.targetDate)) : '—';
    case 'hypothesis': return c.hypothesis ? `<em>${escape(String(c.hypothesis).slice(0, 100))}</em>${c.hypothesisStatus ? ' ' + fmtTag(String(c.hypothesisStatus)) : ''}` : '—';
    case 'sqs':
      if (!c.sqs) return '—';
      return fmtTag(c.sqs.etat, 'r-' + c.sqs.etat) + (c.sqs.score?.scored ? ` <span class="muted">${c.sqs.score.min}-${c.sqs.score.avg}/5</span>` : '');
    case 'avancement':
      if (!c.avancement) return '—';
      const a = c.avancement;
      return `${a.done}/${a.total} SPEC(s)${a.enCours > 0 ? ` <span class="muted">(${a.enCours} en cours)</span>` : ''}`;
    case 'risque':
      if (!c.risque || !c.risque.niveau || c.risque.niveau === 'low') return '—';
      return fmtTag(String(c.risque.niveau));
    case 'deps':
      if (!c.deps) return '—';
      const bloque = c.deps.bloquePar?.length || 0;
      const bloqueParAutres = c.deps.bloque?.length || 0;
      if (bloque === 0 && bloqueParAutres === 0) return '—';
      return `${bloque ? bloque + ' bloque(nt)' : ''}${bloque && bloqueParAutres ? ' · ' : ''}${bloqueParAutres ? bloqueParAutres + ' bloqué(s) par' : ''}`;
    default: return '—';
  }
}

const LIGNES = [
  { cle: 'titre', label: 'Titre' },
  { cle: 'priority', label: 'Priorité' },
  { cle: 'statut', label: 'Statut' },
  { cle: 'sponsor', label: 'Sponsor' },
  { cle: 'owner', label: 'Owner' },
  { cle: 'targetDate', label: 'Échéance' },
  { cle: 'sqs', label: 'SQS readiness' },
  { cle: 'avancement', label: 'Avancement' },
  { cle: 'hypothesis', label: 'Hypothèse' },
  { cle: 'risque', label: 'Risque' },
  { cle: 'deps', label: 'Dépendances' },
];

export function blocIntentCompare(donnees) {
  const c = donnees?.intentCompare;
  if (!c) return '';
  if (c.colonnes.length === 0) {
    return `${IC_CSS}<section id="intent-compare-section">
      <h2>Compare Intents <span class="count">aucun Intent actif</span></h2>
      <p class="muted" style="font-size:.85rem">Le module compare 2-4 Intents côte-à-côte sur 11 critères (priorité / SQS / avancement / risque / dépendances…). Capture des Intents avec <code>/sdd intent</code> pour activer la comparaison.</p>
    </section>`;
  }
  const defaultIds = c.defautIds.join(',');
  const headers = c.colonnes.map((col) => `<div class="ic-col-head" data-compare-id="${escape(col.id)}">${rendreCellule(col, 'id')}</div>`).join('');
  const rangees = LIGNES.map((l) => {
    const cells = c.colonnes.map((col) => `<div class="ic-cell" data-compare-id="${escape(col.id)}">${rendreCellule(col, l.cle)}</div>`).join('');
    return `<div class="ic-key">${escape(l.label)}</div>${cells}`;
  }).join('');
  const exempleHash = c.defautIds.slice(0, 2).join(',');
  return `${IC_CSS}<section id="intent-compare-section" data-default-ids="${escape(defaultIds)}">
    <h2>Compare Intents <span class="count">${c.colonnes.length} colonne(s) sur ${c.totalIntentsDispo} Intent(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Comparaison côte-à-côte de 2-4 Intents sur 11 critères clés. Sélection par défaut : top 3 priorité. Override via URL <code>#compare=INTENT-101,INTENT-103</code> ou via le champ ci-dessous.</p>
    <div class="ic-actions">
      <label for="ic-input">IDs :</label>
      <input type="text" id="ic-input" class="ic-input" value="${escape(defaultIds)}" placeholder="ex. ${escape(exempleHash)}"/>
      <span class="ic-msg" style="display:none; font-size:.78rem; color:#7a3a08"></span>
    </div>
    <div class="ic-grid" style="grid-template-columns: 160px repeat(${c.colonnes.length}, minmax(180px, 1fr));">
      <div class="ic-key">ID</div>${headers}
      ${rangees}
    </div>
  </section>${IC_SCRIPT}`;
}

// Alias EN canoniques (#42)
export {
  calculerIntentCompare as computeIntentCompare,
  blocIntentCompare as intentCompareSection,
};
