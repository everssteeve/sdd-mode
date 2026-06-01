// AIAD SDD Mode — Dashboard : daily standup script generator (#533).
//
// Génère un **script de standup** prêt à lire, agrégeant :
//   - 🎉 Hier : SPECs done/Intents archivés ces dernières 24h
//   - 🚀 Aujourd'hui : top 3 priorités (P0/P1) actives
//   - ⛔ Blockers : Intents zombies + risques élevés découverts (#531)
//   - 🎯 Décisions à prendre : intents en review/validation
//
// Pure transformation.

const DAY = 24 * 3600 * 1000;
const PRANK = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };
const STATUTS_LIVRES = new Set(['done', 'archived']);

function poidsPrio(p) {
  if (!p) return 99;
  return PRANK[String(p).toUpperCase()] ?? 99;
}

export function calculerStandupScript(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const limite24h = now - DAY;
  // Hier : livrés dans les dernières 24h.
  const hier = {
    specs: (donnees?.specs || []).filter((s) => STATUTS_LIVRES.has(s.statut) && s.mtime && s.mtime >= limite24h),
    intents: (donnees?.intents || []).filter((i) => STATUTS_LIVRES.has(i.statut) && i.mtime && i.mtime >= limite24h),
  };
  // Aujourd'hui : top 3 P0/P1 actifs.
  const actifsPrio = (donnees?.intents || [])
    .filter((i) => (i.statut === 'active' || i.statut === 'in-progress') && (i.priority === 'P0' || i.priority === 'P1' || (i.priority && poidsPrio(i.priority) <= 1)))
    .sort((a, b) => poidsPrio(a.priority) - poidsPrio(b.priority))
    .slice(0, 3);
  // Blockers
  const zombies = (donnees?.pm?.zombies || []).slice(0, 3);
  const risquesDecouverts = (donnees?.riskTransparency?.items || []).filter((r) => !r.couvert).slice(0, 3);
  // Décisions à prendre
  const decisionsAttendues = (donnees?.specs || []).filter((s) => s.statut === 'review' || s.statut === 'validation').slice(0, 3);
  // Compose script texte
  const lignes = [];
  lignes.push(`# Standup ${new Date(now).toLocaleDateString('fr-FR')}`);
  lignes.push('');
  if (hier.specs.length + hier.intents.length > 0) {
    lignes.push('## 🎉 Hier (livrés dans les 24h)');
    for (const s of hier.specs) lignes.push(`- ✅ SPEC ${s.id}${s.titre ? ' — ' + s.titre : ''}`);
    for (const i of hier.intents) lignes.push(`- ✅ Intent ${i.id}${i.titre ? ' — ' + i.titre : ''} (archivé)`);
    lignes.push('');
  }
  if (actifsPrio.length > 0) {
    lignes.push("## 🚀 Aujourd'hui (top 3 priorités)");
    for (const i of actifsPrio) lignes.push(`- ${i.id} [${String(i.priority || '?').toUpperCase()}] — ${i.titre || ''}`);
    lignes.push('');
  }
  if (zombies.length + risquesDecouverts.length > 0) {
    lignes.push('## ⛔ Blockers / Risques');
    for (const z of zombies) lignes.push(`- 🧟 Zombie : ${z.id} — ${z.anciennete}j sans SPEC remuée`);
    for (const r of risquesDecouverts) lignes.push(`- ⚠ Risque ${r.niveau} découvert : ${r.id}`);
    lignes.push('');
  }
  if (decisionsAttendues.length > 0) {
    lignes.push('## 🎯 Décisions à prendre');
    for (const s of decisionsAttendues) lignes.push(`- 🔍 SPEC ${s.id} en ${s.statut}`);
    lignes.push('');
  }
  if (lignes.length <= 2) {
    lignes.push('_Aucun signal majeur à reporter — équipe au calme._');
  }
  return {
    texte: lignes.join('\n'),
    sections: {
      hierCount: hier.specs.length + hier.intents.length,
      priorites: actifsPrio.length,
      blockers: zombies.length + risquesDecouverts.length,
      decisions: decisionsAttendues.length,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const SS_CSS = `<style>
.ss-script { padding:.7rem .85rem; background:rgba(127,127,127,.05); border-radius:.3rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:.82rem; white-space:pre-wrap; user-select:all; max-height:340px; overflow:auto; }
.ss-actions { display:flex; gap:.5rem; margin:.4rem 0; align-items:center; }
.ss-btn { padding:.3rem .7rem; border:1px solid var(--border, #ccc); background:transparent; border-radius:.25rem; cursor:pointer; font-size:.8rem; color:inherit; }
.ss-btn:hover { background:rgba(127,127,127,.06); }
.ss-meta { display:flex; gap:.3rem; flex-wrap:wrap; font-size:.75rem; margin:.3rem 0; }
.ss-chip { padding:.1rem .4rem; background:rgba(127,127,127,.08); border-radius:.18rem; }
.ss-chip.has { background:rgba(76,110,245,.1); color:#3a4cba; font-weight:500; }
</style>`;

const SS_SCRIPT = `<script>
(function () {
  function init() {
    var btn = document.querySelector('[data-ss-action=copy]');
    if (!btn) return;
    var target = document.getElementById('aiad-standup-script');
    btn.addEventListener('click', function () {
      if (!target || !navigator.clipboard) return;
      navigator.clipboard.writeText(target.textContent).then(function () {
        var orig = btn.textContent;
        btn.textContent = '✓ Copié';
        setTimeout(function () { btn.textContent = orig; }, 1500);
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>`;

export function blocStandupScript(donnees) {
  const s = donnees?.standupScript;
  if (!s) return '';
  const sec = s.sections;
  return `${SS_CSS}<section>
    <h2>Script standup auto <span class="count">prêt à copier pour le daily</span></h2>
    <p class="muted" style="font-size:.85rem">Script Markdown agrégé : 🎉 hier (24h livrés) · 🚀 top 3 priorités · ⛔ blockers / risques découverts · 🎯 décisions à prendre. Copier puis lire/poster dans le canal team.</p>
    <div class="ss-meta">
      <span class="ss-chip${sec.hierCount > 0 ? ' has' : ''}">${sec.hierCount} hier</span>
      <span class="ss-chip${sec.priorites > 0 ? ' has' : ''}">${sec.priorites} priorité(s)</span>
      <span class="ss-chip${sec.blockers > 0 ? ' has' : ''}">${sec.blockers} blocker(s)</span>
      <span class="ss-chip${sec.decisions > 0 ? ' has' : ''}">${sec.decisions} décision(s)</span>
    </div>
    <div class="ss-actions">
      <button type="button" class="ss-btn" data-ss-action="copy">📋 Copier le script</button>
    </div>
    <div class="ss-script" id="aiad-standup-script">${escape(s.texte)}</div>
  </section>${SS_SCRIPT}`;
}

// Alias EN canoniques (#42)
export {
  calculerStandupScript as computeStandupScript,
  blocStandupScript as standupScriptSection,
};
