// @spec SPEC-016-1-architecture-4-couches
// @intent INTENT-016
// @governance AIAD-RGAA

import { escape, lienSource, lienSourceLigne } from '../ui/helpers.js';
import { badge } from '../ui/badges.js';

export function pageTraceability(donnees) {
  // (#326) Cellules ID Intent/SPEC + paths code/tests deviennent hyperliées.
  // Intent/SPEC pointent vers le fichier .md (sans anchor — la SPEC entière
  // est le contexte). Code/tests pointent vers la ligne `@spec` (anchor #LN).
  const m = donnees.matrice;
  const cellIdLink = (id, file) => file ? lienSource(file, id) : `<code>${escape(id)}</code>`;
  const cellPath = (p) => lienSourceLigne(p.path, p.line, p.path);
  const rowsForward = m.forward.flatMap((row) => {
    if (row.specs.length === 0) {
      return [`<tr><td>${cellIdLink(row.intent.id, row.intent.file)}</td><td><em class="muted">(aucune SPEC)</em></td><td>—</td><td>—</td><td>${badge('orphelin', 'badge-bad')}</td></tr>`];
    }
    return row.specs.map((s, idx) => {
      const code = s.code.length ? s.code.map(cellPath).join('<br/>') : '<em class="muted">aucun</em>';
      const tests = s.tests.length ? s.tests.map(cellPath).join('<br/>') : '<em class="muted">aucun</em>';
      let verdict = badge('ok', 'badge-ok');
      if (s.code.length === 0) verdict = badge('non-implémentée', 'badge-warn');
      else if (s.tests.length === 0) verdict = badge('non-testée', 'badge-warn');
      // rowspan : on ne ré-affiche l'intent que sur la première SPEC du groupe
      const cellIntent = idx === 0
        ? `<td rowspan="${row.specs.length}" class="rowspan">${cellIdLink(row.intent.id, row.intent.file)}</td>`
        : '';
      return `<tr>
        ${cellIntent}
        <td>${cellIdLink(s.spec.id, s.spec.file)}<br/><small class="muted">${escape(s.spec.title)}</small></td>
        <td>${code}</td>
        <td>${tests}</td>
        <td>${verdict}</td>
      </tr>`;
    });
  }).join('');

  const rowsBackward = m.backward.map((row) => {
    const code = row.code.length ? row.code.map(cellPath).join('<br/>') : '<em class="muted">aucun</em>';
    return `<tr>
      <td>${cellPath(row.test)}</td>
      <td>${row.spec ? cellIdLink(row.spec.id, row.spec.file) : badge('non-tracé', 'badge-bad')}</td>
      <td>${row.intent ? cellIdLink(row.intent.id, row.intent.file) : '<em class="muted">—</em>'}</td>
      <td>${code}</td>
    </tr>`;
  }).join('');

  const gapsTotal = m.gaps.intentsSansSpec.length + m.gaps.specsSansCode.length
    + m.gaps.specsValideesNonImplementees.length + m.gaps.specsOrphelinsSurCode.length
    + m.gaps.intentsOrphelinsSurCode.length + m.gaps.codeSansSpec.length
    + m.gaps.codeSansTests.length;

  return `
<div class="kpis">
  <div class="kpi"><div class="label">Intents</div><div class="value">${m.summary.intents}</div></div>
  <div class="kpi"><div class="label">SPECs</div><div class="value">${m.summary.specs}</div></div>
  <div class="kpi"><div class="label">Code annoté</div><div class="value small">${m.summary.annotatedCodeFiles} / ${m.summary.codeFiles}</div></div>
  <div class="kpi"><div class="label">Tests annotés</div><div class="value small">${m.summary.annotatedTestFiles} / ${m.summary.testFiles}</div></div>
  <div class="kpi ${gapsTotal === 0 ? 'ok' : 'warn'}"><div class="label">Gaps détectés</div><div class="value">${gapsTotal}</div></div>
</div>

<section class="matrix-tab">
  <h2>Matrice Forward · Intent → SPEC → Code → Tests</h2>
  ${m.forward.length === 0
    ? `<div class="empty"><strong>Aucun intent à tracer.</strong>Lance <code>/sdd intent</code> puis annote ton code avec <code>@spec SPEC-NNN-...</code>.</div>`
    : `<div class="filter"><input type="search" id="qFwd" data-filter-target="tFwd" placeholder="Filtrer la matrice forward…"/></div>
       <table id="tFwd">
         <thead><tr><th>Intent</th><th>SPEC</th><th>Code</th><th>Tests</th><th>Verdict</th></tr></thead>
         <tbody>${rowsForward}</tbody>
       </table>`}
</section>

<section class="matrix-tab">
  <h2>Matrice Backward · Tests → Code → SPEC → Intent</h2>
  ${m.backward.length === 0
    ? `<div class="empty"><strong>Aucun test annoté.</strong>Ajoute <code>@spec SPEC-...</code> dans tes fichiers de test pour bâtir la matrice backward.</div>`
    : `<div class="filter"><input type="search" id="qBwd" data-filter-target="tBwd" placeholder="Filtrer la matrice backward…"/></div>
       <table id="tBwd">
         <thead><tr><th>Test</th><th>SPEC</th><th>Intent</th><th>Code couvert</th></tr></thead>
         <tbody>${rowsBackward}</tbody>
       </table>`}
</section>

<section>
  <h2>Gaps détectés</h2>
  <div class="split">
    <div class="card">
      <h3>Orphelins</h3>
      <ul class="compact">
        <li><strong>${m.gaps.intentsSansSpec.length}</strong> intent(s) sans SPEC</li>
        <li><strong>${m.gaps.specsSansCode.length}</strong> SPEC(s) sans code (hors draft/review)</li>
        <li><strong>${m.gaps.specsOrphelinsSurCode.length}</strong> SPEC(s) référencé(s) dans le code mais absent(s) des artefacts</li>
        <li><strong>${m.gaps.intentsOrphelinsSurCode.length}</strong> Intent(s) référencé(s) dans le code mais absent(s) des artefacts</li>
      </ul>
    </div>
    <div class="card">
      <h3>Non-implémentés / non-tracés</h3>
      <ul class="compact">
        <li><strong>${m.gaps.specsValideesNonImplementees.length}</strong> SPEC(s) validée(s) sans code</li>
        <li><strong>${m.gaps.codeSansSpec.length}</strong> fichier(s) code sans <code>@spec</code></li>
        <li><strong>${m.gaps.codeSansTests.length}</strong> fichier(s) annoté(s) sans test lié</li>
      </ul>
    </div>
  </div>
</section>
`;
}
