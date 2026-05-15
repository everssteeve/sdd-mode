// AIAD SDD Mode — Dashboard : page Legal/Compliance (#139).
//
// Persona Legal/Compliance débloquée. Rollup de 4 signaux :
//   (a) AI Act audit  → statut Annexe IV (depuis supplementaire.aiAct)
//   (b) DPIA          → générations + sections à compléter par DPO
//   (c) Sovereignty   → score composite Bronze→Platinum
//   (d) Packs juridictionnels → présents dans `.aiad/gouvernance-packs/`
//
// Dépendance : `data.json#supplementaire` (livré par #134). La liste des
// packs est lue à partir du système de fichiers car elle n'est pas remontée
// par les collecteurs principaux.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// (#164) Lit `.aiad/marketplace-catalogue.json` et retourne le set des ids
// `installed: true` (ou alias `selected`/`subscribed`). Retourne `null` si
// aucun pack n'a ce flag — pas de filtrage à appliquer (rétrocompat).
function lireMarketplaceFilter(racineProjet) {
  const chemin = join(racineProjet, '.aiad', 'marketplace-catalogue.json');
  if (!existsSync(chemin)) return null;
  let raw;
  try { raw = readFileSync(chemin, 'utf-8'); } catch { return null; }
  let json;
  try { json = JSON.parse(raw); } catch { return null; }
  const packs = Array.isArray(json.packs) ? json.packs : [];
  const set = new Set();
  for (const p of packs) {
    if (p.installed === true || p.selected === true || p.subscribed === true) {
      if (p.id) set.add(p.id);
    }
  }
  return set.size > 0 ? set : null;
}

// ─── Packs juridictionnels installés ────────────────────────────────────────
//
// Un pack est un dossier `.aiad/gouvernance-packs/<id>/` contenant au moins
// un fichier `AIAD-*.md`. On expose son `id` (nom de dossier) et la liste
// des agents qu'il fournit.

export function listerPacksInstalles(racineProjet) {
  const dir = join(racineProjet, '.aiad', 'gouvernance-packs');
  if (!existsSync(dir)) return [];
  let dossiers;
  try { dossiers = readdirSync(dir); } catch { return []; }
  // (#164) Filtre optionnel via marketplace-catalogue.json
  const filter = lireMarketplaceFilter(racineProjet);
  const packs = [];
  for (const id of dossiers) {
    if (filter && !filter.has(id)) continue; // filtré par marketplace
    const packDir = join(dir, id);
    let st;
    try { st = statSync(packDir); } catch { continue; }
    if (!st.isDirectory()) continue;
    let agents = [];
    try {
      agents = readdirSync(packDir)
        .filter((n) => /^AIAD-.+\.md$/.test(n))
        .map((n) => n.replace(/\.md$/, ''));
    } catch { agents = []; }
    if (agents.length === 0) continue; // pack vide → on ignore
    packs.push({ id, agents, file: relative(racineProjet, packDir) });
  }
  packs.sort((a, b) => a.id.localeCompare(b.id));
  return packs;
}

// ─── Rendu HTML ─────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

function statutAiAct(aiAct) {
  if (!aiAct || !aiAct.total) {
    return {
      label: 'Aucun audit AI Act',
      cls: 'warn',
      action: 'Lance <code>npx aiad-sdd ai-act</code> pour générer le squelette Annexe IV.',
    };
  }
  const last = aiAct.latest;
  if (last.complete) {
    return { label: `Audit complet (${last.sectionsCount}/8)`, cls: 'ok', action: null };
  }
  return {
    label: `Annexe IV ${last.sectionsCount}/8 sections · ${last.aCompleter} placeholder(s) "à compléter"`,
    cls: 'warn',
    action: 'Ouvre le rapport et complète les sections marquées.',
  };
}

function statutDpia(dpia) {
  if (!dpia || !dpia.total) {
    return {
      label: 'Aucun DPIA généré',
      cls: 'warn',
      action: 'Lance <code>npx aiad-sdd doctor</code> et <code>/sdd security --dpia</code> pour le DPO.',
    };
  }
  const last = dpia.latest;
  if (last.complete) {
    return { label: `DPIA complet (${last.sectionsCount} sections)`, cls: 'ok', action: null };
  }
  return {
    label: `${last.sectionsCount} section(s) · ${last.aCompleter} à compléter par le DPO`,
    cls: 'warn',
    action: 'Sollicite le DPO pour clôturer les sections manquantes.',
  };
}

function statutSovereignty(sov) {
  if (!sov || !sov.available) {
    return { label: 'Score indisponible', cls: 'warn', action: null };
  }
  const cls = sov.level === 'Platinum' ? 'ok' : sov.level === 'Gold' ? 'ok' : sov.level === 'Silver' ? 'warn' : 'bad';
  return { label: `${sov.score}/${sov.maxScore} · ${sov.level}`, cls, action: null };
}

