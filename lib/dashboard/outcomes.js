// AIAD SDD Mode — Dashboard : Outcome Criteria du PRD (#208).
//
// Audit DASHBOARD-AUDIT.md section 1 PM ("Outcome Criteria du PRD non
// trackés") et section 6e Executive Sponsors ("Outcome → Business value
// rollup"). Parse la section conventionnelle `## N. Outcome Criteria` du
// `.aiad/PRD.md` qui contient un tableau Markdown :
//
//   | Critère | Baseline | Cible | Méthode |
//   |---------|----------|-------|---------|
//   | Latence p95 | n/a | < 50 ms | wrk |
//
// Cible : PM/Executive qui veulent voir la promesse produit en un coup
// d'œil sur l'overview du dashboard, sans ouvrir PRD.md manuellement.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

// Détecte la section "Outcome Criteria" (numérotée ou pas) ou son alias
// anglais "Outcomes" / "Success Criteria".
const PATTERN_SECTION = /^##\s+(?:\d+\.\s+)?(?:Outcome Criteria|Outcomes|Success Criteria|Critères de succès|Critères d'outcome)(?:\s*\([^)]*\))?\s*$/im;

// Détecte la fin de la section (prochaine H2).
const PATTERN_H2 = /^##\s+(?:\d+\.\s+)?(.+?)\s*$/;

