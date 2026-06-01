// AIAD SDD Mode — Dashboard : edge case tracking pour persona QA (#211).
//
// Audit DASHBOARD-AUDIT.md section 4 ligne 123 : "Pas d'edge case tracking
// — la SPEC liste les cas limites, le dashboard ne montre pas lesquels sont
// couverts."
//
// Parse la section conventionnelle `## Cas limites` / `## Edge cases` /
// `## Edge case` dans chaque SPEC, croise les mots-clés avec les fichiers
// tests liés via la matrice de traçabilité (#198 traceability) pour estimer
// la couverture. Approche heuristique : un edge case est "couvert" si au
// moins un test contient au moins un mot-clé significatif du cas.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Détecte les titres de section "cas limites" (FR + EN + variantes).
const PATTERN_SECTION = /^##\s+(Cas limites|Edge cases?|Cas particuliers|Corner cases?)\s*$/im;
const PATTERN_H2 = /^##\s+/;
const PATTERN_ITEM = /^\s*[-*]\s+(.+?)\s*$/;

// Mots-clés "stop words" non discriminants — exclus pour la recherche keyword.
const STOP_WORDS = new Set([
  // Articles, prép FR
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'au', 'aux', 'à', 'a',
  'et', 'ou', 'mais', 'si', 'pour', 'par', 'dans', 'sur', 'sous', 'avec',
  'sans', 'vers', 'puis', 'donc', 'que', 'qui', 'quoi', 'dont', 'où',
  'ce', 'cette', 'ces', 'son', 'sa', 'ses', 'mon', 'ma', 'mes', 'ton',
  // Articles, prép EN
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'for', 'in', 'on', 'at',
  'to', 'from', 'of', 'with', 'without', 'this', 'that', 'these', 'those',
  // AIAD jargon courant
  'doit', 'doivent', 'devrait', 'should', 'must', 'when', 'alors', 'then',
]);

