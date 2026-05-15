// AIAD SDD Mode — Dashboard : quarterly retrospective draft (#534).
//
// Génère un brouillon Markdown de **rétrospective trimestrielle**
// agrégeant automatiquement les données du dashboard :
//   - Période couverte (trimestre courant)
//   - Livraisons (SPECs done + Intents archivés sur 90j)
//   - Métriques clés (vélocité, throughput, santé)
//   - Risques marquants
//   - Apprentissages (hypothèses validées/invalidées)
//   - Sujets pour la rétro humaine (suggestions)
//
// Pure transformation.

const DAY = 24 * 3600 * 1000;
const QUARTER_DAYS = 90;
const STATUTS_LIVRES = new Set(['done', 'archived']);

function quarterCourant(d) {
  const m = d.getUTCMonth();
  return `Q${Math.floor(m / 3) + 1}-${d.getUTCFullYear()}`;
}

export function calculerQuarterlyRetroDraft(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const dt = new Date(now);
  const trim = quarterCourant(dt);
  const limite = now - QUARTER_DAYS * DAY;
  // Livraisons
  const specsLivrees = (donnees?.specs || []).filter((s) => STATUTS_LIVRES.has(s.statut) && s.mtime && s.mtime >= limite);
  const intentsArchives = (donnees?.intents || []).filter((i) => STATUTS_LIVRES.has(i.statut) && i.mtime && i.mtime >= limite);
  // Hypothèses
  const lifecycle = donnees?.hypothesisLifecycle || {};
  // Risques
  const risques = (donnees?.risks?.intents || []).filter((r) => r.niveau === 'critical' || r.niveau === 'high');
  // Forecast
  const forecast = donnees?.velocityForecast;
  // Throughput
  const throughput = donnees?.throughputTrend;
  // Santé courante
  const sante = donnees?.santeGlobale;
  // Compose draft
  const lignes = [];
  const projet = donnees?.projet?.nom || 'projet';
  lignes.push(`# Rétrospective ${trim} — ${projet}`);
  lignes.push('');
  lignes.push(`_Brouillon généré automatiquement le ${new Date(now).toLocaleDateString('fr-FR')} depuis le dashboard PM. À enrichir en atelier équipe._`);
  lignes.push('');
  // 1. Livraisons
  lignes.push('## 1. 🎉 Livraisons du trimestre');
  if (specsLivrees.length + intentsArchives.length === 0) {
    lignes.push('_Aucune livraison enregistrée ce trimestre — à creuser en atelier._');
  } else {
    if (specsLivrees.length > 0) {
      lignes.push(`### SPECs livrées (${specsLivrees.length})`);
      for (const s of specsLivrees.slice(0, 10)) lignes.push(`- ${s.id}${s.titre ? ' — ' + s.titre : ''}`);
      if (specsLivrees.length > 10) lignes.push(`- _… +${specsLivrees.length - 10} autres_`);
    }
    if (intentsArchives.length > 0) {
      lignes.push('');
      lignes.push(`### Intents archivés (${intentsArchives.length})`);
      for (const i of intentsArchives.slice(0, 6)) lignes.push(`- ${i.id}${i.titre ? ' — ' + i.titre : ''}`);
    }
  }
  lignes.push('');
  // 2. Métriques
  lignes.push('## 2. 📊 Métriques clés');
  if (forecast && forecast.rythmeMoyen != null) {
    lignes.push(`- Vélocité moyenne : **${forecast.rythmeMoyen} SPECs/sem** (slope ${forecast.reg?.slope || 0})`);
  }
  if (throughput) {
    lignes.push(`- Throughput backlog : ${throughput.cumul?.intake || 0} intake vs ${throughput.cumul?.delivery || 0} delivery sur ${throughput.nbSem || 6} sem (direction : ${throughput.direction})`);
  }
  if (sante && sante.score != null) {
    lignes.push(`- Santé projet : **${sante.score}/100** (${sante.niveau || '?'})`);
  }
  lignes.push('');
  // 3. Hypothèses
  lignes.push('## 3. 🧪 Hypothèses (apprentissages)');
  if (lifecycle?.totaux?.total > 0) {
    lignes.push(`- Total formulées : ${lifecycle.totaux.total}`);
    lignes.push(`- ✓ Validées : ${lifecycle.totaux.validated || 0} (${lifecycle.tauxValidation || 0}%)`);
    lignes.push(`- ✗ Invalidées : ${lifecycle.totaux.invalidated || 0}`);
    lignes.push(`- ◐ Partielles : ${lifecycle.totaux.partial || 0}`);
    if (lifecycle.stagnantes > 0) lignes.push(`- ⚠ Stagnent &gt; 30j : ${lifecycle.stagnantes}`);
  } else {
    lignes.push('_Aucune hypothèse formulée — opportunité d\'instaurer la pratique._');
  }
  lignes.push('');
  // 4. Risques
  lignes.push('## 4. ⚠ Risques marquants');
  if (risques.length === 0) {
    lignes.push('_Aucun risque critical/high — portefeuille en bon état._');
  } else {
    for (const r of risques.slice(0, 5)) lignes.push(`- **${r.id}** [${r.niveau}]${r.titre ? ' — ' + r.titre : ''}`);
  }
  lignes.push('');
  // 5. Sujets atelier
  lignes.push('## 5. 🤝 Sujets pour la rétro humaine');
  lignes.push('À remplir en atelier :');
  lignes.push('- Qu\'est-ce qui a bien fonctionné ?');
  lignes.push('- Qu\'est-ce qui a mal fonctionné ?');
  lignes.push('- Quelle action concrète pour le prochain trimestre ?');
  lignes.push('');
  lignes.push('---');
  lignes.push('_Généré par aiad-sdd dashboard — humain garde la paternité de la rétro réelle._');
  return {
    trim,
    texte: lignes.join('\n'),
    meta: {
      specsLivrees: specsLivrees.length,
      intentsArchives: intentsArchives.length,
      hypotheses: lifecycle?.totaux?.total || 0,
      risques: risques.length,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const QR_CSS = `<style>
.qr-pre { padding:.7rem .85rem; background:rgba(127,127,127,.05); border-radius:.3rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:.8rem; white-space:pre-wrap; user-select:all; max-height:480px; overflow:auto; }
.qr-actions { display:flex; gap:.5rem; margin:.4rem 0; }
.qr-btn { padding:.3rem .7rem; border:1px solid var(--border, #ccc); background:transparent; border-radius:.25rem; cursor:pointer; font-size:.8rem; color:inherit; }
.qr-btn:hover { background:rgba(127,127,127,.06); }
.qr-meta { display:flex; gap:.3rem; flex-wrap:wrap; font-size:.75rem; margin:.3rem 0; }
.qr-chip { padding:.1rem .4rem; background:rgba(127,127,127,.08); border-radius:.18rem; }
</style>`;

const QR_SCRIPT = `<script>
(function () {
  function init() {
    var btn = document.querySelector('[data-qr-action=copy]');
    var target = document.getElementById('aiad-qr-draft');
    if (!btn || !target) return;
    btn.addEventListener('click', function () {
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

export function blocQuarterlyRetroDraft(donnees) {
  const r = donnees?.quarterlyRetroDraft;
  if (!r) return '';
  const m = r.meta;
  return `${QR_CSS}<section>
    <h2>Brouillon rétro trimestrielle <span class="count">${escape(r.trim)} · ${m.specsLivrees} SPECs + ${m.intentsArchives} Intents archivés</span></h2>
    <p class="muted" style="font-size:.85rem">Brouillon Markdown auto-agrégé pour la rétrospective trimestrielle (livraisons 90j, métriques, hypothèses, risques + 3 questions atelier). À enrichir en équipe — l'humain garde la paternité de la rétro réelle.</p>
    <div class="qr-meta">
      <span class="qr-chip">${escape(r.trim)}</span>
      <span class="qr-chip">${m.specsLivrees} SPECs</span>
      <span class="qr-chip">${m.intentsArchives} Intents</span>
      <span class="qr-chip">${m.hypotheses} hypothèses</span>
      <span class="qr-chip">${m.risques} risques élevés</span>
    </div>
    <div class="qr-actions">
      <button type="button" class="qr-btn" data-qr-action="copy">📋 Copier le draft</button>
    </div>
    <div class="qr-pre" id="aiad-qr-draft">${escape(r.texte)}</div>
  </section>${QR_SCRIPT}`;
}

// Alias EN canoniques (#42)
export {
  calculerQuarterlyRetroDraft as computeQuarterlyRetroDraft,
  blocQuarterlyRetroDraft as quarterlyRetroDraftSection,
};
