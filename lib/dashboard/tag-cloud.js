// AIAD SDD Mode — Dashboard : tag cloud transversal (#452).
//
// Permet au PM de slicer le catalogue Intents par dimension transversale
// libre (`tags: [auth, mobile, paiement, urgent, q3]`). Complète les
// dimensions structurées (priority/persona/sponsor) avec une dimension
// flexible que l'équipe peut faire évoluer organiquement.
//
// Rendu : nuage de tags cliquables qui filtrent visuellement (highlight)
// les Intents porteurs du tag. Pas de filtre persistant — c'est un
// outil de découverte / scan, pas un système de navigation.
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

function lireTagsIntent(intent) {
  if (!intent) return [];
  const candidats = [
    intent.tags, intent.Tags, intent.labels, intent.Labels, intent.etiquettes,
  ];
  const out = new Set();
  for (const c of candidats) {
    if (c == null) continue;
    if (Array.isArray(c)) {
      for (const v of c) if (v) out.add(normaliserTag(v));
    } else if (typeof c === 'string' && c.trim() !== '') {
      for (const v of c.split(/[,;]/)) {
        const t = normaliserTag(v);
        if (t) out.add(t);
      }
    }
  }
  return [...out];
}

function normaliserTag(s) {
  return String(s || '').trim()
    .toLowerCase()
    .replace(/^[#@]/, '')
    .replace(/\s+/g, '-');
}

export { lireTagsIntent };

export function calculerTagCloud(donnees) {
  const intents = donnees?.intents || [];
  const counts = new Map(); // tag → count
  const parTag = new Map(); // tag → [intent.id]
  for (const i of intents) {
    const tags = lireTagsIntent(i);
    for (const t of tags) {
      counts.set(t, (counts.get(t) || 0) + 1);
      if (!parTag.has(t)) parTag.set(t, []);
      parTag.get(t).push({ id: i.id, titre: i.titre || '', file: i.file || null, statut: i.statut });
    }
  }
  // Tri par fréquence desc puis alphabétique.
  const tags = [...counts.entries()].map(([tag, count]) => ({
    tag,
    count,
    intents: parTag.get(tag) || [],
  })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  const intentsAvecTag = intents.filter((i) => lireTagsIntent(i).length > 0).length;
  return {
    tags,
    totaux: {
      tagsUniques: tags.length,
      intentsAvecTag,
      intentsTotal: intents.length,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const TAG_CSS = `<style>
.tag-cloud { display:flex; flex-wrap:wrap; gap:.4rem; margin:.5rem 0; align-items:baseline; }
.tag-chip {
  display:inline-flex; align-items:baseline; gap:.25rem;
  padding:.2rem .5rem; background: rgba(76,110,245,.08); color:#3a4cba;
  border-radius:999px; cursor:pointer; border:1px solid transparent;
  font-size:.78rem; transition: background .15s, border-color .15s;
}
.tag-chip:hover { background: rgba(76,110,245,.18); border-color: rgba(76,110,245,.35); }
.tag-chip[aria-pressed="true"] { background:#4c6ef5; color:#fff; border-color:#4c6ef5; }
.tag-chip-count { font-size:.7rem; opacity:.7; }
.tag-chip-size-1 { font-size:.72rem; }
.tag-chip-size-2 { font-size:.85rem; font-weight:500; }
.tag-chip-size-3 { font-size:.95rem; font-weight:600; }
.tag-chip-size-4 { font-size:1.05rem; font-weight:700; }
.tag-detail { margin-top:.5rem; padding:.5rem .65rem; background:rgba(127,127,127,.05); border-radius:.3rem; min-height: 50px; }
.tag-detail-empty { color:var(--muted, #777); font-style:italic; font-size:.85rem; }
.tag-detail-items { display:flex; flex-wrap:wrap; gap:.35rem; margin-top:.3rem; }
.tag-detail-item { padding:.2rem .45rem; background:rgba(127,127,127,.08); border-radius:.2rem; font-size:.78rem; }
</style>`;

// Script : click sur un chip → toggle aria-pressed + remplit .tag-detail
// avec la liste des Intents porteurs.
const TAG_SCRIPT = `<script>
(function () {
  function init() {
    var cloud = document.querySelector('.tag-cloud[data-tag-cloud]');
    var detail = document.getElementById('tag-detail');
    if (!cloud || !detail) return;
    var data = {};
    try { data = JSON.parse(document.getElementById('tag-data').textContent); } catch (e) { return; }
    cloud.querySelectorAll('button.tag-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var t = btn.getAttribute('data-tag');
        var ouvert = btn.getAttribute('aria-pressed') === 'true';
        cloud.querySelectorAll('button.tag-chip').forEach(function (x) {
          x.setAttribute('aria-pressed', 'false');
        });
        if (ouvert) {
          detail.innerHTML = '<div class="tag-detail-empty">Cliquer un tag ci-dessus pour voir les Intents associés.</div>';
          return;
        }
        btn.setAttribute('aria-pressed', 'true');
        var items = data[t] || [];
        if (items.length === 0) {
          detail.innerHTML = '<div class="tag-detail-empty">Aucun Intent.</div>';
          return;
        }
        var inner = '<strong>' + items.length + ' Intent(s) tagué(s) #' + t + ' :</strong><div class="tag-detail-items">';
        items.forEach(function (it) {
          inner += '<span class="tag-detail-item">' + it.idHtml + ' — ' + escapeHtml(it.titre) + ' <span style="opacity:.6">(' + escapeHtml(it.statut || '?') + ')</span></span>';
        });
        inner += '</div>';
        detail.innerHTML = inner;
      });
    });
  }
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>`;

function tailleChip(count, max) {
  // 4 tailles selon ratio count / max. Plancher 1 (toujours visible).
  if (max <= 1) return 2;
  const ratio = count / max;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

export function blocTagCloud(donnees) {
  const c = donnees?.tagCloud;
  if (!c) return '';
  if (c.tags.length === 0) {
    return `<section>
      <h2>Tag cloud <span class="count">aucun tag déclaré</span></h2>
      <p class="muted" style="font-size:.85rem">Aucun Intent ne déclare <code>tags:</code> / <code>labels:</code> dans son frontmatter. Ajouter par exemple <code>tags: [mobile, paiement, q3]</code> pour activer le slicing transversal.</p>
    </section>`;
  }
  const max = c.tags[0].count;
  const chips = c.tags.map((t) => {
    const taille = tailleChip(t.count, max);
    return `<button type="button" class="tag-chip tag-chip-size-${taille}" data-tag="${escape(t.tag)}" aria-pressed="false" title="${t.count} Intent(s) tagué(s)">#${escape(t.tag)}<span class="tag-chip-count">${t.count}</span></button>`;
  }).join('');
  // Données JSON pour le script de drill-down.
  const data = {};
  for (const t of c.tags) {
    data[t.tag] = t.intents.map((i) => ({
      idHtml: i.file ? lienSource(i.file, i.id) : `<code>${escape(i.id)}</code>`,
      titre: i.titre || '',
      statut: i.statut,
    }));
  }
  return `${TAG_CSS}<section>
    <h2>Tag cloud <span class="count">${c.totaux.tagsUniques} tag(s) · ${c.totaux.intentsAvecTag}/${c.totaux.intentsTotal} Intents tagués</span></h2>
    <p class="muted" style="font-size:.85rem">Dimension transversale libre via <code>tags:</code> du frontmatter (alias <code>labels:</code> / <code>etiquettes:</code>). Click un tag → liste des Intents porteurs en dessous. Tags normalisés lowercase + tirets.</p>
    <div class="tag-cloud" data-tag-cloud role="toolbar" aria-label="Tags du catalogue Intents">${chips}</div>
    <div class="tag-detail" id="tag-detail"><div class="tag-detail-empty">Cliquer un tag ci-dessus pour voir les Intents associés.</div></div>
    <script type="application/json" id="tag-data">${JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')}</script>
  </section>${TAG_SCRIPT}`;
}

// Alias EN canoniques (#42)
export {
  lireTagsIntent as readIntentTags,
  calculerTagCloud as computeTagCloud,
  blocTagCloud as tagCloudSection,
};
