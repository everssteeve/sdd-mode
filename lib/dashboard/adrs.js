// AIAD SDD Mode — Dashboard : extraction des ADRs depuis ARCHITECTURE.md (#138).
//
// Persona Tech Lead débloquée. Parse `.aiad/ARCHITECTURE.md` à la recherche
// du pattern conventionnel `**ADR-NNN** : titre` (déjà adopté dans les
// projets AIAD). Pour chaque ADR détecté, on capture :
//   - id (`ADR-001`)
//   - titre (corps de la ligne)
//   - section parente (titre H2/H3 le plus proche au-dessus)
//   - ligne dans le fichier source
//
// Si un bloc multi-ligne suit l'ADR (Contexte/Décision/Conséquences), on le
// capture en `corps` (max 500 caractères). Sinon le titre fait foi.
//
// Sortie : { fichier, total, entrees: [...] } JSON-sérialisable.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Pattern principal : ligne commençant par `- **ADR-NNN**` ou `**ADR-NNN**`
// (puce optionnelle) suivie d'un séparateur (:, —, –, -).
const PATTERN_ADR = /^\s*(?:[-*]\s+)?\*\*(ADR-[A-Za-z0-9-]+)\*\*\s*[:—–\-]\s*(.+?)\s*$/;
// Heading pour rattacher l'ADR à une section.
const PATTERN_HEADING = /^(#{2,4})\s+(.+?)\s*$/;

export function extraireAdrs(racineProjet, options = {}) {
  const archi = options.fichier || join(racineProjet, '.aiad', 'ARCHITECTURE.md');
  if (!existsSync(archi)) return { fichier: null, total: 0, entrees: [] };
  let contenu;
  try { contenu = readFileSync(archi, 'utf-8'); } catch { return { fichier: null, total: 0, entrees: [] }; }
  const lignes = contenu.split('\n');

  let sectionCourante = null;
  const entrees = [];
  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i];
    const heading = ligne.match(PATTERN_HEADING);
    if (heading) {
      sectionCourante = heading[2].trim();
      continue;
    }
    const m = ligne.match(PATTERN_ADR);
    if (!m) continue;
    const id = m[1];
    const titre = m[2].trim();
    // Capture jusqu'à 5 lignes suivantes indentées comme contexte additionnel.
    const corpsBuf = [];
    for (let j = i + 1; j < Math.min(lignes.length, i + 10); j++) {
      const suiv = lignes[j];
      if (!suiv.trim()) break;
      // S'arrête au prochain ADR ou heading
      if (PATTERN_ADR.test(suiv) || PATTERN_HEADING.test(suiv)) break;
      // Indentation: on capture si la ligne commence par un espace, un tab,
      // un signe de citation `>` ou si elle est dans la même puce.
      if (/^[\s>]/.test(suiv) || /^-\s+/.test(suiv)) {
        corpsBuf.push(suiv.trim());
      } else {
        break;
      }
    }
    entrees.push({
      id,
      titre,
      section: sectionCourante,
      ligne: i + 1,
      corps: corpsBuf.join(' ').slice(0, 500),
    });
  }
  return {
    fichier: relative(racineProjet, archi),
    total: entrees.length,
    entrees,
  };
}

// ─── Drift ADR (#161) ───────────────────────────────────────────────────────
//
// Scanne le code source à la recherche d'annotations `@adr ADR-NNN` et
// croise avec la liste des ADRs présents dans ARCHITECTURE.md. Si une
// annotation référence un ADR qui n'existe plus → drift architecture :
// soit l'ADR a été archivé sans nettoyer le code, soit le tag est une typo.
//
// Format annotation accepté (mêmes conventions que @spec) :
//   // @adr ADR-001
//   # @adr ADR-042
//   /** @adr ADR-007 */
//
// Pour ne pas dupliquer la logique de scan déjà présente dans sdd-trace.js,
// on accepte une matrice optionnelle en entrée (qui contient les fichiers
// code scannés). Sinon fallback FS direct.

