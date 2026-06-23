/**
 * @intent INTENT-017
 * @spec SPEC-017-2-inbox-triage
 * @verified-by test/dashboard-inbox.test.js
 * @governance AIAD-RGAA,AIAD-RGPD
 */

import { escape } from '../ui/helpers.js';

/**
 * Agrège facts + drifts en liste unifiée pour le triage.
 * @param {object} donnees
 * @returns {{ items: Array<{id: string, type: string, titre: string, statut: 'new'}> }}
 */
export function calculerInboxTriage(donnees) {
  const factItems = (donnees.facts || [])
    .filter((f) => {
      if (!f.id) {
        if (typeof process !== 'undefined') process.stderr?.write?.(`[inbox] fact sans id ignoré\n`);
        return false;
      }
      return true;
    })
    .map((f) => ({ id: f.id, type: 'fact', titre: f.titre || f.id, statut: 'new' }));

  const driftItems = (donnees.drifts || [])
    .filter((d) => d.id)
    .map((d) => ({ id: d.id, type: 'drift', titre: d.titre || d.id, statut: 'new' }));

  return { items: [...factItems, ...driftItems] };
}

// Script inline chargé une seule fois pour gérer localStorage + filtres onglets.
const CLIENT_SCRIPT = `
(function () {
  var KEY_PREFIX = 'aiad-inbox-';
  var rows = document.querySelectorAll('[data-inbox-id]');
  var warnEl = document.getElementById('inbox-ls-warn');

  function lsGet(id) {
    try { return localStorage.getItem(KEY_PREFIX + id); } catch (_) { return null; }
  }

  function lsSet(id, val) {
    try {
      localStorage.setItem(KEY_PREFIX + id, val);
      return true;
    } catch (_) {
      if (warnEl) warnEl.hidden = false;
      return false;
    }
  }

  function labelFor(val) {
    if (val === 'accepted') return 'Accepté';
    if (val === 'deferred') return 'Différé';
    return 'Nouveau';
  }

  function applyRow(row, val) {
    var lbl = row.querySelector('.inbox-statut');
    if (lbl) lbl.textContent = labelFor(val);
    row.dataset.inboxStatut = val || 'new';
  }

  // CA-007a/b — restaurer état au chargement
  rows.forEach(function (row) {
    var id = row.dataset.inboxId;
    var stored = lsGet(id);
    if (stored) applyRow(row, stored);
  });

  // CA-002a/b, CA-003a/b — boutons Accept / Différer
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-inbox-action]');
    if (!btn) return;
    var row = btn.closest('[data-inbox-id]');
    if (!row) return;
    var id = row.dataset.inboxId;
    var action = btn.dataset.inboxAction;
    var val = action === 'accept' ? 'accepted' : 'deferred';
    lsSet(id, val);
    applyRow(row, val);
  });

  // CA-005 — filtres onglets
  document.addEventListener('click', function (e) {
    var tab = e.target.closest('[data-inbox-filter]');
    if (!tab) return;
    var filter = tab.dataset.inboxFilter;
    document.querySelectorAll('[data-inbox-filter]').forEach(function (t) {
      t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
    });
    rows.forEach(function (row) {
      var st = row.dataset.inboxStatut || 'new';
      row.hidden = filter !== 'all' && st !== filter;
    });
  });
})();
`;

/**
 * Génère la section HTML inbox (table + boutons + filtres onglets).
 * @param {object} donnees
 * @returns {string} HTML
 */
export function blocInboxTriage(donnees) {
  const { items } = calculerInboxTriage(donnees);
  const nouveaux = items.length;

  if (items.length === 0) {
    return `<section aria-label="Inbox de triage">
  <h2>Inbox <span class="badge badge-muted">0 nouveaux</span></h2>
  <p>Aucun élément en attente de triage.</p>
</section>`;
  }

  const rows = items.map((item) => `<tr data-inbox-id="${escape(item.id)}" data-inbox-statut="new">
    <td><code>${escape(item.id)}</code></td>
    <td>${escape(item.type === 'fact' ? 'Fact' : 'Drift')}</td>
    <td>${escape(item.titre)}</td>
    <td class="inbox-statut">Nouveau</td>
    <td>
      <button type="button" data-inbox-action="accept" aria-label="Accepter ${escape(item.id)}">Accepter</button>
      <button type="button" data-inbox-action="defer" aria-label="Différer ${escape(item.id)}">Différer</button>
    </td>
  </tr>`).join('');

  return `<section aria-label="Inbox de triage">
  <h2>Inbox <span class="badge badge-warn">${nouveaux} nouveaux</span></h2>
  <p aria-live="polite" id="inbox-ls-warn" hidden>Actions de triage indisponibles (navigation privée ou quota dépassé).</p>
  <div role="tablist" aria-label="Filtrer l'inbox">
    <button role="tab" aria-selected="true" data-inbox-filter="all">Tout</button>
    <button role="tab" aria-selected="false" data-inbox-filter="new">Nouveau</button>
    <button role="tab" aria-selected="false" data-inbox-filter="accepted">Accepté</button>
    <button role="tab" aria-selected="false" data-inbox-filter="deferred">Différé</button>
  </div>
  <table>
    <caption>Éléments en attente de triage (facts et drifts)</caption>
    <thead><tr>
      <th scope="col">ID</th>
      <th scope="col">Type</th>
      <th scope="col">Titre</th>
      <th scope="col">Statut</th>
      <th scope="col">Actions</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <details>
    <summary>Note sur la persistance</summary>
    <p>Les décisions de triage (Accepter / Différer) sont stockées dans le <code>localStorage</code> du navigateur.
    Elles sont propres à ce navigateur et ne sont pas partagées entre appareils ou sessions privées.</p>
  </details>
  <script>${CLIENT_SCRIPT}</script>
</section>`;
}

/**
 * Page complète inbox.html.
 * @param {object} donnees
 * @param {{ layout: Function }} opts
 * @returns {string} HTML
 */
export function pageInbox(donnees, { layout }) {
  return layout({
    slug: 'inbox',
    titre: 'Inbox',
    sous: 'Triage facts & drifts',
    donnees,
    body: blocInboxTriage(donnees),
  });
}