export function tokeniser(texte) {
  return String(texte || '')
    .toLowerCase()
    // Conserve les mots alphanumériques (et lettres accentuées)
    .split(/[^a-z0-9À-ſ]+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
}

export function extraireEdgeCases(contenuSpec) {
  if (!contenuSpec) return [];
  const lignes = contenuSpec.split('\n');
  let debut = -1;
  for (let i = 0; i < lignes.length; i++) {
    if (PATTERN_SECTION.test(lignes[i])) { debut = i + 1; break; }
  }
  if (debut < 0) return [];
  const cas = [];
  for (let i = debut; i < lignes.length; i++) {
    if (PATTERN_H2.test(lignes[i])) break;
    const m = lignes[i].match(PATTERN_ITEM);
    if (!m) continue;
    const texte = m[1].trim();
    if (!texte) continue;
    cas.push({
      texte: texte.slice(0, 200),
      ligne: i + 1,
      keywords: tokeniser(texte),
    });
  }
  return cas;
}

// (#212) Pattern annotation explicite. Forme acceptée :
//   // @covers-edge-case SPEC-001-1: URL > 2048 char
//   // @covers-edge-case SPEC-007-2-routing: 0 fuite cross-tenant
// La partie après `:` est un préfixe (substring) du texte du cas limite.
const PATTERN_COVERS = /@covers-edge-case\s+(SPEC-[A-Za-z0-9-]+)\s*:\s*(.+?)$/gm;

// Scanne les contenus tests pour extraire toutes les annotations explicites.
// Retourne Map<SPEC-id-normalisé, Set<préfixe-texte-normalisé>>.
export function scannerAnnotationsCouverture(contenusTests) {
  const out = new Map();
  for (const contenu of contenusTests) {
    if (!contenu || !contenu.includes('@covers-edge-case')) continue;
    PATTERN_COVERS.lastIndex = 0;
    let m;
    while ((m = PATTERN_COVERS.exec(contenu)) !== null) {
      const specId = normaliserSpecId(m[1]);
      const prefixe = String(m[2]).trim().toLowerCase();
      if (!out.has(specId)) out.set(specId, new Set());
      out.get(specId).add(prefixe);
    }
  }
  return out;
}

function normaliserSpecId(id) {
  // Accepte `SPEC-001-1` ou `SPEC-001-1-slug` → renvoie la forme courte.
  const m = String(id || '').match(/^(SPEC-\d+(?:-\d+)?)/i);
  return m ? m[1].toUpperCase() : String(id).toUpperCase();
}

// Cherche les mots-clés d'un edge case dans les contenus tests. Si une
// annotation explicite `@covers-edge-case` matche, override le matching
// keyword et marque couvert.
function evaluerCouverture(edgeCase, contenusTests, options = {}) {
  // (#212) Override explicite via annotation.
  if (options.coversAnnotations) {
    const texteLower = String(edgeCase.texte).toLowerCase();
    for (const prefixe of options.coversAnnotations) {
      if (!prefixe) continue;
      if (texteLower.startsWith(prefixe) || texteLower.includes(prefixe)) {
        return { couvert: true, matchedKeywords: [`@covers:${prefixe.slice(0, 32)}`], explicite: true };
      }
    }
  }
  if (!edgeCase.keywords.length) return { couvert: false, matchedKeywords: [], explicite: false };
  const matched = new Set();
  for (const contenu of contenusTests) {
    const c = String(contenu).toLowerCase();
    for (const kw of edgeCase.keywords) {
      if (c.includes(kw)) matched.add(kw);
    }
  }
  const long = [...matched].some((kw) => kw.length >= 6);
  const couvert = matched.size >= 2 || long;
  return { couvert, matchedKeywords: [...matched], explicite: false };
}

export function calculerEdgeCases(racineProjet, donnees, options = {}) {
  const specs = donnees?.specs || [];
  const matrice = donnees?.matrice?.forward || [];

  // Index spec.id → tests[] depuis matrice forward
  const testsParSpec = new Map();
  for (const e of matrice) {
    for (const { spec, tests } of e.specs) {
      if (spec) testsParSpec.set(spec.id, tests || []);
    }
  }

  // Cache contenus tests pour éviter relectures
  const cacheTests = options.cacheTests || new Map();
  function lireTestContenu(path) {
    if (cacheTests.has(path)) return cacheTests.get(path);
    let c = '';
    try { c = readFileSync(join(racineProjet, path), 'utf-8'); } catch { /* skip */ }
    cacheTests.set(path, c);
    return c;
  }

  const byspec = [];
  let totalItems = 0;
  let totalCovered = 0;
  for (const s of specs) {
    if (!s.file) continue;
    const cheminSpec = join(racineProjet, s.file);
    if (!existsSync(cheminSpec)) continue;
    let contenu;
    try { contenu = readFileSync(cheminSpec, 'utf-8'); } catch { continue; }
    const cas = extraireEdgeCases(contenu);
    if (cas.length === 0) continue;
    const tests = testsParSpec.get(s.id) || [];
    const contenusTests = tests.map((t) => lireTestContenu(t.path));
    // (#212) Scan annotations explicites par SPEC.
    const annotationsParSpec = scannerAnnotationsCouverture(contenusTests);
    const specKey = normaliserSpecId(s.id);
    const coversAnnotations = annotationsParSpec.get(specKey) || new Set();
    const items = cas.map((c) => {
      const ev = evaluerCouverture(c, contenusTests, { coversAnnotations });
      totalItems += 1;
      if (ev.couvert) totalCovered += 1;
      return {
        texte: c.texte,
        ligne: c.ligne,
        couvert: ev.couvert,
        explicite: ev.explicite,
        matchedKeywords: ev.matchedKeywords,
      };
    });
    byspec.push({
      id: s.id,
      file: s.file,
      statut: s.statut,
      testsCount: tests.length,
      items,
      totalItems: items.length,
      covered: items.filter((i) => i.couvert).length,
    });
  }
  // Tri : SPECs avec le plus de gaps en tête (incentive QA)
  byspec.sort((a, b) => (b.totalItems - b.covered) - (a.totalItems - a.covered));
  return {
    totalItems,
    totalCovered,
    totalSpecs: byspec.length,
    ratio: totalItems > 0 ? totalCovered / totalItems : null,
    byspec: byspec.slice(0, 50),
  };
}

// ─── Rendu HTML ─────────────────────────────────────────────────────────────

import { escape, lienSource, lienSourceLigne } from './render.js';

export function blocEdgeCases(donnees) {
  const ec = donnees?.edgeCases;
  if (!ec || ec.totalSpecs === 0) return '';
  const pct = ec.ratio != null ? Math.round(ec.ratio * 100) : null;
  const ratioBadge = pct == null
    ? '<span class="badge">—</span>'
    : pct === 100
    ? `<span class="badge badge-ok">${pct}%</span>`
    : pct >= 50
    ? `<span class="badge badge-warn">${pct}%</span>`
    : `<span class="badge badge-bad">${pct}%</span>`;

  // (#314) Hyperlinks vers la ligne SPEC pour chaque edge case + lien SPEC dans
  // le summary. Tech Lead clique "à tester" → atterrit pile sur la ligne `## Edge cases`
  // de la SPEC. Pas de lien si s.file absent (garde-fou).
  const cards = ec.byspec.slice(0, 20).map((s) => {
    const items = s.items.slice(0, 20).map((it) => {
      const badge = it.couvert
        ? (it.explicite
          ? '<span class="badge badge-ok" style="font-size:.7rem">couvert (explicite)</span>'
          : '<span class="badge badge-ok" style="font-size:.7rem">couvert</span>')
        : '<span class="badge badge-warn" style="font-size:.7rem">à tester</span>';
      const via = it.matchedKeywords.length > 0
        ? `<span class="muted" style="font-size:.7rem">via : ${it.matchedKeywords.slice(0, 3).map((k) => `<code>${escape(k)}</code>`).join(', ')}</span>`
        : '';
      const lienLigne = s.file && it.ligne != null
        ? ` ${lienSourceLigne(s.file, it.ligne)}`
        : '';
      return `<li style="margin-bottom:.25rem">${badge} <span>${escape(it.texte)}</span>${lienLigne} ${via}</li>`;
    }).join('');
    const cardCoverage = s.totalItems > 0 ? Math.round((s.covered / s.totalItems) * 100) : 0;
    const idCell = s.file ? lienSource(s.file, s.id) : `<code>${escape(s.id)}</code>`;
    return `<details ${s.covered < s.totalItems ? 'open' : ''}>
      <summary>
        <strong>${idCell}</strong>
        — ${s.covered}/${s.totalItems} cas couverts
        <span class="muted" style="font-size:.75rem">(${cardCoverage}% · ${s.testsCount} test(s) liés)</span>
      </summary>
      <ul style="margin:.5rem 0;padding-left:1.2rem">${items}</ul>
    </details>`;
  }).join('');

  return `<section>
    <h2>Edge cases <span class="count">${ec.totalCovered}/${ec.totalItems}</span></h2>
    <div class="kpis">
      <div class="kpi"><div class="label">Cas limites total</div><div class="value">${ec.totalItems}</div><div class="delta">sur ${ec.totalSpecs} SPEC(s) avec section</div></div>
      <div class="kpi"><div class="label">Couverts</div><div class="value">${ec.totalCovered}</div><div class="delta">${ratioBadge} matching keyword</div></div>
      <div class="kpi"><div class="label">À tester</div><div class="value">${ec.totalItems - ec.totalCovered}</div><div class="delta">priorité QA</div></div>
    </div>
    <p class="muted" style="font-size:.85rem">Heuristique : un cas limite est <strong>couvert</strong> si ≥ 2 mots-clés (ou 1 long, ≥ 6 chars) du texte apparaissent dans un test lié à la SPEC via la matrice de traçabilité. Override possible via annotation explicite <code>// @covers-edge-case SPEC-NNN-N: préfixe du texte</code>. Tri par gaps décroissants.</p>
    ${cards}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  extraireEdgeCases as extractEdgeCases,
  calculerEdgeCases as computeEdgeCases,
  blocEdgeCases as edgeCasesSection,
  tokeniser as tokenize,
  scannerAnnotationsCouverture as scanCoverAnnotations,
};