const PATTERN_ADR_ANNOT = /@adr\s+(ADR-[A-Za-z0-9-]+)/g;
const EXTS_CODE = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rs', '.java', '.kt', '.cs', '.rb', '.php', '.swift', '.scala', '.ex']);
const DOSSIERS_IGNORES = new Set(['node_modules', 'dist', 'build', '.git', '.cache', 'dashboard', 'vendor', 'target', '__pycache__']);

function walkCode(racine, dir, acc, depth = 0) {
  if (depth > 6) return;
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const nom of entries) {
    if (DOSSIERS_IGNORES.has(nom) || nom.startsWith('.')) continue;
    const p = join(dir, nom);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) {
      walkCode(racine, p, acc, depth + 1);
    } else {
      const dot = nom.lastIndexOf('.');
      if (dot < 0) continue;
      const ext = nom.slice(dot);
      if (!EXTS_CODE.has(ext)) continue;
      acc.push(p);
    }
  }
}

export function scannerReferencesAdr(racineProjet) {
  const acc = [];
  walkCode(racineProjet, racineProjet, acc);
  const refs = []; // { adrId, file, line }
  for (const f of acc) {
    let c;
    try { c = readFileSync(f, 'utf-8'); } catch { continue; }
    if (!c.includes('@adr')) continue; // optimisation grossière
    const lignes = c.split('\n');
    for (let i = 0; i < lignes.length; i++) {
      const matches = lignes[i].matchAll(PATTERN_ADR_ANNOT);
      for (const m of matches) {
        refs.push({ adrId: m[1], file: relative(racineProjet, f), line: i + 1 });
      }
    }
  }
  return refs;
}

export function detecterDriftAdr(racineProjet, adrs) {
  const refs = scannerReferencesAdr(racineProjet);
  const idsConnus = new Set((adrs?.entrees || []).map((a) => a.id));
  const orphelins = [];
  for (const r of refs) {
    if (!idsConnus.has(r.adrId)) orphelins.push(r);
  }
  return {
    referencesTotal: refs.length,
    orphelins,
    total: orphelins.length,
  };
}

// ─── Rendu HTML (page dédiée + widget compact) ──────────────────────────────

import { escape, lienSource, lienSourceLigne } from './render.js';
import { blocTechDebt } from './tech-debt.js';
import { blocPerfBudgets } from './perf-budgets.js';

export function pageAdrs(donnees) {
  const adrs = donnees?.adrs;
  if (!adrs || adrs.total === 0) {
    // (#333) Si le fichier ARCHITECTURE.md existe (adrs.fichier non null),
    // on hyperlie pour permettre au PM d'ouvrir le fichier directement et
    // d'y ajouter les ADRs manquants. Sinon (cas init complet — fichier
    // absent), on garde le `<code>` text-only.
    const cibleFichier = adrs?.fichier
      ? lienSource(adrs.fichier)
      : `<code>${escape('.aiad/ARCHITECTURE.md')}</code>`;
    return `<div class="empty">
      <strong>Aucun ADR détecté dans ${cibleFichier}.</strong>
      Convention : ajoute des lignes <code>- **ADR-NNN** : décision</code> dans ARCHITECTURE.md pour les capturer ici.
    </div>${blocPerfBudgets(donnees)}${blocTechDebt(donnees)}`;
  }
  // (#309) Cellule "Ligne" rendue en lien `<a href="../ARCHITECTURE.md#L24">L24</a>`
  // — permet de sauter directement à la décision dans le fichier source
  // (GitHub/GitLab interprètent `#L24` comme anchor). Fallback : si pas de
  // fichier source (cas vide impossible ici puisque on a déjà guard adrs.total),
  // on retombe sur le texte brut.
  const lienLigne = (a) => adrs.fichier
    ? lienSourceLigne(adrs.fichier, a.ligne)
    : `L${a.ligne}`;
  // (#351) ID hyperlié vers ARCHITECTURE.md#LNN (même cible que la cellule
  // Ligne — cohérence catalog #327). Garde-fou : fichier absent → <code>.
  const lienId = (a) => adrs.fichier
    ? lienSourceLigne(adrs.fichier, a.ligne, a.id)
    : `<code>${escape(a.id)}</code>`;
  const rows = adrs.entrees.map((a) => `
    <tr>
      <td>${lienId(a)}</td>
      <td>${escape(a.titre)}</td>
      <td class="muted">${escape(a.section || '—')}</td>
      <td class="muted">${lienLigne(a)}</td>
    </tr>`).join('');
  return `
<div class="kpis">
  <div class="kpi"><div class="label">ADRs détectés</div><div class="value">${adrs.total}</div><div class="delta">source ${lienSource(adrs.fichier)}</div></div>
</div>
<section>
  <h2>Architecture Decision Records <span class="count">${adrs.total} ADR(s)</span></h2>
  <p class="muted">Extrait automatiquement du pattern <code>**ADR-NNN**</code> dans ARCHITECTURE.md. Clique sur l'en-tête d'une colonne pour trier ; tape dans le filtre pour rechercher.</p>
  <div class="filter"><input type="search" id="qAdrs" data-filter-target="tAdrs" placeholder="Filtrer par ID, décision, section…" autocomplete="off"/></div>
  <table id="tAdrs" data-sortable="true">
    <thead><tr><th>ID</th><th>Décision</th><th>Section</th><th>Ligne</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>
${blocDriftAdr(donnees)}
${blocPerfBudgets(donnees)}
${blocTechDebt(donnees)}
${adrs.entrees.some((a) => a.corps) ? `
<section>
  <h2>Contexte détaillé</h2>
  ${adrs.entrees.filter((a) => a.corps).map((a) => `
    <details>
      <summary>${lienId(a)} — ${escape(a.titre)}</summary>
      <p class="muted">${escape(a.corps)}</p>
    </details>`).join('')}
</section>` : ''}
`;
}