export function pageLegal(donnees) {
  const supp = donnees?.supplementaire || {};
  const packs = donnees?.legalPacks || [];

  const aiActSt = statutAiAct(supp.aiAct);
  const dpiaSt = statutDpia(supp.dpia);
  const sovSt = statutSovereignty(supp.sovereignty);

  const kpis = `
    <div class="kpi ${aiActSt.cls === 'ok' ? 'ok' : 'warn'}">
      <div class="label">AI Act (Annexe IV)</div>
      <div class="value">${escape(aiActSt.label.split(' ')[0])}</div>
      <div class="delta">${escape(aiActSt.label)}</div>
    </div>
    <div class="kpi ${dpiaSt.cls === 'ok' ? 'ok' : 'warn'}">
      <div class="label">DPIA</div>
      <div class="value">${supp.dpia?.total || 0}</div>
      <div class="delta">${escape(dpiaSt.label)}</div>
    </div>
    <div class="kpi ${sovSt.cls}">
      <div class="label">Souveraineté</div>
      <div class="value">${supp.sovereignty?.score ?? '—'}</div>
      <div class="delta">${escape(sovSt.label)}</div>
    </div>
    <div class="kpi">
      <div class="label">Packs juridictionnels</div>
      <div class="value">${packs.length}</div>
      <div class="delta">installés dans <code>.aiad/gouvernance-packs/</code></div>
    </div>
  `;

  // AI Act section avec liste des sections de l'audit le plus récent
  const aiActSection = supp.aiAct?.latest ? `
    <section>
      <h2>AI Act — Annexe IV <span class="count">${supp.aiAct.latest.sectionsCount}/8 sections</span></h2>
      <p class="muted">${escape(aiActSt.label)}${aiActSt.action ? '  ' + aiActSt.action : ''}</p>
      <ul>${supp.aiAct.latest.sections.map((s) => `<li>${escape(s)}</li>`).join('')}</ul>
      <p class="muted">Source : ${lienSource(supp.aiAct.latest.file)}</p>
    </section>` : `
    <section>
      <h2>AI Act — Annexe IV</h2>
      <div class="empty"><strong>${escape(aiActSt.label)}</strong>${aiActSt.action ? '<br/>' + aiActSt.action : ''}</div>
    </section>`;

  // DPIA section — table récap + liste des sections du document le plus
  // récent (#166, cohérence avec AI Act)
  const dpiaSection = supp.dpia?.latest ? `
    <section>
      <h2>DPIA <span class="count">${supp.dpia.total} document(s)</span></h2>
      <p class="muted">${escape(dpiaSt.label)}${dpiaSt.action ? '  ' + dpiaSt.action : ''}</p>
      <table>
        <thead><tr><th>Document</th><th>Date</th><th>Sections</th><th>À compléter</th></tr></thead>
        <tbody>${supp.dpia.fichiers.map((d) => `
          <tr>
            <td>${lienSource(d.file)}</td>
            <td class="muted">${escape(d.date || '—')}</td>
            <td>${d.sectionsCount}</td>
            <td class="${d.aCompleter > 0 ? 'badge warn' : 'badge ok'}">${d.aCompleter}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      ${supp.dpia.latest.sections && supp.dpia.latest.sections.length ? `
        <details style="margin-top:.75rem">
          <summary>Sections du DPIA le plus récent <span class="muted">(${supp.dpia.latest.sectionsCount})</span></summary>
          <ul>${supp.dpia.latest.sections.map((s) => `<li>${escape(s)}</li>`).join('')}</ul>
        </details>` : ''}
    </section>` : `
    <section>
      <h2>DPIA</h2>
      <div class="empty"><strong>${escape(dpiaSt.label)}</strong>${dpiaSt.action ? '<br/>' + dpiaSt.action : ''}</div>
    </section>`;

  // Sovereignty section
  const sovSection = supp.sovereignty?.available ? `
    <section>
      <h2>Score de souveraineté <span class="count">${supp.sovereignty.score}/${supp.sovereignty.maxScore} · ${escape(supp.sovereignty.level)}</span></h2>
      <table>
        <thead><tr><th>Dimension</th><th>Score</th></tr></thead>
        <tbody>${Object.entries(supp.sovereignty.dimensions || {}).map(([nom, d]) => `
          <tr><td>${escape(nom)}</td><td>${d.score ?? '—'}</td></tr>`).join('')}
        </tbody>
      </table>
    </section>` : '';

  // (#352) Lookup agent → file pour hyperlier les Tier 1 mentionnés dans
  // chaque pack (vers `.aiad/gouvernance/AIAD-RGPD.md` etc.). Garde-fou :
  // si l'agent n'est pas installé localement (file null), garder <code>.
  const agentsById = new Map((donnees?.gouvernance || []).map((g) => [g.id, g]));
  const agentLien = (id) => {
    const g = agentsById.get(id);
    return g?.file ? lienSource(g.file, id) : `<code>${escape(id)}</code>`;
  };
  // Packs section
  const packsSection = packs.length === 0 ? `
    <section>
      <h2>Packs juridictionnels</h2>
      <div class="empty">Aucun pack installé dans <code>.aiad/gouvernance-packs/</code>. Liste disponible : <code>npx aiad-sdd gouvernance --list</code>.</div>
    </section>` : `
    <section>
      <h2>Packs juridictionnels <span class="count">${packs.length} installé(s)</span></h2>
      <table data-sortable="true">
        <thead><tr><th>Pack</th><th>Agents Tier 1</th><th>Source</th></tr></thead>
        <tbody>${packs.map((p) => `
          <tr>
            <td><code>${escape(p.id)}</code></td>
            <td>${p.agents.map((a) => agentLien(a)).join(' · ')}</td>
            <td>${lienSource(p.file)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </section>`;

  return `
<div class="kpis">${kpis}</div>
${aiActSection}
${dpiaSection}
${sovSection}
${packsSection}
`;
}

// Alias EN canoniques (#42)
export {
  listerPacksInstalles as listInstalledPacks,
  pageLegal as legalPage,
};
