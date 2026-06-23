// AIAD SDD Mode — Dashboard : rollup dette technique (Tech Lead, #196).
//
// Couvre 2 dimensions clés visibles dans le code et les SPECs :
//   - `TODO-JNSP:` markers (Je Ne Sais Pas — décisions humaines en attente,
//     bloquées par le hook pre-commit)
//   - SPECs > 200 LOC (signal de découpage manquant)
//
// Cible : persona Tech Lead. Section affichée en bas de `adrs.html`.
//
// Cohérent avec `lib/dashboard/adrs.js` (même scan FS, mêmes exclusions).

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SEUIL_LOC_DEFAUT = 200;
// Seuil d'avertissement (warning) avant le seuil critique. Vise à
// signaler les SPECs qui s'approchent du seuil de refactor sans déjà y
// être (#197).
const SEUIL_LOC_WARN_DEFAUT = 100;
const SEUIL_AGE_RECENT_J = 7;
const SEUIL_AGE_MEDIUM_J = 30;

// Lit la config projet `.aiad/config.json` si présente. Retourne un objet
// vide à défaut. La config est tolérante : tout JSON parseable est accepté
// (les clés inconnues sont ignorées par les consommateurs).
function lireConfig(racineProjet) {
  const chemin = join(racineProjet, '.aiad', 'config.json');
  if (!existsSync(chemin)) return {};
  try { return JSON.parse(readFileSync(chemin, 'utf-8')) || {}; }
  catch { return {}; }
}

// Classifie un fichier par ancienneté de sa dernière modification.
// Recent : modifié dans les SEUIL_AGE_RECENT_J derniers jours.
// Medium : entre SEUIL_AGE_RECENT_J et SEUIL_AGE_MEDIUM_J.
// Stale  : > SEUIL_AGE_MEDIUM_J. Signal que le JNSP est probablement oublié.
function classerAge(mtimeMs, now = Date.now()) {
  if (!mtimeMs) return { ageDays: null, age: 'unknown' };
  const ageDays = Math.max(0, Math.round((now - mtimeMs) / 86_400_000));
  if (ageDays < SEUIL_AGE_RECENT_J) return { ageDays, age: 'recent' };
  if (ageDays < SEUIL_AGE_MEDIUM_J) return { ageDays, age: 'medium' };
  return { ageDays, age: 'stale' };
}

// Pattern strict : `TODO-JNSP:` (avec deux-points). Compat avec le hook
// pre-commit `.aiad/hooks/pre-commit.sh` qui bloque ces markers.
const PATTERN_JNSP = /TODO-JNSP:\s*(.+)$/;

// Aligné avec le hook `.aiad/hooks/jnsp-scan.js` : les fichiers Markdown
// sont exclus car le hook pre-commit ne les bloque pas non plus. Les .md
// contiennent souvent `TODO-JNSP:` comme exemple de syntaxe (faux positifs).
const EXTS_CODE = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.kt', '.cs', '.rb', '.php',
  '.swift', '.scala', '.ex',
]);
const DOSSIERS_IGNORES = new Set([
  'node_modules', 'dist', 'build', '.git', '.cache',
  'dashboard', 'vendor', 'target', '__pycache__', 'coverage',
  // Dossiers exclus du scan JNSP : contiennent des occurrences
  // intentionnelles (exemples docs, fixtures tests, scénarios bench).
  'test', 'bench', 'docs', 'templates',
]);

function walk(racine, dir, acc, depth = 0) {
  if (depth > 6) return;
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const nom of entries) {
    if (DOSSIERS_IGNORES.has(nom) || nom.startsWith('.')) continue;
    const p = join(dir, nom);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) {
      walk(racine, p, acc, depth + 1);
    } else {
      const dot = nom.lastIndexOf('.');
      if (dot < 0) continue;
      const ext = nom.slice(dot);
      if (!EXTS_CODE.has(ext)) continue;
      acc.push(p);
    }
  }
}

export function scannerTodoJnsp(racineProjet, options = {}) {
  const acc = [];
  walk(racineProjet, racineProjet, acc);
  const max = Number.isFinite(options.max) ? options.max : 200; // garde-fou
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const markers = [];
  for (const f of acc) {
    let c;
    try { c = readFileSync(f, 'utf-8'); } catch { continue; }
    if (!c.includes('TODO-JNSP')) continue;
    let mtime = null;
    try { mtime = statSync(f).mtimeMs; } catch { /* fichier disparu */ }
    const { ageDays, age } = classerAge(mtime, now);
    const lignes = c.split('\n');
    for (let i = 0; i < lignes.length; i++) {
      const m = lignes[i].match(PATTERN_JNSP);
      if (m) {
        markers.push({
          file: relative(racineProjet, f),
          line: i + 1,
          question: m[1].trim().slice(0, 200),
          ageDays,
          age,
        });
        if (markers.length >= max) return markers;
      }
    }
  }
  return markers;
}