// (#161) Bloc affiché sous la table principale : alerte rouge si des `@adr`
// du code référencent des ADRs absents de ARCHITECTURE.md (drift). Section
// verte amicale sinon (rassure l'équipe).
function blocDriftAdr(donnees) {
  const drift = donnees?.adrsDrift;
  if (!drift) return '';
  if (drift.total === 0) {
    return drift.referencesTotal === 0
      ? '' // pas de @adr dans le code → rien à signaler
      : `<section>
        <h2>Drift Architecture <span class="count">0</span></h2>
        <div class="alertes ok"><span class="alertes-icon">✓</span><div><strong>Aucun drift architecture.</strong><div class="muted">${drift.referencesTotal} référence(s) <code>@adr</code> dans le code, toutes valides.</div></div></div>
      </section>`;
  }
  // (#309) Drift table : fichier + ligne pointent vers la ligne précise (anchor #LNN),
  // pas juste vers la tête du fichier.
  const rows = drift.orphelins.slice(0, 50).map((o) => `
    <tr>
      <td><code>${escape(o.adrId)}</code></td>
      <td>${o.file ? lienSourceLigne(o.file, o.line, o.file) : '<em class="muted">—</em>'}</td>
      <td class="muted">${o.file ? lienSourceLigne(o.file, o.line) : `L${o.line}`}</td>
    </tr>`).join('');
  return `
<section>
  <h2>Drift Architecture <span class="count">${drift.total} référence(s) orphelines</span></h2>
  <p class="muted">${drift.referencesTotal} référence(s) <code>@adr</code> dans le code ; ${drift.total} pointent vers un ADR absent de <code>ARCHITECTURE.md</code>. Soit l'ADR a été archivé sans nettoyer le code, soit le tag est une typo.</p>
  <table>
    <thead><tr><th>ADR référencé (orphelin)</th><th>Fichier</th><th>Ligne</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>`;
}

// (#309) Conservé pour compat externe (export non utilisé en interne).
// Préfère `lienSourceLigne(file, ligne)` quand on dispose d'un numéro de ligne.
function lienSourceAdr(file) {
  if (!file) return '<em class="muted">—</em>';
  return lienSourceLigne(file, null, file);
}

// Alias EN canoniques (#42)
export {
  extraireAdrs as extractAdrs,
  pageAdrs as adrsPage,
};