function parserTableau(lignes, debutIdx) {
  // Trouve la 1ère ligne `|` après debutIdx
  let i = debutIdx + 1;
  while (i < lignes.length && !lignes[i].trim().startsWith('|')) {
    if (PATTERN_H2.test(lignes[i])) return [];
    i += 1;
  }
  if (i >= lignes.length) return [];

  // Ligne 1 = entêtes, ligne 2 = séparateurs `|---|---|`, lignes suivantes = data
  const colonnesHeader = lignes[i].split('|').map((c) => c.trim()).filter(Boolean);
  // Skip ligne séparateur
  let j = i + 1;
  if (j < lignes.length && /^[\s|:-]+$/.test(lignes[j])) j += 1;

  const entrees = [];
  while (j < lignes.length) {
    const ligne = lignes[j];
    if (!ligne.trim().startsWith('|')) break; // fin du tableau
    if (PATTERN_H2.test(ligne)) break;
    const cells = ligne.split('|').map((c) => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
    if (cells.length === 0) { j += 1; continue; }
    // Mapping flexible : selon les colonnes détectées
    const entry = {};
    for (let k = 0; k < colonnesHeader.length && k < cells.length; k++) {
      const key = colonnesHeader[k].toLowerCase()
        .replace(/^critère.*$/, 'critere')
        .replace(/^baseline$/, 'baseline')
        .replace(/^cible$|^target$/, 'cible')
        .replace(/^méthode$|^method$|^measure$/, 'methode');
      entry[key] = cells[k];
    }
    if (entry.critere || cells[0]) {
      entrees.push({
        critere: entry.critere || cells[0],
        baseline: entry.baseline || cells[1] || '—',
        cible: entry.cible || cells[2] || '—',
        methode: entry.methode || cells[3] || '—',
      });
    }
    j += 1;
  }
  return entrees;
}

// ─── Mesures (#209) ─────────────────────────────────────────────────────────
//
// Source : `.aiad/metrics/outcomes/YYYY-MM-DD.md` (1 fichier par mesure
// périodique). Format attendu : tableau Markdown avec au moins une colonne
// `Critère` qui matche le PRD + une colonne `Actuel` (valeur courante).
// Le dernier fichier (par mtime) est consommé.

function parserTableauMesures(lignes, debutIdx) {
  let i = debutIdx;
  while (i < lignes.length && !lignes[i].trim().startsWith('|')) i += 1;
  if (i >= lignes.length) return [];
  const headers = lignes[i].split('|').map((c) => c.trim()).filter(Boolean);
  // Index des colonnes par nom normalisé
  const idxCritere = headers.findIndex((h) => /^crit(ère|erion|eria)/i.test(h));
  const idxActuel = headers.findIndex((h) => /^(actuel|current|measured|valeur)/i.test(h));
  if (idxCritere < 0 || idxActuel < 0) return [];
  let j = i + 1;
  if (j < lignes.length && /^[\s|:-]+$/.test(lignes[j])) j += 1;
  const out = [];
  while (j < lignes.length) {
    const ligne = lignes[j];
    if (!ligne.trim().startsWith('|')) break;
    const cells = ligne.split('|').map((c) => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
    if (cells.length === 0) { j += 1; continue; }
    const critere = cells[idxCritere];
    const actuel = cells[idxActuel];
    if (critere && actuel && !/^[-:\s]+$/.test(actuel)) {
      out.push({ critere, actuel });
    }
    j += 1;
  }
  return out;
}

export function lireMesures(racineProjet) {
  const dir = join(racineProjet, '.aiad', 'metrics', 'outcomes');
  if (!existsSync(dir)) return { fichier: null, date: null, mesures: [] };
  let entries;
  try { entries = readdirSync(dir); } catch { return { fichier: null, date: null, mesures: [] }; }
  // Sélectionne le fichier .md le plus récent par mtime.
  const md = entries
    .filter((n) => n.endsWith('.md'))
    .map((n) => {
      const p = join(dir, n);
      let st;
      try { st = statSync(p); } catch { return null; }
      return { nom: n, mtime: st.mtimeMs, file: p };
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime);
  if (md.length === 0) return { fichier: null, date: null, mesures: [] };
  const dernier = md[0];
  let contenu;
  try { contenu = readFileSync(dernier.file, 'utf-8'); }
  catch { return { fichier: null, date: null, mesures: [] }; }
  const lignes = contenu.split('\n');
  const mesures = parserTableauMesures(lignes, 0);
  const dateMatch = basename(dernier.nom, '.md').match(/^(\d{4}-\d{2}-\d{2})/);
  return {
    fichier: relative(racineProjet, dernier.file),
    date: dateMatch ? dateMatch[1] : null,
    mesures,
  };
}

// (#214) Table de conversion d'unités → unité de base. Comparaison
// uniquement quand 2 valeurs partagent la même *catégorie* (taille, durée,
// fréquence, pourcentage). Sinon fallback comparaison brute.
const UNITES_CONVERSION = {
  // Taille (base = byte)
  b:          { categorie: 'taille', facteur: 1 },
  byte:       { categorie: 'taille', facteur: 1 },
  bytes:      { categorie: 'taille', facteur: 1 },
  kb:         { categorie: 'taille', facteur: 1024 },
  kib:        { categorie: 'taille', facteur: 1024 },
  mb:         { categorie: 'taille', facteur: 1024 ** 2 },
  mib:        { categorie: 'taille', facteur: 1024 ** 2 },
  gb:         { categorie: 'taille', facteur: 1024 ** 3 },
  gib:        { categorie: 'taille', facteur: 1024 ** 3 },
  tb:         { categorie: 'taille', facteur: 1024 ** 4 },
  // Durée (base = ms)
  ns:         { categorie: 'duree', facteur: 1e-6 },
  us:         { categorie: 'duree', facteur: 1e-3 },
  ms:         { categorie: 'duree', facteur: 1 },
  s:          { categorie: 'duree', facteur: 1000 },
  sec:        { categorie: 'duree', facteur: 1000 },
  secs:       { categorie: 'duree', facteur: 1000 },
  seconds:    { categorie: 'duree', facteur: 1000 },
  m:          { categorie: 'duree', facteur: 60_000 }, // ambigu mais utile ; min plus sûr
  min:        { categorie: 'duree', facteur: 60_000 },
  mins:       { categorie: 'duree', facteur: 60_000 },
  h:          { categorie: 'duree', facteur: 3_600_000 },
  hr:         { categorie: 'duree', facteur: 3_600_000 },
  hour:       { categorie: 'duree', facteur: 3_600_000 },
  hours:      { categorie: 'duree', facteur: 3_600_000 },
  // Pourcentage
  '%':        { categorie: 'pct', facteur: 1 },
  pct:        { categorie: 'pct', facteur: 1 },
};

// Détecte l'unité dans une chaîne après le nombre. Retourne `{categorie,
// facteur, raw}` ou null.
function parserUnite(restant) {
  const m = String(restant || '').trim().match(/^(\w+|%)/);
  if (!m) return null;
  const key = m[1].toLowerCase();
  if (UNITES_CONVERSION[key]) return { ...UNITES_CONVERSION[key], raw: m[1] };
  return null;
}

// Extrait le 1er nombre significatif d'une chaîne (`< 50 ms` → {num:50, ...}).
// Préserve la direction d'amélioration : `<` ou `≤` → "lower is better".
// (#214) Détecte aussi l'unité pour permettre la conversion automatique.
export function parserValeur(s) {
  if (!s) return { num: null, direction: null, unite: null };
  const str = String(s);
  const direction = /^[<≤]/.test(str.trim()) ? 'lower' : 'higher';
  const m = str.match(/(-?\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!m) return { num: null, direction, unite: null };
  const num = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(num)) return { num: null, direction, unite: null };
  const unite = parserUnite(m[2]);
  return { num, direction, unite };
}

// (#214) Normalise une paire {num, unite} en valeur dans l'unité de base
// de sa catégorie. Sans unité → retourne num brut + categorie='aucune'.
export function normaliserVersUniteBase(num, unite) {
  if (num == null) return { num: null, categorie: null };
  if (!unite) return { num, categorie: 'aucune' };
  return { num: num * unite.facteur, categorie: unite.categorie };
}

// Compare une valeur actuelle vs une cible. Retourne `'ok'|'warn'|'bad'|'unknown'`.
//   - lower is better (`< 50ms`) : ok si actuel ≤ cible, warn si ≤ cible*1.5, sinon bad
//   - higher is better : ok si actuel ≥ cible, warn si ≥ cible*0.7, sinon bad
//   - Non-numérique : compare strings normalisées (égal → ok, sinon unknown)
export function evaluerEtat(cible, actuel) {
  const c = parserValeur(cible);
  const a = parserValeur(actuel);
  if (c.num == null || a.num == null) {
    // Comparaison textuelle
    const cn = String(cible).toLowerCase().trim();
    const an = String(actuel).toLowerCase().trim();
    if (!cn || !an || an === '—' || an === 'n/a') return 'unknown';
    return cn === an ? 'ok' : 'unknown';
  }
  // (#214) Conversion d'unités : si les 2 valeurs sont dans la même
  // catégorie d'unité (taille / durée / pct), on compare en unité de base.
  // Sinon fallback comparaison brute (rétro-compat avec #209).
  let cNum = c.num;
  let aNum = a.num;
  const cNorm = normaliserVersUniteBase(c.num, c.unite);
  const aNorm = normaliserVersUniteBase(a.num, a.unite);
  if (cNorm.categorie && aNorm.categorie && cNorm.categorie === aNorm.categorie && cNorm.categorie !== 'aucune') {
    cNum = cNorm.num;
    aNum = aNorm.num;
  }
  if (c.direction === 'lower') {
    if (aNum <= cNum) return 'ok';
    if (aNum <= cNum * 1.5) return 'warn';
    return 'bad';
  }
  // higher is better
  if (aNum >= cNum) return 'ok';
  if (aNum >= cNum * 0.7) return 'warn';
  return 'bad';
}

export function lireOutcomes(racineProjet, options = {}) {
  const chemin = options.fichier || join(racineProjet, '.aiad', 'PRD.md');
  if (!existsSync(chemin)) {
    return { fichier: null, total: 0, criteres: [] };
  }
  let contenu;
  try { contenu = readFileSync(chemin, 'utf-8'); }
  catch { return { fichier: null, total: 0, criteres: [] }; }
  const lignes = contenu.split('\n');
  let sectionIdx = -1;
  for (let i = 0; i < lignes.length; i++) {
    if (PATTERN_SECTION.test(lignes[i])) {
      sectionIdx = i;
      break;
    }
  }
  if (sectionIdx < 0) return { fichier: relative(racineProjet, chemin), total: 0, criteres: [], mesures: { fichier: null, date: null, mesures: [] } };
  const criteres = parserTableau(lignes, sectionIdx);
  // (#209) Enrichir chaque critère avec sa mesure actuelle si disponible.
  const mesures = options.mesures || lireMesures(racineProjet);
  if (mesures.mesures.length > 0) {
    const norm = (s) => String(s || '').toLowerCase().trim();
    const mesureIndex = new Map(mesures.mesures.map((m) => [norm(m.critere), m.actuel]));
    for (const c of criteres) {
      const a = mesureIndex.get(norm(c.critere));
      if (a != null) {
        c.actuel = a;
        c.etat = evaluerEtat(c.cible, a);
        c.mesureDate = mesures.date;
      } else {
        c.actuel = null;
        c.etat = 'unknown';
        c.mesureDate = null;
      }
    }
  }
  return {
    fichier: relative(racineProjet, chemin),
    total: criteres.length,
    criteres,
    mesures: { fichier: mesures.fichier, date: mesures.date, total: mesures.mesures.length },
  };
}

// ─── Rendu HTML ─────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';
import { renduTimelines } from './outcomes-history.js';

function badgeEtat(etat, actuel) {
  if (etat === 'ok') return `<span class="badge badge-ok" style="font-size:.75rem">${escape(actuel)} ✓</span>`;
  if (etat === 'warn') return `<span class="badge badge-warn" style="font-size:.75rem">${escape(actuel)}</span>`;
  if (etat === 'bad') return `<span class="badge badge-bad" style="font-size:.75rem">${escape(actuel)} ⚠</span>`;
  if (actuel != null) return `<span class="badge" style="font-size:.75rem">${escape(actuel)}</span>`;
  return '<span class="muted" style="font-size:.85rem">—</span>';
}

export function blocOutcomes(donnees) {
  const o = donnees?.outcomes;
  // Section omise si PRD absent OU 0 critères — pas de pollution visuelle.
  if (!o || !o.fichier || o.total === 0) return '';
  // (#209) Inclure la colonne "Actuel" uniquement si on a au moins une mesure
  // — sinon table compacte 4 colonnes comme avant.
  const aDesMesures = o.criteres.some((c) => c.actuel != null);
  const colsExtra = aDesMesures ? '<th>Actuel</th>' : '';
  const rows = o.criteres.slice(0, 20).map((c) => `
    <tr>
      <td><strong>${escape(c.critere)}</strong></td>
      <td class="muted">${escape(c.baseline)}</td>
      <td><span class="badge badge-info" style="font-size:.75rem">${escape(c.cible)}</span></td>
      ${aDesMesures ? `<td>${badgeEtat(c.etat, c.actuel)}</td>` : ''}
      <td class="muted" style="font-size:.85rem">${escape(c.methode)}</td>
    </tr>`).join('');
  const banniereMesures = aDesMesures
    ? `<p class="muted" style="font-size:.8rem">Mesures du ${escape(o.mesures?.date || '—')} · source ${o.mesures?.fichier ? lienSource(o.mesures.fichier) : '<code>—</code>'}.</p>`
    : `<p class="muted" style="font-size:.8rem">⚠ Aucune mesure courante. Ajoute un fichier <code>.aiad/metrics/outcomes/YYYY-MM-DD.md</code> avec un tableau Markdown <code>| Critère | Actuel |</code> pour comparer à la cible.</p>`;
  // (#210) Sparklines timeline si historique disponible
  const timelines = renduTimelines(o.evolution);
  return `<section>
    <h2>Outcome Criteria (PRD) <span class="count">${o.total}</span></h2>
    <p class="muted" style="font-size:.85rem">Promesse produit — extrait automatiquement de la section <code>## Outcome Criteria</code> de ${lienSource(o.fichier)}.</p>
    ${banniereMesures}
    <table>
      <thead><tr><th>Critère</th><th>Baseline</th><th>Cible</th>${colsExtra}<th>Méthode</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${timelines}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  lireOutcomes as readOutcomes,
  blocOutcomes as outcomesSection,
  lireMesures as readMeasurements,
  evaluerEtat as evaluateState,
  parserValeur as parseValue,
  normaliserVersUniteBase as normalizeToBaseUnit,
};