function compterLocSpec(racineProjet, file) {
  const chemin = join(racineProjet, file);
  if (!existsSync(chemin)) return null;
  let c;
  try { c = readFileSync(chemin, 'utf-8'); } catch { return null; }
  // LOC = lignes non-vides, hors frontmatter `---`
  const lignes = c.split('\n');
  let inFm = false;
  let fmCount = 0;
  let loc = 0;
  for (const l of lignes) {
    if (l.trim() === '---') {
      fmCount += 1;
      if (fmCount <= 2) { inFm = fmCount === 1; continue; }
    }
    if (inFm) continue;
    if (l.trim().length > 0) loc += 1;
  }
  return loc;
}

export function specsGrosses(racineProjet, donnees, options = {}) {
  const seuil = Number.isFinite(options.seuil) ? options.seuil : SEUIL_LOC_DEFAUT;
  const specs = donnees?.specs || [];
  const out = [];
  for (const s of specs) {
    if (!s.file) continue;
    const loc = compterLocSpec(racineProjet, s.file);
    if (loc == null) continue;
    if (loc > seuil) out.push({ id: s.id, file: s.file, loc, statut: s.statut });
  }
  return out.sort((a, b) => b.loc - a.loc);
}

// (#197) Tier "warning" : SPECs entre seuilWarn et seuil — proches du
// refactor mais pas encore critiques. Permet d'anticiper.
export function specsApprochantSeuil(racineProjet, donnees, options = {}) {
  const seuilWarn = Number.isFinite(options.seuilWarn) ? options.seuilWarn : SEUIL_LOC_WARN_DEFAUT;
  const seuil = Number.isFinite(options.seuil) ? options.seuil : SEUIL_LOC_DEFAUT;
  if (seuilWarn >= seuil) return []; // garde-fou : warn doit être < critique
  const specs = donnees?.specs || [];
  const out = [];
  for (const s of specs) {
    if (!s.file) continue;
    const loc = compterLocSpec(racineProjet, s.file);
    if (loc == null) continue;
    if (loc > seuilWarn && loc <= seuil) out.push({ id: s.id, file: s.file, loc, statut: s.statut });
  }
  return out.sort((a, b) => b.loc - a.loc);
}

export function calculerTechDebt(racineProjet, donnees, options = {}) {
  // (#197) Précédence : opts > config projet > défaut.
  const cfg = lireConfig(racineProjet);
  const cfgDebt = cfg.techDebt || {};
  const seuil = Number.isFinite(options.seuil) ? options.seuil
    : Number.isFinite(cfgDebt.seuilLoc) ? cfgDebt.seuilLoc
    : SEUIL_LOC_DEFAUT;
  const seuilWarn = Number.isFinite(options.seuilWarn) ? options.seuilWarn
    : Number.isFinite(cfgDebt.seuilLocWarn) ? cfgDebt.seuilLocWarn
    : SEUIL_LOC_WARN_DEFAUT;
  const jnsp = scannerTodoJnsp(racineProjet, options);
  const grosses = specsGrosses(racineProjet, donnees, { seuil });
  const warning = specsApprochantSeuil(racineProjet, donnees, { seuil, seuilWarn });
  // Compte par bucket d'ancienneté pour le rollup (alimente les KPI).
  const jnspParAge = { recent: 0, medium: 0, stale: 0, unknown: 0 };
  for (const m of jnsp) jnspParAge[m.age] = (jnspParAge[m.age] || 0) + 1;
  return {
    seuilLoc: seuil,
    seuilLocWarn: seuilWarn,
    sourceSeuil: Number.isFinite(options.seuil) ? 'options'
      : Number.isFinite(cfgDebt.seuilLoc) ? 'config'
      : 'default',
    jnsp: { total: jnsp.length, markers: jnsp.slice(0, 50), parAge: jnspParAge },
    specsGrosses: { total: grosses.length, entrees: grosses.slice(0, 50) },
    specsWarning: { total: warning.length, entrees: warning.slice(0, 50) },
  };
}

import { escape, lienSource, lienSourceLigne } from './render.js';
import { renduTimeline } from './tech-debt-history.js';

function badgeAge(age) {
  if (age === 'recent') return '<span class="badge badge-ok" style="font-size:.7rem">&lt; 7j</span>';
  if (age === 'medium') return '<span class="badge badge-warn" style="font-size:.7rem">7-30j</span>';
  if (age === 'stale') return '<span class="badge badge-bad" style="font-size:.7rem">&gt; 30j</span>';
  return '<span class="badge" style="font-size:.7rem">?</span>';
}

