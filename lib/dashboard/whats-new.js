// AIAD SDD Mode — Dashboard : "What's new since your last visit" (#497).
//
// Mémorise dans `localStorage.aiad-pm-last-visit` le timestamp de la
// dernière fois où le PM a consulté pm.html. Au prochain chargement,
// liste les artefacts (Intents, SPECs, journal entries) modifiés
// depuis. Bouton "Marquer tout lu" pour ressetter.
//
// Pure client-side : la liste d'items modifiables est embarquée par
// le serveur (mtime), le filtrage se fait dans le navigateur.
//
// Aucun effet de bord. Pure transformation + script JS.
//
// Documentation : https://aiad.ovh

export function calculerWhatsNew(donnees) {
  const items = [];
  for (const i of donnees?.intents || []) {
    if (!i.mtime) continue;
    items.push({ type: 'intent', id: i.id, titre: i.titre || '', mtime: i.mtime, file: i.file || null });
  }
  for (const s of donnees?.specs || []) {
    if (!s.mtime) continue;
    items.push({ type: 'spec', id: s.id, titre: s.titre || '', mtime: s.mtime, parentIntent: s.parentIntent || null, statut: s.statut || null });
  }
  // Toujours utile : on inclut tout, le client filtre selon localStorage.
  items.sort((a, b) => b.mtime - a.mtime);
  return { items: items.slice(0, 60), nowMs: Date.now() };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const WN_CSS = `<style>
#whats-new-section { /* fixé visible au top, masque toggle après "mark all read" */ }
.wn-list { list-style:none; padding:0; margin:.4rem 0; max-height:240px; overflow:auto; border:1px solid var(--border, #ddd); border-radius:.3rem; }
.wn-item { padding:.35rem .55rem; border-bottom:1px solid var(--border, #f3f3f3); display:flex; gap:.4rem; align-items:baseline; font-size:.85rem; }
.wn-item:last-child { border-bottom:0; }
.wn-item.is-new { background:rgba(76,110,245,.06); }
.wn-type { font-size:.7rem; padding:.05rem .35rem; background:rgba(76,110,245,.12); color:#3a4cba; border-radius:.18rem; text-transform:uppercase; }
.wn-type.t-spec { background:rgba(232,89,12,.12); color:#7a3a08; }
.wn-meta { font-size:.72rem; color:var(--muted, #777); margin-left:auto; }
.wn-actions { display:flex; gap:.5rem; align-items:center; margin:.3rem 0; }
.wn-btn { padding:.25rem .6rem; background:transparent; border:1px solid var(--border, #ccc); border-radius:.2rem; cursor:pointer; font-size:.76rem; color:inherit; }
.wn-btn:hover { background:rgba(127,127,127,.06); }
.wn-empty { padding:.5rem .7rem; background:rgba(43,138,62,.06); border-left:3px solid #2b8a3e; border-radius:.25rem; font-size:.85rem; color:#1c5a2a; }
@media print { #whats-new-section { display:none !important; } }
</style>`;

const WN_SCRIPT = `<script>
(function () {
  var KEY = 'aiad-pm-last-visit';
  function init() {
    var sec = document.getElementById('whats-new-section');
    if (!sec) return;
    var data = (window.AIAD_WHATS_NEW || []);
    var nowMs = Number(sec.getAttribute('data-now-ms')) || Date.now();
    var lastVisit = 0;
    try { lastVisit = Number(localStorage.getItem(KEY)) || 0; } catch (e) {}
    var listEl = sec.querySelector('.wn-list');
    var emptyEl = sec.querySelector('.wn-empty');
    var counterEl = sec.querySelector('.wn-counter');
    var nb = 0;
    data.forEach(function (it) {
      if (lastVisit > 0 && it.mtime <= lastVisit) return; // pas nouveau
      var li = document.createElement('li');
      li.className = 'wn-item is-new';
      var date = new Date(it.mtime).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      li.innerHTML = '<span class="wn-type t-' + it.type + '">' + it.type + '</span>' +
        '<code>' + it.id + '</code>' +
        '<span>' + (it.titre || '').slice(0, 60) + '</span>' +
        '<span class="wn-meta">' + date + '</span>';
      listEl.appendChild(li);
      nb++;
    });
    if (counterEl) counterEl.textContent = (lastVisit === 0 ? 'première visite — ' + data.length + ' artefacts récents' : nb + ' nouveau(x) depuis ' + new Date(lastVisit).toLocaleString('fr-FR'));
    if (nb === 0 && lastVisit > 0) {
      if (emptyEl) emptyEl.style.display = '';
      if (listEl) listEl.style.display = 'none';
    } else {
      if (emptyEl) emptyEl.style.display = 'none';
      if (listEl) listEl.style.display = '';
    }
    var btn = sec.querySelector('[data-wn-action=read]');
    if (btn) btn.addEventListener('click', function () {
      try { localStorage.setItem(KEY, String(nowMs)); } catch (e) {}
      sec.querySelectorAll('.wn-item').forEach(function (n) { n.classList.remove('is-new'); });
      if (counterEl) counterEl.textContent = 'tout marqué lu';
      if (emptyEl) emptyEl.style.display = '';
      if (listEl) listEl.style.display = 'none';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>`;

function escJsonHtml(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

export function blocWhatsNew(donnees) {
  const w = donnees?.whatsNew;
  if (!w) return '';
  const data = w.items.map((it) => ({ type: it.type, id: it.id, titre: it.titre, mtime: it.mtime }));
  return `${WN_CSS}<section id="whats-new-section" data-now-ms="${w.nowMs}">
    <h2>Nouveautés depuis votre dernière visite <span class="count wn-counter">… chargement…</span></h2>
    <p class="muted" style="font-size:.85rem">Compare les <strong>${w.items.length} artefact(s) récent(s)</strong> avec le timestamp persisté dans <code>localStorage.aiad-pm-last-visit</code>. Bouton "Marquer tout lu" met à jour le timestamp.</p>
    <div class="wn-actions">
      <button type="button" class="wn-btn" data-wn-action="read">✓ Marquer tout lu</button>
    </div>
    <ul class="wn-list"></ul>
    <div class="wn-empty" style="display:none">✓ Rien de neuf depuis votre dernière visite — vous êtes à jour.</div>
    <script type="application/json" id="aiad-whats-new-data">${escJsonHtml(data)}</script>
    <script>window.AIAD_WHATS_NEW = JSON.parse(document.getElementById('aiad-whats-new-data').textContent);</script>
  </section>${WN_SCRIPT}`;
}

// Alias EN canoniques (#42)
export {
  calculerWhatsNew as computeWhatsNew,
  blocWhatsNew as whatsNewSection,
};