export function blocTechDebt(donnees) {
  const debt = donnees?.techDebt;
  if (!debt) return '';
  const totalJnsp = debt.jnsp?.total || 0;
  const totalGrosses = debt.specsGrosses?.total || 0;
  const totalWarning = debt.specsWarning?.total || 0;
  const total = totalJnsp + totalGrosses;
  // (#198) Mini-timeline 4 semaines si historique disponible.
  const timeline = renduTimeline(donnees.techDebtHistory);
  if (total === 0 && totalWarning === 0) {
    return `<section>
      <h2>Dette technique <span class="count">0</span></h2>
      <div class="alertes ok"><span class="alertes-icon">✓</span><div><strong>Pas de dette signalée.</strong><div class="muted">0 marker <code>TODO-JNSP</code> · 0 SPEC > ${debt.seuilLoc} LOC · 0 SPEC > ${debt.seuilLocWarn} LOC.</div></div></div>
      ${timeline}
    </section>`;
  }
  // (#197) Lignes JNSP triées : stale → medium → recent (le plus oublié en
  // haut). Au sein d'un bucket, conserve l'ordre de scan.
  const rangAge = { stale: 0, medium: 1, recent: 2, unknown: 3 };
  const jnspTries = (debt.jnsp.markers || []).slice().sort((a, b) => (rangAge[a.age] ?? 9) - (rangAge[b.age] ?? 9));
  // (#311) Fichier + ligne pointent tous deux vers `FILE#LNN` (anchor).
  const jnspRows = jnspTries.slice(0, 30).map((m) => `
    <tr>
      <td>${lienSourceLigne(m.file, m.line, m.file)}</td>
      <td class="muted">${lienSourceLigne(m.file, m.line)}</td>
      <td>${escape(m.question)}</td>
      <td class="muted">${badgeAge(m.age)} ${m.ageDays != null ? `<span class="muted" style="font-size:.7rem">(${m.ageDays}j)</span>` : ''}</td>
    </tr>`).join('');
  const grossesRows = (debt.specsGrosses.entrees || []).slice(0, 30).map((s) => `
    <tr>
      <td><code>${escape(s.id)}</code></td>
      <td>${lienSource(s.file)}</td>
      <td class="muted">${s.loc} LOC</td>
      <td class="muted">${escape(s.statut || '—')}</td>
    </tr>`).join('');
  const warningRows = (debt.specsWarning?.entrees || []).slice(0, 30).map((s) => `
    <tr>
      <td><code>${escape(s.id)}</code></td>
      <td>${lienSource(s.file)}</td>
      <td class="muted">${s.loc} LOC</td>
      <td class="muted">${escape(s.statut || '—')}</td>
    </tr>`).join('');
  const ages = debt.jnsp.parAge || {};
  const jnspKpiDelta = totalJnsp > 0
    ? `<span class="badge badge-bad" style="font-size:.7rem">${ages.stale || 0} oubliés</span>`
    : 'décisions humaines en attente';
  const jnspBlock = totalJnsp > 0 ? `
    <h3>JNSP non résolus <span class="count">${totalJnsp}</span></h3>
    <p class="muted">Markers <code>TODO-JNSP:</code> en attente de décision humaine. Triés du plus oublié au plus récent. Ancienneté = mtime du fichier (proxy : si le fichier a été modifié récemment sans résoudre le JNSP, le marker reste signalé "stale" si l'âge > 30j).</p>
    <table>
      <thead><tr><th>Fichier</th><th>Ligne</th><th>Question</th><th>Ancienneté</th></tr></thead>
      <tbody>${jnspRows}</tbody>
    </table>` : '';
  const grossesBlock = totalGrosses > 0 ? `
    <h3>SPECs > ${debt.seuilLoc} LOC (critique) <span class="count">${totalGrosses}</span></h3>
    <p class="muted">Signal de découpage manquant. Lance <code>aiad-sdd refactor-spec &lt;id&gt;</code> pour une suggestion automatique.</p>
    <table>
      <thead><tr><th>SPEC</th><th>Fichier</th><th>LOC</th><th>Statut</th></tr></thead>
      <tbody>${grossesRows}</tbody>
    </table>` : '';
  const warningBlock = totalWarning > 0 ? `
    <h3>SPECs > ${debt.seuilLocWarn} LOC (à surveiller) <span class="count">${totalWarning}</span></h3>
    <p class="muted">Entre ${debt.seuilLocWarn} et ${debt.seuilLoc} LOC : à surveiller avant qu'elles franchissent le seuil critique.</p>
    <table>
      <thead><tr><th>SPEC</th><th>Fichier</th><th>LOC</th><th>Statut</th></tr></thead>
      <tbody>${warningRows}</tbody>
    </table>` : '';
  const seuilSource = debt.sourceSeuil === 'config' ? ' (config projet)' : debt.sourceSeuil === 'options' ? ' (option CLI)' : '';
  return `<section>
    <h2>Dette technique <span class="count">${total + totalWarning}</span></h2>
    <div class="kpis">
      <div class="kpi"><div class="label">JNSP non résolus</div><div class="value">${totalJnsp}</div><div class="delta">${jnspKpiDelta}</div></div>
      <div class="kpi"><div class="label">SPECs > ${debt.seuilLoc} LOC</div><div class="value">${totalGrosses}</div><div class="delta">critiques${escape(seuilSource)}</div></div>
      <div class="kpi"><div class="label">SPECs > ${debt.seuilLocWarn} LOC</div><div class="value">${totalWarning}</div><div class="delta">à surveiller</div></div>
    </div>
    ${timeline}
    ${jnspBlock}
    ${grossesBlock}
    ${warningBlock}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  scannerTodoJnsp as scanTodoJnsp,
  specsGrosses as largeSpecs,
  specsApprochantSeuil as nearLimitSpecs,
  calculerTechDebt as computeTechDebt,
  blocTechDebt as techDebtSection,
};
